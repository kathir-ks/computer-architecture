# Research: Cutaway Visual Upgrade (v2)

No NEEDS CLARIFICATION markers remained in the Technical Context (stack is inherited from 001 and the brainstorming session settled scope). Research below records the technical decisions behind each workstream, with alternatives considered.

## R1. Occlusion strategy: true cutaway + clamped orbit

**Decision**: Keep the building's already-open +z face as the single viewing face. Remove the per-floor dark filler blocks, dress every floor as an open room, and clamp `OrbitControls` to a front arc: `minAzimuthAngle/maxAzimuthAngle ≈ ∓80°` (measured from +z) and keep a polar clamp (`maxPolarAngle ≈ 0.52π`, slightly tightened at the low end via `minPolarAngle ≈ 0.15π` so the camera can't go fully top-down where slabs occlude).

**Rationale**: v1 audit showed the front face is open already (`Building.ts` comment "front face +z is open — the cutaway"); occlusion comes from (a) unclamped azimuth letting users orbit behind the back wall, (b) dark filler boxes standing in for undressed floors, (c) near-top-down angles where slabs hide interiors. Solving by construction costs zero per-frame work — critical for the software-rasterizer smoke environment and integrated GPUs (constitution V).

**Alternatives considered**:
- *Dynamic wall fading (raycast + transparency)* — rejected: per-frame raycasts, transparency sorting artifacts, shimmering walls fight the "friendly" goal, and it's the exact workload that hurts headless Chromium.
- *Interior tracking camera* — rejected as foundation: near-plane clipping through props, motion-sickness risk, conflicts with user-grab rule; its useful part (tracking) is captured by the `follow` verb from outside (R3).

## R2. OrbitControls clamping behavior

**Decision**: Use OrbitControls' built-in `minAzimuthAngle`/`maxAzimuthAngle`/`minPolarAngle`/`maxPolarAngle` with damping left on (`dampingFactor 0.08`).

**Rationale**: Built-in clamps are hard limits applied inside `controls.update()`; with damping enabled the stop eases out rather than snapping, satisfying the spec's "smooth boundary, not a snap" edge case. No custom control code needed.

**Alternatives considered**: custom spherical-coordinate clamping in a frame callback — rejected, reimplements what OrbitControls already does and risks fighting damping.

## R3. `follow` verb implementation

**Decision**: `follow(target, opts?)` returns a GSAP timeline whose single tween drives a progress proxy `{t: 0→1}` over the duration; an `onUpdate` handler lerps `controls.target` toward the followed object's current world position (lerp factor ~0.08 per update for smoothness). Target resolution: `'courier'` → van group, `'lift'` → car mesh, `PulseId` → pulse mesh (fallback to last-known position if disposed, per FR-011). The timeline registers with the same `activeCameraTl` slot used by `flyTo`, so the user-grab kill switch works unchanged.

**Rationale**: Returning a real GSAP timeline keeps the verb pause-safe and sequence-able (contract guarantee 2: pausing the parent step timeline freezes it, because the proxy tween stops firing onUpdate). Reusing `activeCameraTl` gives grab-cancel for free and guarantees `flyTo` and `follow` never fight — starting either kills the other. Camera *position* is not animated by follow; only the aim (`controls.target`) tracks, which keeps the shot stable and avoids sickness.

**Alternatives considered**:
- *gsap.ticker callback outside a timeline* — rejected: not pause-safe, needs bespoke lifecycle, violates "all motion lives in returned timelines".
- *Animating camera position along a parallel path* — deferred: aim-tracking alone meets SC-004 (element within central two-thirds of frame); position dollying can be added later inside the same verb without contract change.

## R4. Pastel daylight palette & lighting

**Decision**: Single `PALETTE` constant in `Building.ts` (extending the existing `COL` object) built around: warm light sky `#dfe9f3`-family background/fog; floor-function hues — desk floor warm cream, L1 shelves mint, L2 storeroom soft teal, RAM archive lavender-blue, empty floors neutral warm grey, warehouse muted terracotta; structure (slabs/walls) light neutral. Actors keep high saturation: worker/courier/pulses/lift-car re-tinted vivid against pastel. Lighting: hemisphere light sky-blue/ground-warm at higher intensity, key directional warm white ~1.2, plus a soft fill from the front so open rooms aren't in their own shadow. No shadow maps (perf, constitution V). Flash colors re-picked for pastel contrast: hit `#0faf6e` (darker green), miss `#e02f4f`, focus `#1a6ff0` — three signals remain distinct on light surfaces (v1's neon values were tuned for black).

**Rationale**: Darker, saturated signal colors read on light backgrounds where v1's bright neons wash out. Keeping all colors in the existing single-source constants preserves the 001 pattern (colors in `Building.ts` COL / module-local constants, pacing in `timing.ts`).

