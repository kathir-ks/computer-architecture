import { locationOf, LOCATIONS, type LocationId } from '../scene/locations';
import type { AccessJourney } from '../scene/telemetry/ledger';

/** The five rungs a learner thinks in. L1 instruction and data caches share one rung (same latency). */
export type RungId = 'registers' | 'l1' | 'l2' | 'ram' | 'disk';

export interface Rung {
  id: RungId;
  label: string;
  /** The scene locations that belong to this rung. */
  levels: readonly LocationId[];
  /** Read from locations.ts — never typed in here. */
  cycles: number;
}

const GROUPS: ReadonlyArray<{ id: RungId; label: string; levels: readonly LocationId[] }> = [
  { id: 'registers', label: 'Registers', levels: ['registers'] },
  { id: 'l1', label: 'L1 cache', levels: ['l1i', 'l1d'] },
  { id: 'l2', label: 'L2 cache', levels: ['l2'] },
  { id: 'ram', label: 'RAM', levels: ['ram'] },
  { id: 'disk', label: 'Disk', levels: ['disk'] },
];

export const RUNGS: readonly Rung[] = GROUPS.map((g) => ({ ...g, cycles: locationOf(g.levels[0]).latencyCycles }));

const MAX_CYCLES = Math.max(...LOCATIONS.map((l) => l.latencyCycles));

/** 4000000 → "4,000,000". Fixed locale so the scale reads the same everywhere. */
export function formatCycles(cycles: number): string {
  return Math.round(cycles).toLocaleString('en-US');
}

/**
 * How long a rung's bar is, 0–1. Logarithmic: on a linear axis everything but the disk would be invisible,
 * which is true to life but useless for a diagram. The numbers beside the bars carry the real ratio.
 */
export function barFraction(cycles: number): number {
  if (cycles <= 0) return 0;
  return Math.log10(1 + cycles) / Math.log10(1 + MAX_CYCLES);
}

export type RungState = 'idle' | 'checked-miss' | 'checked-hit' | 'served' | 'current';

/**
 * Where each rung stands in the current journey:
 *  current       the data is travelling from / to this rung right now
 *  served        it supplied (or took) the data and the trip is over
 *  checked-hit   looked on this shelf and found it (data not yet moving)
 *  checked-miss  looked on this shelf and it wasn't there
 */
export function rungStates(journey: AccessJourney | null): Record<RungId, RungState> {
  const out = {} as Record<RungId, RungState>;
  for (const rung of RUNGS) {
    let state: RungState = 'idle';
    if (journey) {
      const probe = journey.probes.find((p) => rung.levels.includes(p.level));
      if (probe) state = probe.result === 'miss' ? 'checked-miss' : 'checked-hit';
      if (journey.served && rung.levels.includes(journey.served)) state = journey.done ? 'served' : 'current';
    }
    out[rung.id] = state;
  }
  return out;
}
