# Research: CPU Building v2

All unknowns from the Technical Context are resolved here. No `NEEDS CLARIFICATION` remain.

## D1 — Procedural PBR look without downloaded assets

- **Decision**: Use `MeshStandardMaterial` presets (concrete, glass, brushed metal, wood, neon) from a shared `materials.ts`; give them detail with **canvas-generated textures** (window grid + emissive window map, concrete noise/bump, floor tiles) built once at startup in `textures.ts`; get believable reflections from a **`PMREMGenerator` + `RoomEnvironment`** environment map (built-in addon, generated in code).
- **Rationale**: Constitution III forbids downloaded models/textures but not runtime-generated ones. The current scene looks flat because every surface is a single-colour standard material with weak, mostly-ambient lighting and no environment; an env map is the cheapest big upgrade to readability.
- **Alternatives**: Shipping texture files (violates III; extra requests). `MeshPhysicalMaterial` everywhere (costly on integrated GPUs; used only for glass on `high`).

## D2 — Lighting strategy for weak GPUs

- **Decision**: Raise hemisphere/ambient, add emissive ceiling strips and window emissive maps as "baked" interior light, keep **≤ 6 real lights** (existing per-room point lights stay), and enable a **soft shadow map only on the `high` tier** on the key directional light (1024², PCFSoft, tight frustum around the tower).
- **Rationale**: Many dynamic lights multiply fragment cost in three's forward renderer. Emissive geometry reads as light and costs nothing extra; shadows give depth cues (FR-003) where hardware allows.
- **Alternatives**: Per-floor point lights (too costly); lightmaps (needs baking assets).

## D3 — Quality tiers and the watchdog

- **Decision**: `Quality` manager with tiers `high` (bloom + shadows + env + full trails + glass physical), `medium` (no bloom, no shadows, env, short trails), `low` (no env, basic materials fallback via cheaper flags, minimal trails). The existing `createQualityWatchdog()` function and its tests are kept as is; after each trip the manager steps down one tier and arms a **new** watchdog. `?lowq` → `low`. Manual chip cycles tiers.
- **Rationale**: Constitution V requires bloom to auto-disable below ~30 fps; generalising to tiers keeps that behaviour (high→medium disables bloom first) while giving a graceful second step. Existing quality tests keep passing because the function contract is untouched.
- **Alternatives**: Binary on/off (no room for shadows/env as independent costs); dynamic resolution scaling (extra complexity for little learner value).

## D4 — Instancing and prop budget

- **Decision**: Windows, crates, shelf boards and archive stacks are built with `InstancedMesh`; props live in `props.ts` so `Building.ts` stays about structure.
- **Rationale**: Draw calls dominate integrated-GPU cost; the v1 building already has ~60 separate meshes before props.
- **Alternatives**: Merged static geometry (loses per-room glow/emissive control used by `flash`/`reveal`).

## D5 — Pulse trails and card vs block shapes

- **Decision**: Each pulse owns a ring buffer of recent positions rendered as a camera-facing fading ribbon (`BufferGeometry` + additive material), updated in the world frame loop; trail length scales with speed and quality tier. Instruction pulses become **cards** (thin rounded plane), data pulses become **blocks** (small cube with glow edge) — retaining existing tints as a second cue.
- **Rationale**: FR-004 and FR-009; shape + colour redundancy also helps colour-blind learners.
- **Alternatives**: `Line2` fat lines (extra addon weight); particle systems (harder to read as a path).

## D6 — Camera rig as single owner; story `flyTo` becomes a shot request

- **Decision**: `CameraRig` owns camera position, orbit target and controls state. `Scene.flyTo(vantage)` calls `rig.requestShot(vantage, duration)`. Mode behaviour:
  - **Free** — today's direct GSAP tween (exact v1 behaviour).
  - **Cinematic** — tween along a **wall-safe arc** (`safePath`) with ease-in-out, slight FOV push at arrival and a short settle; reduced-motion shortens to a cut.
  - **Follow** — while a pulse is tracked (set by `carry`/`courierTrip` inside the scene) the rig steers camera toward a framing computed by pure `follow.ts` and *ignores* conflicting shot requests; with no tracked pulse it behaves as Cinematic.
  - **Worker** — shot requests ignored entirely; first-person look controls active.
