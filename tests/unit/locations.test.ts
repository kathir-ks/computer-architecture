import { describe, expect, it } from 'vitest';
import {
  ALL_HIGHLIGHT_IDS,
  LOCATIONS,
  LOCATION_BY_ID,
  locationOf,
  WORK_CYCLES,
} from '../../src/scene/locations';
import { liftDuration, TIMING } from '../../src/scene/timing';

describe('location table', () => {
  it('contains every LocationId exactly once', () => {
    const ids = LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(['disk', 'l1d', 'l1i', 'l2', 'ram', 'registers']);
  });

  it('keeps the latency ordering of the hierarchy', () => {
    const c = (id: Parameters<typeof locationOf>[0]) => locationOf(id).latencyCycles;
    expect(c('registers')).toBeLessThan(c('l1d'));
    expect(c('l1d')).toBeLessThan(c('l2'));
    expect(c('l2')).toBeLessThan(c('ram'));
    expect(c('ram')).toBeLessThan(c('disk'));
  });

  it('matches the spec latency figures', () => {
    expect(locationOf('l1d').latencyCycles).toBe(4);
    expect(locationOf('l2').latencyCycles).toBe(12);
    expect(locationOf('ram').latencyCycles).toBe(200);
    expect(locationOf('disk').latencyCycles).toBe(4_000_000);
  });

  it('places locations on the designed floors', () => {
    expect(locationOf('registers').floor).toBe(10);
    expect(locationOf('l1i').floor).toBe(9);
    expect(locationOf('l1d').floor).toBe(9);
    expect(locationOf('l2').floor).toBe(8);
    expect(locationOf('ram').floor).toBe(4);
    expect(locationOf('disk').floor).toBe('outside');
  });

  it('exposes a complete lookup map and highlight id list', () => {
    expect(LOCATION_BY_ID.size).toBe(LOCATIONS.length);
    for (const l of LOCATIONS) expect(ALL_HIGHLIGHT_IDS).toContain(l.id);
    expect(ALL_HIGHLIGHT_IDS).toContain('worker');
    expect(new Set(ALL_HIGHLIGHT_IDS).size).toBe(ALL_HIGHLIGHT_IDS.length);
  });
});

describe('work cost', () => {
  it('is tiny next to the closest memory wait, so waiting dominates', () => {
    for (const cycles of Object.values(WORK_CYCLES)) {
      expect(cycles).toBeGreaterThan(0);
      expect(cycles).toBeLessThan(locationOf('l1d').latencyCycles);
    }
  });

  it('prices exactly the two kinds of work that cost cycles', () => {
    expect(Object.keys(WORK_CYCLES).sort()).toEqual(['compute', 'read-card']);
  });
});

describe('timing', () => {
  it('lift duration follows the contract formula', () => {
    expect(liftDuration(10, 9)).toBeCloseTo(TIMING.liftBase + TIMING.liftPerFloor);
    expect(liftDuration(10, 4)).toBeCloseTo(TIMING.liftBase + 6 * TIMING.liftPerFloor);
    expect(liftDuration(4, 10)).toBeCloseTo(liftDuration(10, 4));
  });
});
