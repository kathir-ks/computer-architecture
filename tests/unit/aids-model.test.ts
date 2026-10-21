import { describe, expect, it } from 'vitest';
import { idleView, meterView, percentText } from '../../src/ui/aidsModel';
import { CycleLedger, type LedgerSnapshot } from '../../src/scene/telemetry/ledger';
import { locationOf, type LocationId } from '../../src/scene/locations';

const empty: LedgerSnapshot = { current: null, idleCycles: 0, workingCycles: 0, elapsedCycles: 0 };

describe('cycle meter view', () => {
  it('is idle before anything has happened', () => {
    expect(meterView(empty)).toMatchObject({ state: 'idle', cycles: 0 });
  });

  it('is "checking" while levels are probed and nothing is moving yet', () => {
    const l = new CycleLedger();
    l.beginAccess();
    l.probe('l1d', 'miss');
    expect(meterView(l.snapshot())).toMatchObject({ state: 'checking', cycles: 0 });
  });

  it('runs while data moves and says who it is waiting on', () => {
    const l = new CycleLedger();
    l.beginAccess();
    l.serve('ram');
    l.advance(75);
    expect(meterView(l.snapshot())).toEqual({ state: 'running', cycles: 75, note: 'Waiting on RAM' });
  });

  it.each([
    ['l1d', 4, 'L1 cache'],
    ['l2', 12, 'L2 cache'],
    ['ram', 200, 'RAM'],
    ['disk', 4_000_000, 'Disk'],
  ] as const)('ends on exactly the latency of %s', (level: LocationId, cycles, label) => {
    const l = new CycleLedger();
    l.beginAccess();
    l.serve(level);
    l.advance(1);
    l.complete();
    const m = meterView(l.snapshot());
    expect(m).toEqual({ state: 'done', cycles: locationOf(level).latencyCycles, note: `served by ${label}` });
    expect(m.cycles).toBe(cycles);
  });

  it('words a store differently from a load', () => {
    const l = new CycleLedger();
    l.beginAccess('store');
    l.serve('l2', 'store');
    expect(meterView(l.snapshot()).note).toBe('Storing in L2 cache');
    l.complete();
    expect(meterView(l.snapshot()).note).toBe('stored in L2 cache');
  });

  it('resets per access: a new journey starts from zero again', () => {
    const l = new CycleLedger();
    l.beginAccess();
    l.serve('ram');
    l.complete();
    l.beginAccess();
    expect(meterView(l.snapshot()).cycles).toBe(0);
  });
});

describe('idle vs working view', () => {
  it('has no share before anything happens', () => {
    expect(idleView(empty)).toEqual({ idle: 0, working: 0, elapsed: 0, idleShare: 0 });
  });

  it('idle + working === elapsed, and the share is idle / elapsed', () => {
    const l = new CycleLedger();
    l.beginAccess();
    l.serve('ram');
    l.complete();
    l.work('compute');
    const v = idleView(l.snapshot());
    expect(v.idle + v.working).toBe(v.elapsed);
    expect(v.elapsed).toBe(201);
    expect(v.idleShare).toBeCloseTo(200 / 201);
  });

  it('is all work when nothing waited', () => {
    const l = new CycleLedger();
    l.work('compute');
    expect(idleView(l.snapshot()).idleShare).toBe(0);
  });
});

describe('percentText', () => {
  it('words the extremes instead of rounding them into a lie', () => {
    expect(percentText(0)).toBe('0%');
    expect(percentText(1)).toBe('100%');
    expect(percentText(200 / 201)).toBe('99.5%');
    expect(percentText(4_000_200 / 4_000_201)).toBe('>99.9%');
    expect(percentText(1 / 4_000_201)).toBe('<0.1%');
  });

  it('shows ordinary values to one decimal place', () => {
    expect(percentText(0.5)).toBe('50.0%');
    expect(percentText(0.125)).toBe('12.5%');
  });
});