- **Rationale**: Chapter 6 step 3 already runs `carry` and `flyTo('lift-shaft')` together; without arbitration they would fight (FR-014, FR-016). Keeping the verb name `flyTo` means no chapter edits.
- **Alternatives**: New `follow`/`orbit` story verbs (would force chapter edits and make camera choice a story concern, though it is a learner preference).

## D7 — "User input always wins"

- **Decision**: `World.onUserGrab` fires on `pointerdown`, `wheel`, `touchstart` and `keydown` (arrow/WASD/+/-) on the canvas/window. The rig kills its scripted tween and follow steering synchronously, sets `handedBack = true`, and the `ViewDock` shows **Resume camera**. Resume re-enters the chosen mode at the *current beat* by re-issuing the last shot request (rig remembers it).
- **Rationale**: FR-016 / SC-004 (<100 ms): synchronous cancel inside the event handler meets this trivially. Remembering the last shot avoids restarting the chapter.
- **Alternatives**: Timer-based auto-resume (surprising; fights the learner).

## D8 — Worker first-person view

- **Decision**: Separate rig mode. Eye position at the Worker's head; the Worker's head mesh is hidden while active (`Worker.setFirstPerson`). OrbitControls is disabled and replaced by tiny pointer/touch look controls whose yaw/pitch are clamped by pure `workerLook.ts` (yaw ±75°, pitch −35°…+25°). Default gaze favours the desk with the lift door at the left edge; an **in-tray** prop on the desk marks where delivered cards land. Entering stores the previous mode in `ViewState`; exiting restores it with a short transition.
- **Rationale**: FR-017/018 and Edge Cases (never inside-out geometry: clamp + near plane). Hiding the head avoids clipping through the camera.
- **Alternatives**: OrbitControls with micro-distance (clamping semantics awkward, drift near zero distance).

## D9 — X-ray cross-section

- **Decision**: `Xray` registers the "decor" materials (outer walls, filler boxes, window panes, slab edges) with a fade registry; toggling tweens opacity of the registered set to ~0.12 (edges/outline stay) and reveals CSS2D **floor-role labels** for all ten floors. The side **latency scale** is a DOM component (`LevelLadder` in "scale" layout) pinned to the viewport edge. Non-essential decoration (props on dark floors) fades with the walls.
- **Rationale**: Material-opacity fade is far cheaper than a clipping-plane section or a second render pass, and works in the lowest tier.
- **Alternatives**: Clipping planes (renderer state leaks into other materials); second scene render (cost).

## D10 — Cycle accounting and the cumulative-vs-served question

- **Decision**: In this product a level's latency is the **total cost of an access served by that level** (L1 4, L2 12, RAM 200, disk 4,000,000) — exactly how `freeplay.ts` already scores. So the meter's final value equals the served level's latency; missed levels are shown on the **ladder** in order, not summed. Spec FR-022 and acceptance scenario 5.2 were corrected accordingly.
- **Decision**: `CycleLedger` is a pure state machine: `beginAccess` → `probe(level, 'miss'|'hit')` → `serve(level)` → `advance(cycles)` (called from tween `onUpdate` with deltas) → `complete()`. `work(kind)` adds working cycles from `WORK_CYCLES` in `locations.ts`. Invariants (tested): final = latency(served); idle + working = elapsed; `advance` never double-counts after `complete`.
- **Rationale**: One source of truth for meter, ladder, idle counter, scale marker and scoreboard; satisfies SC-005 by construction.

## D11 — Deriving accesses from existing verbs (no chapter edits)

- **Decision**: `AccessTracker` wraps the scene's own implementations of `flash`, `carry`, `courierTrip`, `deliver`, `workerWork`:
  - `flash(level, 'miss'|'hit')` on a memory level → `probe`; `'focus'` is ignored (chapter 8 uses it as a tour).
  - `carry(p, from → registers)` or `courierTrip` → `serve(from)` and starts a meter tween over the verb's own duration.
  - `carry(p, registers → to)` (STORE) → `serve(to)`.
  - `deliver(p, 'worker'|level)` → `complete`.
  - `workerWork('compute'|'read-card')` → `work(kind)`.
  - Duplicate probes of one level (chapter 6 flashes L2 twice) are de-duplicated.
