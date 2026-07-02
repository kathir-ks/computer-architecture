import { describe, expect, it } from 'vitest';
import {
  applyOutcome,
  emptyScoreboard,
  fire,
  resolveTarget,
} from '../../src/story/freeplay';
import { locationOf } from '../../src/scene/locations';

/** Deterministic LCG for seeded tests. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('free play', () => {
  it('explicit targets resolve to themselves', () => {
    const rng = seededRng(1);
    for (const t of ['l1d', 'l2', 'ram', 'disk'] as const) {
      expect(resolveTarget(t, rng)).toBe(t);
    }
  });

  it('rejects non-data targets', () => {
    const rng = seededRng(1);
    expect(() => resolveTarget('registers', rng)).toThrow();
    expect(() => resolveTarget('l1i', rng)).toThrow();
  });

  it('cycles always equal the latency table value (SC-006)', () => {
    const rng = seededRng(42);
    for (const t of ['l1d', 'l2', 'ram', 'disk'] as const) {
      const o = fire('LOAD', t, rng);
      expect(o.cycles).toBe(locationOf(t).latencyCycles);
    }
  });

  it('hit iff resolved in L1d', () => {
    const rng = seededRng(7);
    expect(fire('LOAD', 'l1d', rng).hit).toBe(true);
    expect(fire('ADD', 'l2', rng).hit).toBe(false);
    expect(fire('STORE', 'ram', rng).hit).toBe(false);
    expect(fire('LOAD', 'disk', rng).hit).toBe(false);
  });

  it('random follows the locality weights (seeded distribution)', () => {
    const rng = seededRng(1234);
    const counts: Record<string, number> = { l1d: 0, l2: 0, ram: 0, disk: 0 };
    const N = 10_000;
    for (let i = 0; i < N; i++) counts[resolveTarget('random', rng)]++;
    expect(counts.l1d / N).toBeGreaterThan(0.45);
    expect(counts.l1d / N).toBeLessThan(0.55);
    expect(counts.l2 / N).toBeGreaterThan(0.2);
    expect(counts.disk / N).toBeGreaterThan(0.02);
    expect(counts.disk / N).toBeLessThan(0.09);
    expect(counts.l1d + counts.l2 + counts.ram + counts.disk).toBe(N);
  });

  it('scoreboard math adds up', () => {
    const rng = seededRng(9);
    let board = emptyScoreboard();
    const outcomes = [
      fire('LOAD', 'l1d', rng),
      fire('LOAD', 'ram', rng),
      fire('STORE', 'l1d', rng),
      fire('ADD', 'disk', rng),
    ];
    for (const o of outcomes) board = applyOutcome(board, o);
    expect(board.fired).toBe(4);
    expect(board.hits).toBe(2);
    expect(board.misses).toBe(2);
    expect(board.totalCycles).toBe(4 + 200 + 4 + 4_000_000);
  });
});
