import { describe, expect, it } from 'vitest';
import { CycleLedger, type LedgerSnapshot } from '../../src/scene/telemetry/ledger';
import { locationOf, WORK_CYCLES, type LocationId } from '../../src/scene/locations';
import { applyOutcome, emptyScoreboard, fire, type Op, type Target } from '../../src/story/freeplay';

/** Drive one whole journey the way the tracker does: probes, serve, a ramp of advances, complete. */
function run(
  ledger: CycleLedger,
  served: LocationId,
  probes: Array<[LocationId, 'miss' | 'hit']> = [],
  steps = 7,
): void {
  ledger.beginAccess('load');
  for (const [level, result] of probes) ledger.probe(level, result);
  ledger.serve(served);
  const total = locationOf(served).latencyCycles;
  for (let i = 0; i < steps; i++) ledger.advance(total / steps);
  ledger.complete();
}

describe('CycleLedger — cost of a journey', () => {
  it.each(['registers', 'l1d', 'l2', 'ram', 'disk'] as const)(
    'ends at exactly the latency of %s, to the integer',
    (level) => {
      const ledger = new CycleLedger();
      // 7 steps of total/7 accumulate floating-point error; completion must snap to the exact number.
      run(ledger, level);
      expect(ledger.snapshot().current!.cycles).toBe(locationOf(level).latencyCycles);
      expect(Number.isInteger(ledger.snapshot().current!.cycles)).toBe(true);
    },
  );

  it('snaps to the exact latency even if the ramp stopped short', () => {
    const ledger = new CycleLedger();
    ledger.beginAccess();
    ledger.serve('ram');
    ledger.advance(60);
    ledger.complete();
    expect(ledger.snapshot().current!.cycles).toBe(200);
    expect(ledger.snapshot().idleCycles).toBe(200);
  });

  it('never runs past the serving level, however large the advance', () => {
    const ledger = new CycleLedger();
    ledger.beginAccess();
    ledger.serve('l2');
    ledger.advance(1_000_000);
    expect(ledger.snapshot().current!.cycles).toBe(12);
    ledger.advance(5);
    expect(ledger.snapshot().current!.cycles).toBe(12);
  });

  it('charges the serving level only, not every level that was checked', () => {
    const ledger = new CycleLedger();
    run(ledger, 'ram', [
      ['l1d', 'miss'],
      ['l2', 'miss'],
    ]);
    expect(ledger.snapshot().idleCycles).toBe(200);
  });
});

describe('CycleLedger — idle and working time', () => {
  it('idle + working === elapsed at every observable moment', () => {
    const ledger = new CycleLedger();
    const seen: LedgerSnapshot[] = [];
    ledger.subscribe((s) => seen.push(s));

    ledger.work('read-card');
    run(ledger, 'l2', [['l1d', 'miss']], 5);
    ledger.work('compute');
    run(ledger, 'registers');
    run(ledger, 'disk', [], 3);

    expect(seen.length).toBeGreaterThan(10);
    for (const s of seen) expect(s.idleCycles + s.workingCycles).toBe(s.elapsedCycles);
  });

  it('idle time grows only inside an open journey served by something slower than registers', () => {
    const ledger = new CycleLedger();
    const idle = () => ledger.snapshot().idleCycles;

    ledger.advance(10); // no journey at all
    expect(idle()).toBe(0);

    ledger.beginAccess();
    ledger.advance(10); // open but nothing serving yet
    expect(idle()).toBe(0);

    ledger.serve('registers');
    ledger.advance(10); // registers cost nothing to wait on
    expect(idle()).toBe(0);
    ledger.complete();
    expect(idle()).toBe(0);

    ledger.beginAccess();
    ledger.serve('l1d');
    ledger.advance(3);
    expect(idle()).toBe(3);
  });

  it('counts the open journey as it grows, and banks it exactly once on completion', () => {
    const ledger = new CycleLedger();
    ledger.beginAccess();
    ledger.serve('ram');
    ledger.advance(50);
    expect(ledger.snapshot().idleCycles).toBe(50);
    ledger.complete();
    expect(ledger.snapshot().idleCycles).toBe(200);
    ledger.complete(); // second complete is a no-op
    expect(ledger.snapshot().idleCycles).toBe(200);
  });

  it('does not double count after complete', () => {
    const ledger = new CycleLedger();
    run(ledger, 'l1d');
    const before = ledger.snapshot();
    ledger.advance(100);
    ledger.advance(100);
    expect(ledger.snapshot()).toEqual(before);
  });

  it('prices work from WORK_CYCLES only', () => {
    const ledger = new CycleLedger();
    ledger.work('compute');
    ledger.work('read-card');
    ledger.work('compute');
    expect(ledger.snapshot().workingCycles).toBe(2 * WORK_CYCLES.compute + WORK_CYCLES['read-card']);
    expect(ledger.snapshot().idleCycles).toBe(0);
  });
});

