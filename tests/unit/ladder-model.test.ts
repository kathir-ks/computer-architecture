import { describe, expect, it } from 'vitest';
import { barFraction, formatCycles, RUNGS, rungStates } from '../../src/ui/ladderModel';
import { FLOOR_ROLES, isSpareFloor } from '../../src/scene/floorRoles';
import { locationOf, LOCATIONS } from '../../src/scene/locations';
import type { AccessJourney } from '../../src/scene/telemetry/ledger';

const journey = (over: Partial<AccessJourney> = {}): AccessJourney => ({
  id: 1,
  kind: 'load',
  probes: [],
  served: null,
  cycles: 0,
  done: false,
  ...over,
});

describe('latency scale rungs', () => {
  it('lists the five levels top to bottom, registers first and disk last', () => {
    expect(RUNGS.map((r) => r.id)).toEqual(['registers', 'l1', 'l2', 'ram', 'disk']);
  });

  it('takes every number from locations.ts — never a separate copy', () => {
    for (const rung of RUNGS) {
      for (const level of rung.levels) expect(locationOf(level).latencyCycles).toBe(rung.cycles);
    }
    expect(RUNGS.map((r) => r.cycles)).toEqual([0, 4, 12, 200, 4_000_000]);
  });

  it('covers every location exactly once', () => {
    const covered = RUNGS.flatMap((r) => r.levels).sort();
    expect(covered).toEqual(LOCATIONS.map((l) => l.id).sort());
  });

  it('formats cycle counts with thousands separators', () => {
    expect(formatCycles(0)).toBe('0');
    expect(formatCycles(200)).toBe('200');
    expect(formatCycles(4_000_000)).toBe('4,000,000');
    expect(formatCycles(12.4)).toBe('12');
  });

  it('draws bars on a log scale: strictly growing, zero to one, and readable for the small levels', () => {
    const f = RUNGS.map((r) => barFraction(r.cycles));
    expect(f[0]).toBe(0);
    expect(f.at(-1)).toBeCloseTo(1);
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeGreaterThan(f[i - 1]);
    // On a linear axis L1 would be a thousandth of a bar; here it is still visible.
    expect(f[1]).toBeGreaterThan(0.05);
  });
});

describe('which rung is lit', () => {
  it('everything is idle with no journey', () => {
    expect(Object.values(rungStates(null))).toEqual(['idle', 'idle', 'idle', 'idle', 'idle']);
  });

  it('marks misses as checked and the serving level as current while data moves', () => {
    const s = rungStates(
      journey({
        probes: [
          { level: 'l1d', result: 'miss' },
          { level: 'l2', result: 'miss' },
        ],
        served: 'ram',
      }),
    );
    expect(s).toEqual({ registers: 'idle', l1: 'checked-miss', l2: 'checked-miss', ram: 'current', disk: 'idle' });
  });

  it('turns current into served once the journey is complete', () => {
    const s = rungStates(journey({ served: 'ram', done: true, cycles: 200 }));
    expect(s.ram).toBe('served');
  });

  it('shows a hit before the data starts moving', () => {
    expect(rungStates(journey({ probes: [{ level: 'l1d', result: 'hit' }] })).l1).toBe('checked-hit');
  });

  it('the L1 rung answers to either L1 cache', () => {
    expect(rungStates(journey({ probes: [{ level: 'l1i', result: 'hit' }] })).l1).toBe('checked-hit');
    expect(rungStates(journey({ served: 'l1i' })).l1).toBe('current');
    expect(rungStates(journey({ served: 'l1d', done: true })).l1).toBe('served');
  });

  it('serving wins over an earlier probe of the same rung', () => {
    const s = rungStates(journey({ probes: [{ level: 'l1d', result: 'hit' }], served: 'l1d' }));
    expect(s.l1).toBe('current');
  });

  it('a store to disk lights the disk rung', () => {
    expect(rungStates(journey({ kind: 'store', served: 'disk' })).disk).toBe('current');
  });
});

describe('floor roles', () => {
  it('labels every floor from 10 down to 1 exactly once', () => {
    expect(FLOOR_ROLES.map((r) => r.floor)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('gives every floor that holds a memory level a real role, and no other floor claims to', () => {
    const memoryFloors = new Set(LOCATIONS.map((l) => l.floor).filter((f): f is number => typeof f === 'number'));
    for (const { floor } of FLOOR_ROLES) {
      if (memoryFloors.has(floor)) expect(isSpareFloor(floor)).toBe(false);
    }
    expect(isSpareFloor(7)).toBe(true);
    expect(isSpareFloor(10)).toBe(false);
  });
});
