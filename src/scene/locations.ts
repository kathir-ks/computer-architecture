/** Memory levels of the building world — single source of truth for latency numbers. */

export type LocationId = 'registers' | 'l1i' | 'l1d' | 'l2' | 'ram' | 'disk';

export interface Location {
  id: LocationId;
  label: string;
  floor: number | 'outside';
  latencyCycles: number;
}

export const LOCATIONS: readonly Location[] = [
  { id: 'registers', label: 'Registers', floor: 10, latencyCycles: 0 },
  { id: 'l1i', label: 'L1 instruction cache', floor: 9, latencyCycles: 4 },
  { id: 'l1d', label: 'L1 data cache', floor: 9, latencyCycles: 4 },
  { id: 'l2', label: 'L2 cache', floor: 8, latencyCycles: 12 },
  { id: 'ram', label: 'RAM', floor: 4, latencyCycles: 200 },
  { id: 'disk', label: 'Disk', floor: 'outside', latencyCycles: 4_000_000 },
] as const;

export const LOCATION_BY_ID: ReadonlyMap<LocationId, Location> = new Map(
  LOCATIONS.map((l) => [l.id, l]),
);

export function locationOf(id: LocationId): Location {
  const loc = LOCATION_BY_ID.get(id);
  if (!loc) throw new Error(`Unknown location id: ${id}`);
  return loc;
}

/**
 * Cycles of real work a Worker task costs. Deliberately tiny next to the memory latencies above:
 * the contrast between working and waiting is the whole lesson.
 */
export const WORK_CYCLES = { compute: 1, 'read-card': 1 } as const;
export type WorkCycleKind = keyof typeof WORK_CYCLES;

/** Extra highlightable scene elements that are not memory levels. */
export const SCENE_ELEMENT_IDS = ['worker', 'pc', 'lift', 'courier', 'pipeline'] as const;
export type SceneElementId = (typeof SCENE_ELEMENT_IDS)[number];

/** Every id the highlight system / narration markers may reference. */
export type HighlightId = LocationId | SceneElementId;

export const ALL_HIGHLIGHT_IDS: readonly HighlightId[] = [
  ...LOCATIONS.map((l) => l.id),
  ...SCENE_ELEMENT_IDS,
];
