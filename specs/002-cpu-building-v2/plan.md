# Implementation Plan: CPU Building v2 — Richer Visuals, More Viewpoints, New Visualizations, Pipelining

**Branch**: `master` (solo project, milestone-based; no feature branch) | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-cpu-building-v2/spec.md`

## Summary

Upgrade the shipped v1 explainer in three deployable milestones, in this order:

1. **M1 — Visuals + Cameras** (US1, US2, US3, US7): a lit, prop-rich, PBR-looking building with three quality tiers; pulse trails and distinct card/data-block shapes; a more articulate Worker; hit/miss feedback that differs by shape; and a single **camera rig** that owns Free / Follow-the-data / Cinematic / Worker-first-person modes while keeping "user input always wins".
2. **M2 — X-ray + Live aids** (US4, US5): an X-ray cross-section with floor labels and a side latency scale, plus a cycle meter, memory ladder, idle-time counter and cache-line locality strip — all fed by one pure **cycle ledger**.
3. **M3 — Pipelining chapter** (US6): chapter 9 with an assembly-line view, throughput comparison, hazard bubble and memory-stall tie-in, added as new verbs + a new chapter file; chapters 1–8 are not edited.

Technical approach: stay inside the existing architecture. New scene capabilities are exposed either as **story verbs** (only the three pipeline verbs, because only the story needs them) or through a second, UI-facing **`ViewControls`** interface (camera mode, X-ray, quality, telemetry subscription). The live aids are derived **inside the scene** by observing the verbs the chapters already call, so no existing chapter needs to change. Every new piece of non-visual logic is a pure module with a Vitest test. No new runtime dependencies; all textures are generated at runtime from canvas/procedural code.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), ES2022 target (unchanged)

**Primary Dependencies**: three ^0.169 (adds only built-in addons: `RoomEnvironment`, `OutputPass`), gsap ^3.12 (unchanged); dev: vitest, playwright, jsdom (unchanged). **No new runtime dependencies.**

**Storage**: None. View preferences are session-only (in-memory); URL params (`?cam=`, `?xray`, `?view=worker`, existing `?lowq`, `?dev`, `?nowebgl`) are read-only entry points for testing/sharing.

**Testing**: Vitest for all non-visual logic (ledger, view state, camera math, schedule, cache-line sim, motion preference, quality tiers); updated cue-integrity test (9 chapters, extended verb list); Playwright smoke extended (toggle-switch sequence, chapter 9 deep link, 9 progress dots). Choreography checked by eye against an extended manual checklist in [quickstart.md](quickstart.md).

**Target Platform**: Desktop evergreen browsers, WebGL2 with static fallback; touch input supported for camera control; hosted on GitHub Pages (unchanged).

**Project Type**: Single static web app (no backend).

**Performance Goals**: ≥30 fps on integrated graphics after automatic step-down (constitution V); total gzip bundle ≤ 215 kB (baseline **172.0 kB**, +25% cap per SC-009); initial load < 5 s.

**Constraints**: No network after load; no downloaded models/textures; no UI framework; all choreography in GSAP timelines or per-frame scene updates inside `src/scene/` (no ad-hoc rAF elsewhere).

**Scale/Scope**: 9 chapters (+1), 3 new story verbs, ~7 new view/telemetry methods, 4 camera modes, 3 quality tiers, 5 UI components (view dock, aids dock, ladder/scale, locality strip, plus existing panels edited), ~25 new source files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Learner-First Clarity | ✅ | Each new effect has a stated teaching job: trails = direction/speed of data; card vs block shape = instruction vs value; ladder/meter = cost of an access; idle counter = the cost of waiting. Rule from spec Assumptions: anything that muddies the data's journey is cut. All new narration goes in `script.ts`. |
| II | Scene–Story Separation | ✅ | Story gains exactly three verbs (`pipelineSetup`, `pipelineRun`, `pipelineTeardown`), documented and added to `CONTRACT_VERBS`. Camera modes, X-ray, quality and telemetry live behind `ViewControls`, which the story layer cannot reach (`SceneVerbs` stays the only story-facing type). Live aids observe verbs inside the scene; chapters 1–8 are untouched. The pipeline schedule is plain data computed by a pure module, so the story passes data and never meshes. |
| III | Static Simplicity | ✅ | No new dependencies. PBR reflections use `RoomEnvironment` (procedural, ships with three); textures are drawn on canvases at startup. One Vite bundle. Bundle budget enforced by SC-009 check in M1/M2/M3 exit criteria. |
| IV | Test What Isn't Pixels | ✅ | Pure modules + tests listed under Project Structure. Cue-integrity updated for chapter 9 and new verbs. Smoke tests extended; they must pass before each milestone deploy. |
| V | Performance on Modest Hardware | ✅ | Bloom stays toggleable and auto-disables; generalised to three tiers (high → medium → low) that each step down on a low-fps trip. Shadows only on `high`. Instancing + emissive "baked" lighting instead of many real lights (≤ 6 real lights). Bottom-drawer layout (<900 px) extended to the new docks. Static fallback includes chapter 9 automatically (renders from `script.ts`). |
| VI | Ship Each Milestone | ✅ | M1, M2, M3 each end with tests green, smoke green, manual checklist, deploy. |

**Post-Phase-1 re-check**: PASS — the design adds no dependencies and no boundary violations. One tension resolved: spec FR-022 said "cumulative" meter cost but the product's latency table (and free-play) define cost as the *serving level's* latency; the spec was corrected rather than changing the latency model (see research D10).

## Milestones (delivery order)

### M1 — Visuals + Cameras (US1 · US2 · US3 · US7)

Exit criteria: all 10 floors + warehouse identifiable at default view; pulse trails; Worker states distinct; hit/miss feedback differs by shape; Free/Follow/Cinematic/Worker modes work in every chapter and free-play; any input cancels scripted motion; quality tiers + watchdog; reduced-motion honoured; existing tests + smoke green; bundle ≤ 215 kB gz; deployed.

Order inside M1 (each step leaves the app working):
1. Quality tiers refactor (`Quality`, keep `Neon` + watchdog contract) — baseline safety net first.
2. Shared materials/textures/env → re-skin Building (slabs, walls, glass, windows) → room props (shelves, crates, archive stacks, warehouse bays).
3. Pulse upgrade: card vs data-block shapes, trails.
4. Worker upgrade: articulated body, four state animations, first-person hide-head hook.
5. Hit/miss feedback in `flash`.
6. Camera rig: `ViewState`, rig modes, safe path, follow math, user-grab events, reduced-motion → then wire `ViewDock` UI.
7. Worker first-person look controls + desk in-tray prop.

### M2 — X-ray + Live aids (US4 · US5)

Exit criteria: X-ray toggles smoothly in every chapter; latency scale shows exactly the `locations.ts` values and marks the level in use; cycle meter final value equals served-level latency for every access type; ladder engages missed levels in order; idle counter rises only while waiting; locality strip shows neighbours becoming hits; aids collapse on narrow screens; all consistent with the free-play scoreboard; tests/smoke/manual green; bundle ≤ 215 kB gz; deployed.

Order: (1) pure `CycleLedger` + tests → (2) scene `AccessTracker` deriving journeys from verbs → (3) `AidsDock` (meter, idle) → (4) `LevelLadder` (compact + scale variants) → (5) `Xray` effect + floor labels → (6) `CacheLineSim` + `LocalityStrip` → (7) free-play wiring check (scoreboard consistent).

### M3 — Pipelining chapter (US6)

Exit criteria: chapter 9 reachable by `#chapter-9`; 9 progress dots; assembly line shows three instructions in three stages at once; throughput comparison visible; hazard bubble + recovery; memory-miss stall tie-in; free play unlocks after chapter 9; fallback page includes chapter 9; chapters 1–8 byte-for-byte unchanged (git diff check); tests/smoke/manual green; deployed.

