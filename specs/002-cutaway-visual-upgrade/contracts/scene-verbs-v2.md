# Contract Delta: SceneVerbs v2 — `follow`

The living contract remains [001/contracts/scene-verbs.md](../../001-cpu-building-story/contracts/scene-verbs.md); this file records what feature 002 adds. Per repo rule, three artifacts change in lockstep: the `SceneVerbs` interface (`src/scene/index.ts`), the 001 contract doc, and `CONTRACT_VERBS` in `tests/unit/cue-integrity.test.ts`.

## New verb

```ts
export type FollowTarget = 'courier' | 'lift' | PulseId;

export interface SceneVerbs {
  // ... all v1 verbs unchanged ...

  // ---- camera ----
  /**
   * Keep the camera aimed at a moving element for a bounded duration.
   * Aim-only: eases controls.target toward the element each update; camera
   * position is not animated. Killed instantly by user pointerdown, and by
   * any subsequent flyTo/follow (single scripted-camera slot).
   * If a PulseId target is disposed mid-follow, aim freezes at its last
   * position for the remaining duration.
   */
  follow(target: FollowTarget, opts?: { duration?: number }): Timeline;
}
```

Default `duration`: `TIMING.follow` (new constant in `scene/timing.ts`). Chapters that wrap a trip supply the trip's own duration (e.g. courier trip length) so follow and journey end together.

## Guarantees (additions to the v1 list)

5. **Single camera owner**: `flyTo` and `follow` share one scripted-camera slot; starting either kills the other. User grab kills whichever holds the slot. Story code never needs to cancel camera verbs explicitly.
6. **Pause-safe like all verbs**: follow's aim updates are driven by its returned timeline's tween; pausing the parent step timeline freezes the aim.
7. **Disposal-safe**: following a pulse that gets `deliver`ed is legal (FR-011); no error, aim settles at the delivery point.

## Changed behavioral guarantees (no signature changes)

- **Viewing arc**: user orbit is clamped to a front arc (azimuth ≈ ±80° from the open face, polar ≈ 0.15π–0.52π). All `VantageId` positions lie inside the arc. `flyTo`/`follow` semantics are otherwise unchanged.
- **Mood**: `setMood` now also tints the hemisphere light; same keys, same signature, daylight color set.
- **Visibility**: `carry` cargo is visible for the entire ride from any angle within the arc (front-face glass lift tube).

## Explicit non-changes

- All v1 verb signatures, `VantageId` names, `LocationId`/`HighlightId` sets, latency constants, and UI contracts (panel ↔ engine) are unchanged.
- Environment (`Environment.ts`) exposes **no verbs** — it is not part of this contract and story code cannot reference it.
