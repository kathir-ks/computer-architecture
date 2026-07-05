/** All pacing constants in one place so the story's feel is tunable without touching chapters. */

export const TIMING = {
  /** Lift: base seconds + per-floor seconds (contract: 0.6 + 0.35 × floors). */
  liftBase: 0.6,
  liftPerFloor: 0.35,
  /** Courier round trip to the warehouse, full and fast-forwarded. */
  courierTrip: 12,
  courierTripFast: 3,
  /** Default camera fly-to duration. */
  flyTo: 1.6,
  /** Default camera follow duration (chapters usually pass the trip's own). */
  follow: 3,
  /** Short beats: flashes, drawer opens, card split. */
  beat: 0.7,
} as const;

/** Seconds for the lift to travel between two floors. */
export function liftDuration(fromFloor: number, toFloor: number): number {
  return TIMING.liftBase + TIMING.liftPerFloor * Math.abs(fromFloor - toFloor);
}