**Alternatives considered**: HDR environment/IBL textures — rejected (procedural-only constraint); shadow maps for realism — rejected (perf on integrated graphics; user chose environment-life realism, not lighting realism).

## R5. Moods as daylight variants

**Decision**: Re-tune the four `MOODS` background/fog colors: intro = golden-hour warm, working = neutral daylight, tense-miss = overcast dusk with a red-violet cast, celebration = warm bright. Same `setMood` API and 1.2 s transitions; additionally tween the hemisphere light color per mood (small extension inside the scene layer, no contract change).

**Rationale**: Mood must survive the daylight flip (FR-007) and background-only tinting is too subtle on a light sky; tinting the hemisphere light carries the mood into room interiors cheaply.

## R6. Lift as glass tube on the open face

**Decision**: Move the shaft from `LIFT_X` at building-center depth to the front edge (z ≈ +BLD_D/2 − 0.6) as a cylinder-ish transparent tube: `MeshStandardMaterial` with `transparent: true, opacity ~0.15, depthWrite: false`, plus edge lines. Car and pulse ride inside; `carry`'s three-phase choreography (slide in, ride, slide out) and `liftDuration` latency mapping are unchanged. `anchorFor('lift')` and click wiring stay valid (car remains the click target).

**Rationale**: FR-003 requires cargo visible for the whole ride from anywhere in the arc; a front-face glass tube guarantees it geometrically. `depthWrite: false` on one convex transparent shell avoids the classic transparency-sorting artifacts.

**Alternatives considered**: keeping the shaft mid-building and cutting slab notches — rejected: still occluded at arc-edge angles; more geometry work for a worse result.

## R7. Environment set & animation budget

**Decision**: New `Environment.ts` builds: 5–7 low-poly neighbor buildings (boxes with pastel facades + simple window insets) flanking the road, 8–12 trees (cylinder trunk + icosahedron/cone canopy), 4–6 streetlights (pole + small emissive head) along the road, 4–6 clouds (2–3 merged stretched spheres each, flat white, slight opacity). Static props are merged into few geometries where material-compatible (`BufferGeometryUtils.mergeGeometries`, ships with three) to hold the added draw calls at ≤ ~60. Clouds live in one group; a single `world.onFrame` callback advances their x-position and wraps them (constant slow speed, no per-cloud tweens). Nothing registers with `addClickable`; nothing imports story or sync modules.

**Rationale**: Meets FR-013 (alive but inert), constitution III (procedural only) and V (bounded cost; one frame callback, no allocations per frame). GSAP is not needed for an infinite drift loop — the constitution's "no ad-hoc rAF outside the scene layer" rule is satisfied because `World.onFrame` *is* the scene layer's sanctioned loop.

**Alternatives considered**: instanced meshes — unnecessary at this object count; animated cars/pedestrians — rejected for v2 (YAGNI, attention competition with the story; can be a later polish).

## R8. Bloom under daylight

**Decision**: Keep the `Neon` composer path and quality toggle exactly as-is, but drop bloom strength (~0.35) and raise the luminance threshold so only genuinely emissive actors (pulses, lift car, streetlight heads, highlight glows) bloom — pastel surfaces must stay crisp. `?lowq` and fps-watchdog behavior untouched.

**Rationale**: Bloom no longer carries the aesthetic; it becomes an accent for the attention system (FR-006). Retuning constants is lower-risk than removing the pipeline (which the highlight glow and celebration moments still use).

## R9. Chapter retune scope

**Decision**: For each of ch1–ch8: update nothing but cue-function bodies — swap/retarget `flyTo` vantages (same `VantageId` names, coordinates re-tuned centrally in `VANTAGES`), and wrap long trips with `follow`: courier trips in the RAM-miss/disk chapters, multi-floor carries (e.g. RAM→L2→L1 promotions). Cue *count* per chapter is frozen (narration pairing invariant); `follow` calls are added inside existing cues' timelines, not as new cues.

**Rationale**: `makeChapter` throws if paragraph count ≠ cue count, and the spec freezes narration; composing follow into existing cue timelines is the only shape that needs no script.ts edits. Since `VANTAGES` coordinates live in `index.ts`, most reframing is data-only.

## R10. Testing strategy for camera work

**Decision**: New `tests/unit/camera-arc.test.ts`: (a) assert every `VANTAGES` entry's position lies within the allowed azimuth/polar arc relative to its target (pure math, no renderer); (b) follow lifecycle against stubbed GSAP/objects — starting follow kills prior camera timeline, grab kills follow, disposed-target fallback settles at last position. `cue-integrity.test.ts` gains `'follow'` in `CONTRACT_VERBS`. Environment gets a smoke-level unit: constructing it registers zero clickables and exactly one frame callback.

**Rationale**: Constitution IV — everything non-pixel is unit-testable with the existing FakeTimeline pattern; the visual half (does the framing *look* right) goes to the quickstart manual checklist as in 001.
