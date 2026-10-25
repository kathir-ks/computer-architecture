# Tasks: CPU Building v2 — Richer Visuals, More Viewpoints, New Visualizations, Pipelining

**Input**: Design documents from `specs/002-cpu-building-v2/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/scene-verbs-v2.md](contracts/scene-verbs-v2.md), [contracts/view-controls.md](contracts/view-controls.md), [quickstart.md](quickstart.md)

**Tests**: Included — constitution IV requires automated tests for all non-visual logic and a green Playwright smoke before every deploy. Visual choreography is verified by eye against [quickstart.md](quickstart.md).

**Milestone mapping** (constitution VI — each milestone ends tests green, smoke green, manual checklist, bundle ≤ 215 kB gzip, deployed):

| Milestone | Phases | User stories |
|-----------|--------|--------------|
| **M1 — Visuals + Cameras** | 1, 2, 3, 4, 5, 6 | US1, US2, US3, US7 |
| **M2 — X-ray + Live aids** | 7, 8, 9 | US4, US5 |
| **M3 — Pipelining chapter** | 10 | US6 |
| Final | 11 | cross-cutting |

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: different files, no dependency on an incomplete task
- **[Story]**: `[US1]`…`[US7]` on user-story phase tasks only
- Rules that apply to every task: keep `src/scene/` unaware of chapters; keep `src/story/` unaware of meshes; narration only in `src/story/script.ts`; latency numbers only in `src/scene/locations.ts`; pacing only in `src/scene/timing.ts`; no new runtime dependencies; no downloaded assets.

---

## Phase 1: Setup

**Purpose**: Guard rails for the bundle budget before any feature lands.

- [X] T001 [P] Create `scripts/check-bundle-size.mjs` that gzips every `dist/assets/*.js` file, prints the total in kB, and exits non-zero above **215 kB** (v1 baseline 172.0 kB + 25%, SC-009); add `"size": "node scripts/check-bundle-size.mjs"` to `package.json`
- [X] T002 [P] Add an `npm run size` step after the build step in `.github/workflows/deploy.yml` so an over-budget bundle blocks deploy

**Checkpoint**: `npm run build && npm run size` passes at the v1 baseline.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: Pure, renderer-free building blocks that the camera, quality, X-ray and Worker-view stories all share.

- [X] T003 [P] Create `src/scene/motion.ts`: `reducedMotion()` (reads `prefers-reduced-motion`, injectable provider for tests), `scaleDuration(seconds)` (× 0.35 when reduced), `isReduced` change subscription (data-model.md "ViewPreferences / Motion")
- [X] T004 Unit test `tests/unit/motion.test.ts`: scaling on/off, injectable provider, subscription fires on change
- [X] T005 [P] Create `src/scene/view/viewState.ts`: `CameraMode`, `QualityTier`, `ViewSnapshot`, and the `ViewState` store with subscribe/notify and the transitions/invariants in data-model.md (`enterWorkerView`/`exitWorkerView` with `returnMode`, `setCameraMode` while in Worker view updates `returnMode` only, `userGrab`, `resume`, `setXray`, `setQuality`, `stepDownQuality` high→medium→low)
- [X] T006 Unit test `tests/unit/view-state.test.ts`: every transition and invariant, including restore-on-exit, hand-back not set while in Worker view, step-down never goes up automatically, subscribers notified once per change
- [X] T007 [P] Create `src/urlParams.ts`: pure `parseViewParams(search)` → `{ cam?, xray, view?, lowq, debug, dev, nowebgl }` for `?cam=`, `?xray`, `?view=worker`, `?lowq`, `?debug`, `?dev`, `?nowebgl` per contracts/view-controls.md (invalid values ignored)
- [X] T008 Unit test `tests/unit/url-params.test.ts`: each param, invalid `cam`, combinations
- [X] T009 [P] Extend `src/scene/timing.ts` with all new pacing constants in one place: rig transition durations (cinematic arc, settle, follow lerp rate), Worker-view enter/exit, X-ray fade, trail length/lifetime, hit/miss feedback beats, meter tween easing, pipeline tick duration and stall compression
- [X] T010 Create `src/scene/view/controls.ts`: the `ViewControls` interface (view half only: `getView`, `onView`, `setCameraMode`, `enterWorkerView`, `exitWorkerView`, `resumeCamera`, `setXray`, `setQuality`) exactly as in contracts/view-controls.md; telemetry methods are added in T059

**Checkpoint**: `npm run test` green with the new pure modules; no runtime behaviour has changed yet.

---

## Phase 3: User Story 1 — A building that is clear, lit and good to look at (P1) 🎯 MVP

**Goal**: Lit, prop-rich, PBR-looking building; pulse trails; card vs block shapes; more characterful Worker; three quality tiers with automatic step-down.

**Independent test**: Load `/` and `/?lowq`. All 10 floors and the warehouse are identifiable at the default view with labels hidden; moving data leaves a trail; Worker states differ; throttling the CPU steps quality down and the story keeps running (quickstart M1 items 1–3, 5).

- [X] T011 [P] [US1] Create `src/scene/effects/Quality.ts`: 3-tier manager (`high` bloom+shadows+env+full trails / `medium` no bloom, no shadows / `low` no env, minimal trails) built on `ViewState`, using the existing `Neon` for bloom; arms a fresh `createQualityWatchdog()` after every step-down (do not change `Neon.ts` watchdog contract); exposes `onChange`
- [X] T012 [US1] Unit test `tests/unit/quality-tiers.test.ts`: watchdog trips step high→medium→low and then stop, each trip re-arms a new watchdog, `?lowq` starts at `low`, manual set works, existing `tests/unit/quality.test.ts` still passes unchanged
- [X] T013 [P] [US1] Create `src/scene/textures.ts`: canvas-generated maps built once (window-grid colour + emissive map, concrete noise/bump, floor tile pattern) with a `dispose()`; no image files
- [X] T014 [P] [US1] Create `src/scene/materials.ts`: shared PBR presets (concrete, glass, brushed metal, wood, neon/emissive, plastic) using `textures.ts`; `MeshPhysicalMaterial` for glass only on `high`, standard fallback otherwise; setter to swap by tier
- [X] T015 [US1] Update `src/scene/World.ts`: `PMREMGenerator` + `RoomEnvironment` environment (toggle-able), soft shadow map support (`setShadowsEnabled`), brighter hemisphere/ambient so no region is pure black, tone-mapping exposure tuning; keep render loop, fps sampling and `renderOverride` API intact
- [X] T016 [P] [US1] Create `src/scene/props.ts`: instanced room props — instruction/data shelves with books/boards (L1), storeroom crates (L2), tall archive stacks (RAM), warehouse bays and pallets (disk); returns per-room material handles for `flash`/`reveal`
- [X] T017 [US1] Re-skin `src/scene/Building.ts`: PBR slabs/walls, glass panes with instanced emissive windows, emissive ceiling strips per floor (≤ 6 real lights total), neon edge outline, street/road/ground detail; integrate `props.ts`; keep `reveal`/`flash`/`setGlow`/click raycasting/labels behaviour and the `anchorFor` exports unchanged
- [X] T018 [P] [US1] Update `src/scene/effects/Pulse.ts`: instruction pulses are thin card meshes, data pulses are small glowing blocks (keep existing tints, `spawn/meshOf/dispose` API)
- [X] T019 [P] [US1] Create `src/scene/effects/Trails.ts`: ring-buffer fading ribbon per pulse updated each frame; length ∝ speed; density/length scaled by quality tier; disposed with the pulse
- [X] T020 [US1] Wire trails into `Pulses` (`src/scene/effects/Pulse.ts`) and the frame loop in `src/scene/index.ts` via `world.onFrame`
- [X] T021 [P] [US1] Rebuild `src/scene/Worker.ts` body: articulated head/torso/arms/legs/face and hair, desk props kept; states `compute` (typing arms), `read-card` (lean + head tilt), `idle` (breathing), `foot-tap` (impatient foot + glance toward the lift door); keep `playWork`, `drawer`, `dispenseTicket`, `showCard`, `splitCard`, `setGlow`, `clickTargets` signatures
- [X] T022 [P] [US1] Update `src/scene/Courier.ts`: PBR van, spinning wheels during `trip`, headlights; keep `trip` timing and `clickTargets`
- [X] T023 [US1] Integrate `Quality` into `src/scene/index.ts` (`Scene` owns it; `neon` remains reachable for the dev harness) and update `wireQuality` in `src/main.ts` so the chip cycles tiers and `?lowq` starts at `low`; add a "quality cycle" button to the `?dev` harness
- [ ] T024 [US1] (partial: unit tests, typecheck, build, size and the 4 smoke scenarios by hand are done; the smoke suite passes locally (8/8), but manual items 3 and 5 are not fully checked) Run gates and manual checklist: `npm run test`, `npm run build`, `npm run size`, `npm run test:smoke`; then quickstart M1 items 1, 2, 3, 5 at default and `?lowq`; fix regressions before continuing

**Checkpoint**: v1 story plays identically in content, with the new look, trails, character and quality tiers.

---

## Phase 4: User Story 2 — Follow the data and a directed tour (P1)

**Goal**: Free / Follow-the-data / Cinematic camera modes owned by one rig; learner input always wins; visible **Resume camera**.

**Independent test**: Play chapters 5–7 in each mode: Follow keeps the traveller in frame including the van trip; Cinematic gives a smooth, wall-safe shot per beat; any input cancels scripted motion within the same event; pause freezes camera automation (quickstart M1 items 6–8).

- [X] T025 [P] [US2] Create `src/scene/camera/shots.ts`: move the `VANTAGES` table out of `src/scene/index.ts`; add optional `fov` and `settle` per shot; export `VantageId` unchanged (re-exported from `src/scene/index.ts`)
- [X] T026 [P] [US2] Create `src/scene/camera/safePath.ts`: pure `safePath(from, to, bounds, margin)` returning waypoints that never enter the tower AABB (expanded by margin) or the ground, via an orbit-radius arc
- [X] T027 [US2] Unit test `tests/unit/camera-safe-path.test.ts`: every sampled point of paths between every pair of vantages stays outside the expanded tower bounds
- [X] T028 [P] [US2] Create `src/scene/camera/follow.ts`: pure framing + critically-damped smoothing step (`followStep(state, targetPos, targetVel, dt)`) keeping the target inside NDC ±0.85 with a minimum distance and a lead along velocity
- [X] T029 [US2] Unit test `tests/unit/camera-follow.test.ts` (SC-003): using a real `THREE.PerspectiveCamera` (no renderer), simulate the real lift carry path (RAM→registers, L1→registers), the courier trip, and `deliver`, stepping 60 fps; assert the target's NDC stays within ±0.85 after warm-up and there are no per-frame jumps above a threshold
- [X] T030 [US2] Create `src/scene/camera/CameraRig.ts`: single owner of camera position/target and controls; modes `free` (exact v1 GSAP tween), `cinematic` (wall-safe arc via `safePath`, ease-in-out, FOV push + settle, `scaleDuration` for reduced motion), `follow` (`track(mesh)`/`untrack()`, ignores shot requests while tracking, behaves as cinematic otherwise); `requestShot(id, duration)` returns a `gsap.core.Timeline` of the requested duration so chapter sequencing is unchanged; remembers `lastShot`; `cancelScripted()`; `setAutomationPaused(bool)` (FR-019); reads/writes only `ViewState`
- [X] T031 [US2] Update `src/scene/World.ts`: `onUserGrab` fires on `pointerdown`, `wheel`, `touchstart` and `keydown` (arrows/WASD/+/−) synchronously; call `rig.update(dt)` inside the frame loop before `controls.update()`
- [X] T032 [US2] Update `src/scene/index.ts`: `flyTo` delegates to `rig.requestShot`; `carry` and `courierTrip` start/stop tracking the pulse mesh (`tl.call` at start and end) and `deliver` releases it; `Scene` implements the view half of `ViewControls` (`getView`, `onView`, `setCameraMode`, `resumeCamera`) backed by `ViewState`; user grab → `ViewState.userGrab()`; `setAutomationPaused` exposed for the app layer
- [X] T033 [P] [US2] Create `src/ui/ViewDock.ts`: plain-DOM dock in `#settings-chip` area with a camera-mode segmented control (Free · Follow · Cinematic, `aria-pressed`), **Resume camera** button shown only while `handedBack`, quality chip moved here; subscribes via `onView`; keyboard operable with visible focus states
- [X] T034 [US2] Add dock styles (and the <900 px bottom-drawer adjustment) to `src/styles.css`
- [X] T035 [US2] Update `src/main.ts`: parse `parseViewParams`, apply `?cam=`, construct `ViewDock`, connect `engine.onStatus` → `scene.setAutomationPaused(status === 'paused')`, expose `window.__cpu` (view snapshot getter) only when `?debug`
- [X] T036 [US2] Extend `tests/smoke/story.spec.ts`: switch-sequence test (`/?lowq&debug`): cycle Free → Follow → Cinematic during playback, press Resume camera after a mouse drag, assert `window.__cpu` reflects each mode and the page logs no console errors (SC-010 first part)
- [ ] T037 [US2] (partial: unit tests, typecheck, build, size and scripted in-browser checks of modes, shot arbitration, input-cancel and pause are done; the smoke suite passes locally (8/8); real-time motion not judged because the pane renders at about 1 fps) Run gates and manual checklist: `npm run test`, `npm run build`, `npm run size`, `npm run test:smoke`; quickstart M1 items 6, 7, 8 (Follow incl. van trip; drag/wheel/touch/arrow cancel; pause freezes camera); fix regressions

**Checkpoint**: All v1 chapters play in all three camera modes; Free mode matches v1 exactly.

---

## Phase 5: User Story 3 — See through the Worker's eyes (P2)

**Goal**: Enter/leave a first-person view at the Worker's desk with clamped look-around; wait time felt from the Worker's seat.

**Independent test**: From any chapter enter Worker view, fire a free-play LOAD from L1 then RAM, compare how long the lift door stays empty, exit and confirm the previous mode returns (quickstart M1 item 9).

- [X] T038 [P] [US3] Create `src/scene/camera/workerLook.ts`: pure `clampLook` (yaw ±75°, pitch −35°…+25°) and `applyDrag(look, dx, dy, sensitivity)`
- [X] T039 [US3] Unit test `tests/unit/worker-look.test.ts`: clamping at limits, drag accumulation, sensitivity, no NaN on large deltas
- [X] T040 [P] [US3] Update `src/scene/Worker.ts`: `setFirstPerson(on)` hides the head/hair meshes; add an **in-tray** prop at the lift side of the desk marking where delivered cards land (anchor for `deliver(..., 'worker')` kept consistent with `anchorFor('worker')`); eye position exported as a getter
- [X] T041 [US3] Add `worker` mode to `src/scene/camera/CameraRig.ts`: move to eye position, shorten near plane, disable OrbitControls, pointer/touch look controls through `workerLook.ts`, ignore shot requests and tracking, smooth enter/exit transitions (reduced-motion aware), restore the previous mode via `ViewState.returnMode` on exit
- [X] T042 [US3] Implement `enterWorkerView`/`exitWorkerView` in `src/scene/index.ts` (calls `Worker.setFirstPerson`, `rig` worker mode, `ViewState`), and honour `?view=worker` at boot in `src/main.ts`
- [X] T043 [P] [US3] Add **Worker view** toggle and an **Exit** affordance (also `Esc`) to `src/ui/ViewDock.ts`, with styles in `src/styles.css`
- [X] T044 [US3] Extend the smoke switch-sequence in `tests/smoke/story.spec.ts`: enter Worker view, exit, assert previous camera mode restored via `window.__cpu`
- [ ] T045 [US3] (partial: unit tests, typecheck, build, size and scripted in-browser checks are done; the smoke suite passes locally (8/8); look-around feel and door-empty wait comparison not judged in real time) Run gates and manual checklist: tests/build/size/smoke; quickstart M1 item 9 (clamped look, no inside-out geometry, door-empty comparison L1 vs RAM, restore on exit)

**Checkpoint**: Worker view works in the story and in free play at every quality tier.

---

## Phase 6: User Story 7 — Smoother, more expressive animation (P3)

**Goal**: Wind-up and settle, eased lifts, distinct hit/miss feedback by shape, visible waiting, reduced-motion support.

**Independent test**: Run chapters 5 and 6 and the free-play LOAD flows; hit vs miss distinguishable in greyscale; waiting visible; OS reduced-motion shortens camera moves and removes strobing; pause/resume has no glitch (quickstart M1 items 4, 8, 10, 11).

- [X] T046 [P] [US7] Create `src/scene/effects/Feedback.ts`: hit = expanding ring + tick glyph; miss = brief shudder + cross glyph; non-strobing under reduced motion; quality-tier aware; returns `gsap.core.Timeline`
- [X] T047 [US7] Integrate `Feedback` into `Building.flash` in `src/scene/Building.ts` (keep colours and `focus` behaviour; add the shape cues)
- [X] T048 [P] [US7] Update `src/scene/Lift.ts`: glass car with door lights, anticipation dip before leaving, ease-out settle on arrival, eased slide in/out of the shaft; keep `carry` duration formula from `timing.ts`
- [X] T049 [P] [US7] Add launch squash/wind-up and arrival settle to `spawnPulse`/`deliver` in `src/scene/index.ts` and `Pulse.ts` (durations from `timing.ts`; scaled for reduced motion only where decorative)
- [X] T050 [P] [US7] Apply `motion.ts` across decorative loops (Worker idle sway, neon pulsing, trail shimmer) in `src/scene/Worker.ts`, `src/scene/effects/Neon.ts`-adjacent code in `src/scene/index.ts`, and `Trails.ts`; teaching animations (carry, trips) keep normal pace
- [X] T051 [US7] Update free-play wiring in `src/main.ts` (`wireFreePlay`): run `scene.workerWork('foot-tap')` together with the data journey whenever the resolved level is slower than L1 (FR-011), keep the existing compute/idle follow-up
- [ ] T052 [US7] (partial: tests, typecheck, build, size, chapter-diff check and a scripted full-story run are done; the smoke suite passes locally (8/8); the v1 per-chapter visual checklist and motion feel not judged in real time; milestone tag and deploy await your go-ahead) Run gates and manual checklist: tests/build/size/smoke; quickstart M1 items 4, 8, 10, 11 including the full v1 per-chapter checklist from `specs/001-cpu-building-story/quickstart.md`; confirm `git diff 130a23f -- src/story/chapters/ch[1-8]*.ts` is empty

**Checkpoint (M1 exit)**: tests green, smoke green, manual checklist done, `npm run size` ≤ 215 kB, tag `v2-m1`, deploy.

---

## Phase 7: Foundational for M2 — telemetry (blocks US4 and US5)

**Purpose**: One cycle ledger and one scene-side tracker feed the scale marker, ladder, meter, idle counter and free-play consistency. No UI here.

- [X] T053 [P] Add `WORK_CYCLES` (`compute: 1`, `'read-card': 1`) to `src/scene/locations.ts` and a test in `tests/unit/locations.test.ts` (latency numbers stay in this file only)
- [X] T054 [P] Create `src/scene/telemetry/ledger.ts`: `AccessJourney`, `LedgerSnapshot`, `CycleLedger` (`beginAccess`, `probe`, `serve`, `advance`, `complete`, `work`, `reset`, `subscribe`) with the six invariants from data-model.md
- [X] T055 Unit test `tests/unit/ledger.test.ts`: final cycles equal `locationOf(served).latencyCycles` for L1/L2/RAM/disk; `idle + working === elapsed` at every step; no double count after `complete`; probe de-duplication; idle increases only in open non-register journeys; totals equal `freeplay.applyOutcome` for the same fired sequence
- [X] T056 Create `src/scene/telemetry/tracker.ts`: `AccessTracker` deriving journeys from scene verbs per research D11 (`flash` miss/hit on memory levels → `probe`, `focus` ignored; `carry`/`courierTrip` → `serve` + meter tween using the verb's own duration and tween-delta `advance`; STORE direction; `deliver` → `complete`; `workerWork('compute'|'read-card')` → `work`)
- [X] T057 Unit test `tests/unit/access-tracker.test.ts`: replay the real verb sequences of chapters 5, 6 and 7 plus free-play LOAD/STORE flows against a recorder with real gsap timelines (`progress(1)` fast-forward and mid-way kill + `resetTelemetry`); assert ladder order, final meter, idle accounting
- [X] T058 Integrate the tracker into `flash`, `carry`, `courierTrip`, `deliver`, `workerWork` in `src/scene/index.ts` without changing their signatures; implement `onLedger` and `resetTelemetry` there
- [X] T059 Extend `src/scene/view/controls.ts` with the telemetry half (`onLedger`, `resetTelemetry`, `LedgerSnapshot`) per contracts/view-controls.md
- [X] T060 Update `src/main.ts`: call `scene.resetTelemetry()` on `engine.onJump` and on free-play reset; expose the ledger snapshot on `window.__cpu` under `?debug`

**Checkpoint**: `window.__cpu` ledger values are correct for chapters 5–7 and free play (still no UI).

---

## Phase 8: User Story 4 — X-ray cross-section and latency scale (P2)

**Goal**: Toggleable X-ray with ten labelled floors and a side latency scale whose marker follows the level being served.

**Independent test**: Toggle X-ray in each chapter: walls fade, ten role labels appear, scale shows exactly 0 / 4 / 12 / 200 / 4,000,000 and marks the active level; off restores smoothly (quickstart M2 item 1).

- [X] T061 [P] [US4] Create `src/scene/effects/Xray.ts`: fade registry for decor materials (outer walls, filler boxes, window panes, slab edges, dark-floor props), `setXray(on)` GSAP fade to ~0.12 opacity with edges/outline kept, floor-role label (CSS2D) reveal for all 10 floors; works at the `low` tier; never restarts other timelines
- [X] T062 [US4] Register decor materials with `Xray` in `src/scene/Building.ts` and add the 10 floor-role CSS2D labels (floor numbers + role names such as "Worker + registers", "L1 caches", "L2", "RAM archive", "lobby")
- [X] T063 [US4] Implement `setXray` in `src/scene/index.ts` (backed by `ViewState`) and honour `?xray` at boot in `src/main.ts`
- [X] T064 [P] [US4] Create `src/ui/LevelLadder.ts` with the **scale** layout: vertical rungs for registers/L1/L2/RAM/disk reading `LOCATIONS` from `src/scene/locations.ts` (no duplicated numbers), number formatting, active marker API driven by `onLedger` (`ledger.current.served`)
- [X] T065 [US4] Add X-ray toggle to `src/ui/ViewDock.ts`, mount the scale in `src/main.ts` while X-ray is on, and add styles to `src/styles.css` (including <900 px behaviour)
- [X] T066 [US4] Extend the smoke switch-sequence in `tests/smoke/story.spec.ts`: toggle X-ray on/off in several chapters and with `?lowq`; assert the scale lists the five values from the page and no console errors
- [X] T067 [US4] Manual check quickstart M2 item 1 in chapters 5, 6, 7, 8 and in Worker view

**Checkpoint**: X-ray works in every chapter and tier.

---

## Phase 9: User Story 5 — Live visualizations that make the numbers felt (P2)

**Goal**: Cycle meter, memory ladder, idle-time counter and cache-line locality strip, all consistent with the 3D scene and free-play scoreboard.

**Independent test**: Run L1 hit, miss cascade to RAM and a disk trip: meter finals 4 / 200 / 4,000,000; ladder marks missed levels in order; idle counter rises only while waiting; locality strip shows neighbours hit (quickstart M2 items 2–9).

- [X] T068 [P] [US5] Create `src/sim/cacheLine.ts`: `CacheLineSim` (`cells` default 16, `lineSize` default 4, `access(i)` → `{hit, filled}`, `reset`)
- [X] T069 [US5] Unit test `tests/unit/cache-line.test.ts`: miss fills the aligned line; neighbours hit; a hit never changes residency; accessing a resident cell is always a hit; reset clears
- [X] T070 [US5] Extend `src/ui/LevelLadder.ts` with the **compact** layout and ledger-driven rung states (`idle`, `checked-miss`, `served`, `current`) from `LedgerSnapshot.current.probes/served`
- [X] T071 [P] [US5] Create `src/ui/AidsDock.ts`: cycle meter (running value + final value, thousands separators, resets per access) and idle-vs-working counter with proportional bar, collapsible, fed only by `onLedger`
- [X] T072 [P] [US5] Create `src/ui/LocalityStrip.ts`: 16-cell strip driven by `CacheLineSim` — click a cold cell → miss, aligned line fills with animation; click a neighbour → hit; reset button; keyboard operable
- [X] T073 [US5] Add the `#aids` container to `index.html`; mount `AidsDock`, compact `LevelLadder` and `LocalityStrip` in `src/main.ts` (only when 3D booted); styles in `src/styles.css` including collapse to compact form below 900 px without covering the 3D focus area
- [X] T074 [US5] Cross-check free play in `src/main.ts`: ensure scoreboard totals, meter finals and ledger history agree after mixed runs (adjust wiring only if they differ); extend `tests/unit/access-tracker.test.ts` with a free-play mixed-run total comparison against `applyOutcome`
- [X] T075 [US5] Extend `tests/smoke/story.spec.ts`: `/?lowq&debug#chapter-6`, fast-forward steps with Next, assert `window.__cpu` ledger final equals the RAM latency shown in the page and the aids dock is visible
- [X] T076 [US5] Run gates and manual checklist: tests/build/size/smoke; quickstart M2 items 2–9 (including tab-hidden mid-journey and chapter jump mid-journey)

**Checkpoint (M2 exit)**: tests green, smoke green, manual checklist done, `npm run size` ≤ 215 kB, tag `v2-m2`, deploy.

---

## Phase 10: User Story 6 — Pipelining chapter (P3)

**Goal**: Chapter 9 shows an assembly line: three instructions in three stages at once, higher throughput, a hazard bubble, and a memory-miss stall — added without editing chapters 1–8.

**Independent test**: Open `#chapter-9` directly and step through: line appears, fills, throughput comparison shows pipelined < sequential, bubble forms and recovers, long memory stall holds the line; free play unlocks after chapter 9; `?nowebgl` shows chapter 9 narration (quickstart M3).

- [X] T077 [P] [US6] Create `src/scene/pipelineSchedule.ts`: pure `buildSchedule(instructions, opts)` and `PipelineSchedule` type per data-model.md (stages F/D/E, dependency bubbles, `execTicks` memory stalls, `totalTicks`, `sequentialTicks`, `bubbles`, `compressedMemoryTicks`)
- [X] T078 [US6] Unit test `tests/unit/pipeline-schedule.test.ts`: no hazards → `n + 2` ticks; dependency inserts a bubble at the right stage; `execTicks > 1` holds Execute and stalls F/D; ≤ 1 instruction per stage per tick; program order preserved; `totalTicks ≤ sequentialTicks`
- [X] T079 [P] [US6] Add `'pipeline'` to `SCENE_ELEMENT_IDS` in `src/scene/locations.ts` and update expectations in `tests/unit/locations.test.ts` and any highlight-id tests (`tests/unit/highlighter.test.ts` if it enumerates ids)
- [X] T080 [P] [US6] Add the `'pipeline-line'` vantage to `src/scene/camera/shots.ts` (floor 10, framing three stations) and to the `VantageId` union
- [X] T081 [US6] Create `src/scene/PipelineLine.ts`: belt on floor 10 left of the desk, three stations (Fetch near the lift, Decode, Execute at the Worker's desk), two extra clerk figures, card meshes per instruction, bubble marker, CSS2D board "one-at-a-time vs pipelined" ticks, `setup()`/`run(schedule)`/`teardown()` idempotent, `setGlow(on)`; all pacing from `timing.ts`; stall shown compressed with the real figure read from `locations.ts`
- [X] T082 [US6] Add `pipelineSetup`, `pipelineRun`, `pipelineTeardown` to `SceneVerbs` and `Scene` in `src/scene/index.ts` (run implies setup), route `setGlow('pipeline', on)`; add the dev-harness buttons in `src/main.ts`
- [X] T083 [US6] Update `tests/unit/cue-integrity.test.ts` (expected edit): chapters count 9 / ids 1..9, add the three verbs to `CONTRACT_VERBS`, stub returns inert timelines; keep all other assertions
- [X] T084 [P] [US6] Add chapter 9 title and 5 narration paragraphs to `src/story/script.ts` (one-at-a-time baseline; hire two clerks; the line fills; dependency hazard; memory-miss stall tying back to the caches) using `[[pipeline:…]]`, `[[registers:…]]`, `[[l1d:…]]`, `[[ram:…]]` markers; no other story-layer text changes
- [X] T085 [US6] Create `src/story/chapters/ch9-pipelining.ts` with `makeChapter(9, …)` — 5 cues using only contract verbs (`flyTo('pipeline-line')`, `pipelineSetup`, `pipelineRun(buildSchedule(...))` with hazard and memory-stall instruction lists, `workerWork`, `flash`, `pipelineTeardown`) — and register it in `src/story/chapters/index.ts`
- [X] T086 [US6] Verify wiring: progress dots show 9 (`NarrationPanel.initProgress` already dynamic), free play unlocks after chapter 9 via `StoryEngine`, deep link `#chapter-9` pre-reveals rooms in `src/main.ts` and the line sets itself up; confirm `src/fallback/static-page.ts` renders chapter 9 from `script.ts` with no code change
- [X] T087 [US6] Extend `tests/smoke/story.spec.ts`: `/?lowq#chapter-9` shows the "Pipelining" chapter title, 9 progress dots, and Next advances paragraphs
- [X] T088 [US6] Run gates and manual checklist: tests/build/size/smoke; quickstart M3 items 1–7; confirm `git diff 130a23f -- src/story/chapters/ch[1-8]*.ts` is empty (FR-031) (done: unit, type, build, size and smoke 9/9 pass; manual M3 items 1-7 checked in the browser pane by stepping timelines; real-time animation feel not judged)

**Checkpoint (M3 exit)**: tests green, smoke green, manual checklist done, `npm run size` ≤ 215 kB, tag `v2.0.0`, deploy.

---

## Phase 11: Polish & cross-cutting concerns

- [ ] T089 [P] Update `README.md`: new features, URL parameters table (`?cam`, `?xray`, `?view=worker`, `?lowq`, `?debug`, `?dev`, `?nowebgl`), how to run `npm run size`
- [ ] T090 [P] Update `CLAUDE.md`: camera rig / `ViewControls` / telemetry architecture notes, the three-places-in-sync rule for verbs (interface, contract doc, `CONTRACT_VERBS`), `?debug` handle, chapter 9, new test files, bundle budget
- [ ] T091 [P] Sync `specs/002-cpu-building-v2/contracts/scene-verbs-v2.md` and `contracts/view-controls.md` with what was actually built; add a pointer line to v2 in `specs/001-cpu-building-story/contracts/scene-verbs.md`
- [ ] T092 Accessibility pass: every dock control has an accessible name and visible focus, `aria-pressed` states correct, hit/miss cues readable in greyscale and under colour-blind simulation, aids readable at 200% zoom
- [ ] T093 Performance pass: Performance panel at each tier on a throttled profile; confirm ≥ 30 fps after the automatic step-down in every chapter and free play; confirm initial load < 5 s (SC-009) and record numbers in `specs/002-cpu-building-v2/quickstart.md`
- [ ] T094 Full regression: run the entire quickstart (M1 + M2 + M3 + v1 per-chapter checklist), `npm run test`, `npm run build`, `npm run size`, `npm run test:smoke`; fix anything found
- [ ] T095 Confirm `.github/workflows/deploy.yml` (tests → build → size → smoke → deploy) is green on push; note the GitHub Pages source setting in `README.md` if the repo still has no remote

---

## Dependencies & execution order

### Phase dependencies

- **Phase 1 (Setup)** → no dependencies.
- **Phase 2 (Foundational)** → after Phase 1; blocks every story.
- **Phase 3 (US1)** → after Phase 2. Independent of US2/US3/US7 except for sharing `Scene`/`Building` files.
- **Phase 4 (US2)** → after Phase 2; uses `Quality` UI mounting from US1 (T023) for the dock's quality chip, so start after T023.
- **Phase 5 (US3)** → after US2 (needs `CameraRig` and `ViewDock`).
- **Phase 6 (US7)** → after US1 (Worker/Building/Pulse changes) and US2 (rig for reduced motion).
- **Phase 7 (telemetry)** → after M1 exit (touches `Scene` verbs); blocks US4/US5.
- **Phase 8 (US4)** → after Phase 7 and US2 (`ViewDock`).
- **Phase 9 (US5)** → after Phase 7; shares `LevelLadder.ts` with US4 so run after T064.
- **Phase 10 (US6)** → after Phase 2; strictly needs `CameraRig` shots (US2) and `Scene` verb wiring; schedule/tests (T077–T079) can start earlier in parallel.
- **Phase 11 (Polish)** → after all desired stories.

### Within a story

Pure module → its test → scene/UI integration → smoke extension → gates + manual checklist.

### Task-level notes

- T016 before T017; T018 before T019/T020; T025/T026/T028 before T030; T030 before T032; T038 before T041; T054 before T056; T056 before T058; T077 before T081/T085; T081 before T082; T082 and T083 before T085.
- Tasks touching the same file are not parallel: `src/scene/index.ts` (T020, T023, T032, T042, T049, T058, T063, T082), `src/main.ts` (T023, T035, T042, T051, T060, T063, T073, T082), `src/styles.css`, `src/ui/ViewDock.ts` (T033, T043, T065), `src/scene/Building.ts` (T017, T047, T062), `src/scene/Worker.ts` (T021, T040, T050).

---

## Parallel execution examples

**Phase 2** — pure modules in parallel: T003 (`motion.ts`), T005 (`viewState.ts`), T007 (`urlParams.ts`), T009 (`timing.ts`).

**US1** — after T015: T013 (`textures.ts`), T014 (`materials.ts`), T016 (`props.ts`), T018 (`Pulse.ts`), T019 (`Trails.ts`), T021 (`Worker.ts`), T022 (`Courier.ts`), T011 (`Quality.ts`) are all different files.

**US2** — T025 (`shots.ts`), T026 (`safePath.ts`), T028 (`follow.ts`), T033 (`ViewDock.ts`) in parallel; then T030 (`CameraRig.ts`).

**US7** — T046 (`Feedback.ts`), T048 (`Lift.ts`), T049, T050 in parallel.

**Telemetry** — T053 (`locations.ts`) and T054 (`ledger.ts`) in parallel.

**US5** — T068 (`cacheLine.ts`), T071 (`AidsDock.ts`), T072 (`LocalityStrip.ts`) in parallel.

**US6** — T077 (`pipelineSchedule.ts`), T079 (`locations.ts`), T080 (`shots.ts`), T084 (`script.ts`) in parallel.

**Polish** — T089, T090, T091 in parallel.

---

## Implementation strategy

1. **MVP = US1 (Phase 3).** After T024 the site already looks dramatically better and is deployable on its own; stop there if time is short.
2. **M1 incrementally**: US1 → US2 → US3 → US7, running that phase's gates and manual checklist at each checkpoint. Do not start Phase 7 until M1 exit is green and deployed (constitution VI).
3. **M2**: build telemetry first with no UI (T053–T060) so `window.__cpu` proves the numbers; then X-ray + scale (US4); then the aids (US5).
4. **M3**: schedule model and tests first (no 3D needed), then the line and verbs, then narration and chapter 9, then the deep-link and fallback checks.
5. **Guard rails throughout**: `npm run size` ≤ 215 kB gzip after every milestone; chapter files 1–8 never edited; any new verb updates interface + contract doc + `CONTRACT_VERBS` in the same commit.
6. **Expected test edits (not regressions)**: `cue-integrity.test.ts` (T083), `locations.test.ts` (T053, T079), possibly `highlighter.test.ts` (T079). Every other existing test must pass unchanged.

## Notes

- Visual quality is judged by the constitution's first rule: if an effect makes the data's journey harder to follow, remove it (spec Assumptions).
- Commit after each task or logical group; tag at each milestone exit (`v2-m1`, `v2-m2`, `v2.0.0`). The repo has no GitHub remote yet; "deploy" means the CI-green state is ready to push.
