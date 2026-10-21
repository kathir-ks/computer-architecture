import { locationOf, WORK_CYCLES, type LocationId, type WorkCycleKind } from '../locations';

/** One trip for data: which shelves were checked, who supplied it, and what the wait cost. */
export type AccessKind = 'load' | 'store';

export interface Probe {
  level: LocationId;
  result: 'miss' | 'hit';
}

export interface AccessJourney {
  id: number;
  kind: AccessKind;
  /** De-duplicated, in the order the levels were checked. */
  probes: Probe[];
  /** Level that supplied (load) or accepted (store) the data; null until known. */
  served: LocationId | null;
  /** Running cost of the wait; once complete it equals the serving level's latency exactly. */
  cycles: number;
  done: boolean;
}

export interface LedgerSnapshot {
  current: AccessJourney | null;
  idleCycles: number;
  workingCycles: number;
  elapsedCycles: number;
}

type Listener = (s: LedgerSnapshot) => void;

/**
 * The cycle book (data-model.md). Pure and renderer-free: nothing here knows about meshes or timelines.
 * Latency numbers come from `locations.ts` only.
 *
 * The product's cost is the TOTAL cost of the serving level (0 / 4 / 12 / 200 / 4,000,000), not the sum of
 * every level that was checked — the levels checked first are what made the wait necessary, but the data
 * only travels from the one that had it.
 */
export class CycleLedger {
  private cur: AccessJourney | null = null;
  private past: AccessJourney[] = [];
  private nextId = 1;
  private working = 0;
  /** Idle cycles banked by finished journeys; the open one is added on the fly. */
  private idleBanked = 0;
  private listeners = new Set<Listener>();

  /** A journey exists and has not been completed. */
  get isOpen(): boolean {
    return this.cur !== null && !this.cur.done;
  }

  /** Finished journeys, oldest first. */
  get history(): readonly AccessJourney[] {
    return this.past;
  }

  /** Start a new journey. An open one is closed first (completed if served, dropped if it never was). */
  beginAccess(kind: AccessKind = 'load'): void {
    if (this.isOpen) this.complete();
    this.cur = { id: this.nextId++, kind, probes: [], served: null, cycles: 0, done: false };
    this.emit();
  }

  /** A level was checked. Re-checking a level within one journey is ignored (chapter 6 flashes L2 twice). */
  probe(level: LocationId, result: 'miss' | 'hit'): void {
    const j = this.cur;
    if (!j || j.done || j.served) return;
    if (j.probes.some((p) => p.level === level)) return;
    j.probes.push({ level, result });
    this.emit();
  }

  /** Data is on its way from (load) or to (store) this level. The first serve wins. */
  serve(level: LocationId, kind?: AccessKind): void {
    const j = this.cur;
    if (!j || j.done || j.served) return;
    j.served = level;
    if (kind) j.kind = kind;
    this.emit();
  }

  /** The wait grew by `deltaCycles`. Ignored outside an open, served journey; never exceeds the level's latency. */
  advance(deltaCycles: number): void {
    const j = this.cur;
    if (!j || j.done || !j.served || !(deltaCycles > 0)) return;
    const room = locationOf(j.served).latencyCycles - j.cycles;
    if (room <= 0) return;
    j.cycles += Math.min(deltaCycles, room);
    this.emit();
  }

  /** Data arrived: the wait snaps to exactly the serving level's latency and is banked as idle time. */
  complete(): void {
    const j = this.cur;
    if (!j || j.done) return;
    if (!j.served) {
      // Nothing was ever served (e.g. hit/miss flashes with no trip): there is no wait to account for.
      this.cur = null;
      this.emit();
      return;
    }
    j.cycles = locationOf(j.served).latencyCycles;
    j.done = true;
    this.idleBanked += j.cycles;
    this.past.push({ ...j, probes: [...j.probes] });
    this.emit();
  }

  /** The Worker did real work. Only kinds that appear in WORK_CYCLES cost anything. */
  work(kind: WorkCycleKind): void {
    this.working += WORK_CYCLES[kind];
    this.emit();
  }

  /** Chapter jump or free-play reset: killed timelines never finish, so partial journeys are dropped. */
  reset(): void {
    this.cur = null;
    this.past = [];
    this.nextId = 1;
    this.working = 0;
    this.idleBanked = 0;
    this.emit();
  }

  snapshot(): LedgerSnapshot {
    const idle = this.idleBanked + (this.isOpen ? this.cur!.cycles : 0);
    return {
      current: this.cur ? { ...this.cur, probes: [...this.cur.probes] } : null,
      idleCycles: idle,
      workingCycles: this.working,
      elapsedCycles: idle + this.working,
    };
  }

  /** Returns an unsubscribe function. */
  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    if (this.listeners.size === 0) return;
    const s = this.snapshot();
    for (const cb of this.listeners) cb(s);
  }
}