Order: (1) pure `pipelineSchedule` + tests → (2) `PipelineLine` scene object → (3) three verbs + contract/test updates → (4) narration in `script.ts` + `ch9-pipelining.ts` + register in `chapters/index.ts` → (5) highlight id `pipeline` → (6) smoke + checklist.

## Project Structure

### Documentation (this feature)

```text
specs/002-cpu-building-v2/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions D1–D16
├── data-model.md        # Phase 1 output — entities, state machines, invariants
├── quickstart.md        # Phase 1 output — validation guide + manual checklist
├── contracts/
│   ├── scene-verbs-v2.md   # delta to the story-facing contract (3 verbs, 1 vantage)
│   └── view-controls.md    # UI-facing scene interface (camera, X-ray, quality, telemetry)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root) — new (+) and changed (~) files only

```text
src/
├── main.ts                          ~ wire ViewDock, AidsDock, telemetry reset on chapter jump, URL params
├── styles.css                       ~ docks, ladder/scale, locality strip, X-ray label styles, narrow-width layout
├── scene/
│   ├── index.ts                     ~ SceneVerbs += 3 pipeline verbs; Scene implements ViewControls; telemetry hooks in verbs
│   ├── World.ts                     ~ shadows/env hooks, extra user-grab events (wheel, touch, key), rig update in frame loop
│   ├── Building.ts                  ~ PBR re-skin, windows (instanced), floor labels for X-ray, flash feedback hooks
│   ├── Worker.ts                    ~ articulated body, 4 state anims, first-person head hide, in-tray prop
│   ├── Lift.ts                      ~ eased motion with anticipation/settle, glass car, door lights
│   ├── Courier.ts                   ~ PBR van, wheel spin, headlights
│   ├── locations.ts                 ~ + WORK_CYCLES (compute/read-card) and 'pipeline' highlight id (latency numbers stay here)
│   ├── timing.ts                    ~ + camera/rig/xray/pipeline pacing constants (pacing stays here)
│   ├── materials.ts                 + PBR presets (concrete, glass, metal, wood, neon)
│   ├── textures.ts                  + canvas-generated maps (window grid, concrete noise, floor tiles)
│   ├── props.ts                     + room props (shelves, crates, archive stacks, warehouse bays), instanced
│   ├── motion.ts                    + reduced-motion preference + duration scaling (pure)
│   ├── camera/
│   │   ├── CameraRig.ts             + owns camera: Free/Follow/Cinematic/Worker, arbitration, hand-back
│   │   ├── follow.ts                + pure follow-framing math (keep target in frame)
│   │   ├── safePath.ts              + pure wall-avoiding dolly/orbit path
│   │   ├── workerLook.ts            + pure yaw/pitch clamp for first-person look
│   │   └── shots.ts                 + vantage table (moved from index.ts) + cinematic shot flourishes
│   ├── view/
│   │   └── viewState.ts             + pure store: cameraMode, workerView, xray, quality, handedBack, restore-on-exit
│   ├── telemetry/
│   │   ├── ledger.ts                + pure CycleLedger (access journeys, idle vs working, invariants)
│   │   └── tracker.ts               + AccessTracker: derives journeys from verbs, drives ledger via tween deltas
│   ├── pipelineSchedule.ts          + pure schedule builder (stages, hazards, bubbles, throughput)
│   ├── PipelineLine.ts              + 3D assembly line on floor 10 (stations, clerks, belt, cards, bubble marker, board)
│   └── effects/
│       ├── Neon.ts                  ~ unchanged public API; watchdog fn kept as-is (tests depend on it)
│       ├── Quality.ts               + 3-tier manager (high/medium/low) driving bloom, shadows, env, trail density
│       ├── Pulse.ts                 ~ card plane vs data block geometry; trails hook
│       ├── Trails.ts                + ring-buffer ribbon trails
│       ├── Feedback.ts              + hit ring-burst / miss shudder+cross overlays
│       └── Xray.ts                  + fade registry + floor-label reveal
├── sim/
│   └── cacheLine.ts                 + pure CacheLineSim (cells, line size, hit/miss, neighbours)
├── story/
│   ├── script.ts                    ~ + chapter 9 title and narration (only story-layer text change)
│   └── chapters/
│       ├── ch9-pipelining.ts        + chapter 9 cues (uses new verbs + existing flyTo/workerWork/flash)
│       └── index.ts                 ~ register ch9
├── ui/
│   ├── ViewDock.ts                  + camera-mode segmented control, Worker view, X-ray, quality, "Resume camera"
│   ├── AidsDock.ts                  + cycle meter + idle/working counter (collapsible)
│   ├── LevelLadder.ts               + ladder diagram; compact and X-ray "scale" layouts (one component)
│   └── LocalityStrip.ts             + cache-line strip driven by CacheLineSim
└── fallback/static-page.ts          (no change — renders from script.ts, so chapter 9 appears automatically)