- **Rationale**: Tween-delta accounting inherits GSAP's pause, fast-forward (`progress(1)` fires the final update) and tab-hidden behaviour. A chapter jump calls `resetTelemetry()` because killed timelines never reach their end.
- **Risk**: A future chapter that calls these verbs in an unusual order could mis-derive a journey. Mitigation: tracker unit tests replay the real chapters 5–7 verb sequences against a recorder, and the quickstart includes a meter check per chapter.

## D12 — Locality animation

- **Decision**: Pure `CacheLineSim` (e.g. 16 cells, line size 4): accessing a cold cell is a miss that fills its aligned line; neighbouring cells then hit; the model reports `{hit, filledCells}`. `LocalityStrip` (DOM) renders it and animates fills; clicking cells is the interaction. A later optional scene echo (a tray of four blocks riding the lift) is out of M2 scope.
- **Rationale**: FR-025 asks for a demonstration, not a new 3D system; a DOM strip keeps the 3D scene uncluttered (Constitution I).
- **Alternatives**: 3D shelf-of-cells animation (higher cost, lower clarity at this camera distance).

## D13 — Pipelining model and view

- **Decision**: `pipelineSchedule.ts` builds a schedule from a list of instructions `{name, needs?, produces?, execTicks?}`; stages F/D/E; a dependency on a not-yet-produced result inserts a **bubble** at the earlier stage; `execTicks > 1` models a memory wait (everything behind stalls). Output: per-tick stage occupancy, total ticks, and the sequential-baseline ticks for the throughput comparison. On screen, long stalls are **compressed** (e.g. 200 → shown as 5 ticks with a "…" marker and the real figure from `locations.ts` annotated).
- **View**: `PipelineLine` on **floor 10, left of the desk** (free floor space between the lift and the desk): three stations (Fetch near the lift, Decode, Execute at the Worker's desk), two extra clerk figures, a belt, card meshes, a bubble marker, and a CSS2D board showing "one-at-a-time vs pipelined" tick counts.
- **Verbs**: `pipelineSetup`, `pipelineRun(schedule)`, `pipelineTeardown`; all idempotent (setup is implied by run so deep links to chapter 9 work).
- **Rationale**: Story passes data, scene animates (Constitution II); keeps the story in the "CPU core" floor so the metaphor holds.
- **Alternatives**: Using the dark floors 5–7 (breaks the "this is inside the core" idea and moves the camera away from the Worker).

## D14 — Reduced motion

- **Decision**: `motion.ts` exposes `reducedMotion()` (reads `prefers-reduced-motion`, injectable for tests) and `scaleDuration(d)`. The camera rig shortens/cuts, decorative loops (idle sway, foot-tap when not waiting, neon pulsing) are minimised, flashes use a single non-strobing fade. Teaching animations (carry, trips, pipeline) still play at normal pace.
- **Rationale**: FR-012; the learner still needs to see the journey.

## D15 — View state store

- **Decision**: Pure `ViewState` (camera mode, worker view on/off + `returnMode`, X-ray, quality tier, handedBack) with subscribe/notify and invariants (cannot be in Worker view *and* hand-back; leaving Worker view restores `returnMode`; X-ray independent of camera). `ViewDock` and the rig both read/write only this store.
- **Rationale**: SC-010 switch-sequence safety is testable without WebGL.

## D16 — Test hooks

- **Decision**: Camera/telemetry logic tested as pure modules. For SC-003 a Vitest test simulates follow framing with a real `THREE.PerspectiveCamera` (no renderer needed) across the real carry/courier paths and asserts the target's NDC stays within ±0.85. Playwright gets a switch-sequence test and a chapter-9 deep link test; a `window.__cpu` debug handle is exposed **only** under `?debug` for those tests to read mode/ledger state.
- **Rationale**: Constitution IV; avoids pixel-reading tests that are flaky on the software rasteriser.
