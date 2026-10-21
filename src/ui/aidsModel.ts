import type { LedgerSnapshot } from '../scene/telemetry/ledger';
import { RUNGS } from './ladderModel';

/** What the cycle meter shows for the current access. */
export interface MeterView {
  /** idle: no access yet · checking: levels being looked at, no wait yet · running: data in motion · done */
  state: 'idle' | 'checking' | 'running' | 'done';
  /** The cost so far; once done, the final cost (it equals the serving level's latency). */
  cycles: number;
  /** Short plain-words line, e.g. "Waiting on RAM" / "RAM supplied it". */
  note: string;
}

function rungLabel(level: string | null): string {
  return RUNGS.find((r) => (r.levels as readonly string[]).includes(level ?? ''))?.label ?? '';
}

export function meterView(s: LedgerSnapshot): MeterView {
  const j = s.current;
  if (!j) return { state: 'idle', cycles: 0, note: 'No access yet' };
  if (!j.served) {
    return { state: 'checking', cycles: 0, note: j.probes.length ? 'Checking the shelves' : 'Looking' };
  }
  const where = rungLabel(j.served);
  const verb = j.kind === 'store' ? 'stored in' : 'served by';
  if (j.done) return { state: 'done', cycles: j.cycles, note: `${verb} ${where}` };
  return { state: 'running', cycles: j.cycles, note: j.kind === 'store' ? `Storing in ${where}` : `Waiting on ${where}` };
}

/** The Worker's time, split into waiting and working. */
export interface IdleView {
  idle: number;
  working: number;
  elapsed: number;
  /** Share of elapsed time spent waiting, 0–1 (0 when nothing has happened). */
  idleShare: number;
}

export function idleView(s: LedgerSnapshot): IdleView {
  const elapsed = s.elapsedCycles;
  return {
    idle: s.idleCycles,
    working: s.workingCycles,
    elapsed,
    idleShare: elapsed > 0 ? s.idleCycles / elapsed : 0,
  };
}

/**
 * "99.9998%" is noise and "100%" is a lie while one cycle of work exists, so the extremes are worded
 * rather than rounded: the point of the counter is that waiting dwarfs working.
 */
export function percentText(share: number): string {
  if (share <= 0) return '0%';
  if (share >= 1) return '100%';
  if (share < 0.001) return '<0.1%';
  if (share > 0.999) return '>99.9%';
  return `${(share * 100).toFixed(1)}%`;
}
