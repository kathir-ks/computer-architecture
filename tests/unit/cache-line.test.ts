import { describe, expect, it } from 'vitest';
import { CacheLineSim } from '../../src/sim/cacheLine';

describe('CacheLineSim', () => {
  it('starts cold: nothing is resident', () => {
    const sim = new CacheLineSim();
    expect(sim.cells).toBe(16);
    expect(sim.lineSize).toBe(4);
    expect(sim.resident.every((r) => !r)).toBe(true);
  });

  it('a cold access misses and fills its whole aligned line', () => {
    const sim = new CacheLineSim();
    const r = sim.access(5);
    expect(r).toEqual({ hit: false, filled: [4, 5, 6, 7] });
    expect(sim.resident.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual([4, 5, 6, 7]);
  });

  it('the neighbours of a fetched cell then hit, before and after it in the line', () => {
    const sim = new CacheLineSim();
    sim.access(5);
    for (const i of [4, 6, 7]) expect(sim.access(i).hit).toBe(true);
  });

  it('a cell in another line is still a miss', () => {
    const sim = new CacheLineSim();
    sim.access(5);
    expect(sim.access(8).hit).toBe(false);
    expect(sim.access(3).hit).toBe(false);
  });

  it('a hit never changes residency', () => {
    const sim = new CacheLineSim();
    sim.access(0);
    const before = sim.resident;
    const r = sim.access(2);
    expect(r).toEqual({ hit: true, filled: [] });
    expect(sim.resident).toEqual(before);
  });

  it('accessing a resident cell is always a hit, however many times', () => {
    const sim = new CacheLineSim();
    sim.access(9);
    for (let n = 0; n < 5; n++) expect(sim.access(9).hit).toBe(true);
  });

  it('lines are aligned: cell 3 and cell 4 are in different lines', () => {
    const sim = new CacheLineSim();
    expect(sim.access(3).filled).toEqual([0, 1, 2, 3]);
    expect(sim.access(4).filled).toEqual([4, 5, 6, 7]);
  });

  it('fills the whole strip with cells/lineSize misses, one per line', () => {
    const sim = new CacheLineSim();
    let misses = 0;
    for (let i = 0; i < sim.cells; i++) if (!sim.access(i).hit) misses++;
    expect(misses).toBe(4);
    expect(sim.resident.every(Boolean)).toBe(true);
  });

  it('reset clears residency so the same cell misses again', () => {
    const sim = new CacheLineSim();
    sim.access(5);
    sim.reset();
    expect(sim.resident.every((r) => !r)).toBe(true);
    expect(sim.access(5).hit).toBe(false);
  });

  it('works with other sizes, and a short final line', () => {
    const sim = new CacheLineSim(10, 4);
    expect(sim.access(9).filled).toEqual([8, 9]);
    expect(sim.lineOf(0)).toEqual([0, 1, 2, 3]);
  });

  it('refuses cells outside the strip and silly sizes', () => {
    const sim = new CacheLineSim();
    expect(() => sim.access(-1)).toThrow(RangeError);
    expect(() => sim.access(16)).toThrow(RangeError);
    expect(() => sim.access(1.5)).toThrow(RangeError);
    expect(() => new CacheLineSim(0)).toThrow(RangeError);
    expect(() => new CacheLineSim(16, 0)).toThrow(RangeError);
  });

  it('the resident list is a copy: editing it cannot corrupt the model', () => {
    const sim = new CacheLineSim();
    sim.resident[3] = true;
    expect(sim.access(3).hit).toBe(false);
  });
});
