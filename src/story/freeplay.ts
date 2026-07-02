import { locationOf, type LocationId } from '../scene/locations';

export type Op = 'LOAD' | 'ADD' | 'STORE';
export type Target = LocationId | 'random';

export interface FreePlayOutcome {
  op: Op;
  /** Where the data was actually found. */
  resolved: Exclude<LocationId, 'registers' | 'l1i'>;
  cycles: number;
  hit: boolean;
}

export interface Scoreboard {
  hits: number;
  misses: number;
  totalCycles: number;
  fired: number;
}

export function emptyScoreboard(): Scoreboard {
  return { hits: 0, misses: 0, totalCycles: 0, fired: 0 };
}

/**
 * "Random" mirrors real cache locality so the scoreboard teaches the right
 * lesson: most accesses hit close to the core (research D9).
 */
const RANDOM_WEIGHTS: Array<{ id: FreePlayOutcome['resolved']; weight: number }> = [
  { id: 'l1d', weight: 0.5 },
  { id: 'l2', weight: 0.25 },
  { id: 'ram', weight: 0.2 },
  { id: 'disk', weight: 0.05 },
];

export type Rng = () => number; // [0, 1)

export function resolveTarget(target: Target, rng: Rng): FreePlayOutcome['resolved'] {
  if (target !== 'random') {
    if (target === 'registers' || target === 'l1i') {
      throw new Error(`Free play targets data locations only, got "${target}"`);
    }
    return target;
  }
  const roll = rng();
  let acc = 0;
  for (const { id, weight } of RANDOM_WEIGHTS) {
    acc += weight;
    if (roll < acc) return id;
  }
  return 'disk';
}

/** A hit means the data was already on the closest shelf: L1d. */
export function fire(op: Op, target: Target, rng: Rng): FreePlayOutcome {
  const resolved = resolveTarget(target, rng);
  return {
    op,
    resolved,
    cycles: locationOf(resolved).latencyCycles,
    hit: resolved === 'l1d',
  };
}

export function applyOutcome(board: Scoreboard, outcome: FreePlayOutcome): Scoreboard {
  return {
    hits: board.hits + (outcome.hit ? 1 : 0),
    misses: board.misses + (outcome.hit ? 0 : 1),
    totalCycles: board.totalCycles + outcome.cycles,
    fired: board.fired + 1,
  };
}