describe('CycleLedger — probes', () => {
  it('records levels in the order they were checked and de-duplicates repeats', () => {
    const ledger = new CycleLedger();
    ledger.beginAccess();
    ledger.probe('l1d', 'miss');
    ledger.probe('l2', 'miss');
    ledger.probe('l2', 'miss'); // chapter 6 flashes L2 twice
    ledger.probe('l1d', 'miss');
    expect(ledger.snapshot().current!.probes).toEqual([
      { level: 'l1d', result: 'miss' },
      { level: 'l2', result: 'miss' },
    ]);
  });

  it('ignores probes with no open journey, and after the data is on its way', () => {
    const ledger = new CycleLedger();
    ledger.probe('l1d', 'hit');
    expect(ledger.snapshot().current).toBeNull();

    ledger.beginAccess();
    ledger.serve('l2');
    ledger.probe('ram', 'miss');
    expect(ledger.snapshot().current!.probes).toEqual([]);
  });

  it('the first serve wins; the kind can be set once the direction is known', () => {
    const ledger = new CycleLedger();
    ledger.beginAccess('load');
    ledger.serve('l2', 'store');
    ledger.serve('ram');
    const j = ledger.snapshot().current!;
    expect(j.served).toBe('l2');
    expect(j.kind).toBe('store');
  });
});

describe('CycleLedger — lifecycle', () => {
  it('beginAccess closes a served journey but drops one that never was', () => {
    const ledger = new CycleLedger();
    ledger.beginAccess();
    ledger.serve('l1d');
    ledger.beginAccess();
    expect(ledger.history).toHaveLength(1);
    expect(ledger.snapshot().idleCycles).toBe(4);

    ledger.probe('l1d', 'hit'); // never served
    ledger.beginAccess();
    expect(ledger.history).toHaveLength(1);
    expect(ledger.snapshot().idleCycles).toBe(4);
  });

  it('complete on a journey that was never served leaves no wait behind', () => {
    const ledger = new CycleLedger();
    ledger.beginAccess();
    ledger.probe('l1d', 'hit');
    ledger.complete();
    expect(ledger.snapshot().current).toBeNull();
    expect(ledger.snapshot().idleCycles).toBe(0);
  });

  it('numbers journeys sequentially and keeps finished ones in history', () => {
    const ledger = new CycleLedger();
    run(ledger, 'l1d');
    run(ledger, 'ram');
    expect(ledger.history.map((j) => j.id)).toEqual([1, 2]);
    expect(ledger.history.map((j) => j.cycles)).toEqual([4, 200]);
  });

  it('reset drops a partial journey and zeroes everything', () => {
    const ledger = new CycleLedger();
    ledger.work('compute');
    run(ledger, 'l2');
    ledger.beginAccess();
    ledger.serve('ram');
    ledger.advance(80);
    ledger.reset();
    expect(ledger.snapshot()).toEqual({ current: null, idleCycles: 0, workingCycles: 0, elapsedCycles: 0 });
    expect(ledger.history).toHaveLength(0);
    run(ledger, 'l1d');
    expect(ledger.history[0].id).toBe(1);
  });

  it('snapshots are copies: mutating one cannot corrupt the ledger', () => {
    const ledger = new CycleLedger();
    ledger.beginAccess();
    ledger.probe('l1d', 'miss');
    const s = ledger.snapshot();
    s.current!.probes.push({ level: 'ram', result: 'hit' });
    s.current!.cycles = 999;
    expect(ledger.snapshot().current!.probes).toHaveLength(1);
    expect(ledger.snapshot().current!.cycles).toBe(0);
  });

  it('subscribers are told about every change until they unsubscribe', () => {
    const ledger = new CycleLedger();
    let calls = 0;
    const off = ledger.subscribe(() => calls++);
    ledger.beginAccess();
    ledger.probe('l1d', 'miss');
    expect(calls).toBe(2);
    off();
    ledger.serve('ram');
    expect(calls).toBe(2);
  });
});

describe('CycleLedger vs the free-play scoreboard', () => {
  it('reports the same total wait for the same fired sequence', () => {
    const ops: Op[] = ['LOAD', 'ADD', 'STORE'];
    const targets: Target[] = ['l1d', 'l2', 'ram', 'disk', 'random'];
    // A small deterministic generator keeps the 'random' target reproducible.
    let seed = 7;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const ledger = new CycleLedger();
    let board = emptyScoreboard();
    for (let i = 0; i < 60; i++) {
      const outcome = fire(ops[i % ops.length], targets[i % targets.length], rng);
      board = applyOutcome(board, outcome);

      ledger.beginAccess(outcome.op === 'STORE' ? 'store' : 'load');
      ledger.serve(outcome.resolved);
      ledger.advance(outcome.cycles / 2);
      ledger.complete();
    }

    expect(board.fired).toBe(60);
    expect(ledger.snapshot().idleCycles).toBe(board.totalCycles);
    expect(ledger.history).toHaveLength(board.fired);
  });
});