tests/
├── unit/
│   ├── ledger.test.ts               + invariants: final = served latency; idle+working = elapsed; no double count
│   ├── view-state.test.ts           + mode transitions, restore on Worker-view exit, hand-back
│   ├── camera-follow.test.ts        + target stays inside frustum margin over simulated journeys (SC-003)
│   ├── camera-safe-path.test.ts     + path never enters tower bounds
│   ├── worker-look.test.ts          + clamp limits
│   ├── motion.test.ts               + reduced-motion scaling
│   ├── quality-tiers.test.ts        + step-down order high→medium→low, watchdog contract unchanged
│   ├── cache-line.test.ts           + miss fills line; neighbours hit; eviction
│   ├── pipeline-schedule.test.ts    + fill/steady state, bubbles, throughput, memory-stall extension
│   ├── cue-integrity.test.ts        ~ 9 chapters; CONTRACT_VERBS += pipelineSetup/Run/Teardown
│   └── (existing 6 test files)      unchanged
└── smoke/
    └── story.spec.ts                ~ + switch-sequence (cam modes/X-ray/Worker/quality) without console errors, #chapter-9, 9 dots
```

**Structure Decision**: Keep the four top-level areas from v1 (`scene/` verbs, `story/` scripts, `ui/` panels, `sync/` highlight bridge). The only new top-level directory is `src/sim/` for the cache-line model, because it is pure teaching logic used by a UI component and must not live in `scene/` (it never touches 3D) or `story/` (it is not narrative). Everything camera/telemetry/quality stays under `scene/` so the scene remains the single owner of the renderer and camera.

## Key design decisions (full rationale in [research.md](research.md))

- **Camera rig is the single owner of the camera.** Story `flyTo` becomes a *shot request*; the active mode decides how to honour it (Free = today's tween; Cinematic = wall-safe arc with settle; Follow = ignored while a pulse is tracked; Worker = ignored). User input from any device cancels scripted motion synchronously and raises "handed back".
- **Live aids never require chapter edits.** An `AccessTracker` inside the scene observes `flash/carry/courierTrip/deliver/workerWork` and feeds a pure `CycleLedger` through tween-delta updates, so aids are pause-safe, fast-forward-safe, and identical for story and free-play.
- **One latency source.** The ledger, ladder, scale and meter read `locations.ts`; nothing re-declares 0/4/12/200/4,000,000.
- **Pipeline schedule is data.** The story passes a plain `PipelineSchedule` to `pipelineRun`; the scene animates it. Memory stalls are modelled as extra execute ticks (compressed on screen, annotated with the real figure).
- **Quality is tiered, watchdog unchanged.** `createQualityWatchdog` keeps its tested contract; a `Quality` manager re-arms a fresh watchdog after each step-down.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| Second interface `ViewControls` beside `SceneVerbs` | Camera mode, X-ray, quality and telemetry are *learner* controls, not story beats; the story must not be able to call them | Adding them to `SceneVerbs` would let chapters flip the learner's view settings and would bloat the cue-integrity contract |
| New `src/sim/` directory | Cache-line model is pure teaching logic consumed by UI only | Putting it in `scene/` implies 3D coupling; `story/` implies narrative coupling |
| Derived telemetry (observer in scene) instead of explicit verbs | Keeps chapters 1–8 untouched (FR-031) and makes free-play and story share one path | Explicit `beginAccess/endAccess` verbs would force edits to every existing chapter cue |
