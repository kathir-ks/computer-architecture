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
  /** Short beats: flashes, drawer opens, card split. */
  beat: 0.7,

  // ---- v2: camera rig ----
  /** Cinematic: extra seconds the camera spends easing to rest after arriving. */
  camSettle: 0.45,
  /** Cinematic: field-of-view push (degrees) at arrival, eased back out. */
  camFovPush: 3,
  /** Follow: how quickly the camera closes on the tracked pulse (1/s, higher = snappier). */
  followRate: 2.6,
  /** Worker first-person view: seconds to move into / out of the seat. */
  workerEnter: 1.1,
  workerExit: 0.9,

  // ---- v2: look & feedback ----
  /** X-ray: seconds for the walls to fade out / in. */
  xrayFade: 0.6,
  /** Pulse trails: seconds a trail sample lives, and max samples per trail. */
  trailLife: 0.7,
  trailSamples: 28,
  /** Hit ring-burst and miss shudder durations. */
  hitBurst: 0.55,
  missShudder: 0.5,
  /** Pulse launch wind-up (shrink) and arrival settle (overshoot). */
  launchWindup: 0.18,
  arriveSettle: 0.22,
  /** Lift: dip before leaving, ease-out settle after arriving. */
  liftAnticipation: 0.18,
  liftSettle: 0.25,

  // ---- v2: live aids ----
  /** Cycle meter tween ease (GSAP ease name). */
  meterEase: 'power1.inOut',

  // ---- v2: pipelining ----
  /** One pipeline tick on screen. */
  pipelineTick: 0.9,
  /** A long memory wait is shown as this many ticks, with the real figure annotated. */
  pipelineStallShown: 5,
  /** The clerks walk in from the lift / leave again. */
  pipelineClerkWalk: 1.4,
  /** A card sliding from one station to the next, as a share of one tick. */
  pipelineSlideShare: 0.62,
  /** A fast-forwarded run plays each tick at this share of its normal length. */
  pipelineFastShare: 0.4,
} as const;

/** Seconds for the lift to travel between two floors. */
export function liftDuration(fromFloor: number, toFloor: number): number {
  return TIMING.liftBase + TIMING.liftPerFloor * Math.abs(fromFloor - toFloor);
}
