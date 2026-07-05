# Tasks: Cutaway Visual Upgrade (v2)

**Input**: Design documents from `specs/002-cutaway-visual-upgrade/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/scene-verbs-v2.md](contracts/scene-verbs-v2.md), [research.md](research.md), [quickstart.md](quickstart.md)

**Tests**: Included — constitution principle IV mandates automated tests for all non-visual logic; choreography/visuals go to the quickstart manual checklists.

**Milestone mapping** (constitution VI: each story is a deployable increment): M1 ≈ Phase 3 (US1, MVP) · M2 ≈ Phase 4 (US2) · M3 ≈ Phase 5 (US3) · M4 ≈ Phase 6 (US4) + Polish.

## Phase 1: Setup

**Purpose**: Baseline safety net before touching a shipped app.

- [X] T001 Verify green baseline on clean tree: `npm run test`, `npm run build`, `npm run test:smoke` all pass; note bundle size from build output as the < 2 MB reference (no file changes)
- [X] T002 Commit the 002 spec/plan artifacts (`specs/002-cutaway-visual-upgrade/`, `.specify/feature.json`, CLAUDE.md managed-section update) — constitution: plans are committed before implementation

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared structures both US1 (geometry) and US2 (colors) edit — extracting them first prevents the two stories from colliding in `Building.ts`.

- [X] T003 Refactor color constants into a structured `PALETTE` export in `src/scene/Building.ts` with the data-model keys (`desk`, `l1`, `l2`, `ram`, `emptyFloor`, `warehouse`, `structure.{slab,wall,ground,road}`, `sky`, `signals.{hit,miss,focus}`), still holding the v1 values; thread all existing materials (Building, World background/fog, flash colors) through it — pure refactor, zero visual change, tests stay green
- [X] T004 [P] Export the `VANTAGES` table and add a `VIEW_ARC` constant (min/max azimuth, min/max polar per research R1) from `src/scene/index.ts` / `src/scene/World.ts` so tests can import both (no behavior change yet)

**Checkpoint**: Refactor-only — deployed app looks identical; suite green.

## Phase 3: User Story 1 — Unobstructed cutaway view (P1) 🎯 MVP

**Goal**: Open-faced dollhouse building; no reachable camera angle hides the action; lift visible full-ride.

**Independent Test**: Play all 8 chapters dragging the camera freely — the animating element is never hidden; `?dev` click-through confirms every clickable still responds (quickstart US1 section).

- [X] T005 [US1] Apply `VIEW_ARC` clamps to OrbitControls in `src/scene/World.ts` (`minAzimuthAngle`/`maxAzimuthAngle` ≈ ∓80° from +z, `minPolarAngle` ≈ 0.15π, keep `maxPolarAngle` 0.52π, damping on) per research R2
- [X] T006 [P] [US1] New unit test in `tests/unit/camera-arc.test.ts`: every `VANTAGES` entry's camera position lies inside `VIEW_ARC` relative to its target (pure spherical math, no renderer)
- [X] T007 [US1] Rework tower interiors in `src/scene/Building.ts`: delete the dark per-floor filler blocks; dress floors 1–3/5–7 as simple open rooms (desks/crates/plants from primitives, `PALETTE.emptyFloor`); inset side walls so arc-edge angles don't clip interiors; keep all `HighlightId` rooms, `anchorFor` anchors, and click registration byte-compatible (FR-004)
- [X] T008 [US1] Move the lift to a front-face glass tube in `src/scene/Lift.ts`: shaft at z ≈ `+BLD_D/2 − 0.6` as transparent shell (`opacity ~0.15`, `depthWrite: false`) + edge lines; update `LIFT_X`-based positions and `anchorFor('lift')` in `src/scene/Building.ts` consistently; `carry()` three-phase choreography and `liftDuration` unchanged; car stays the click target
- [X] T009 [US1] Retune `VANTAGES` coordinates in `src/scene/index.ts` for the open face (same nine `VantageId` names) so every default view frames dressed rooms; confirm T006 test passes with the new numbers
- [X] T010 [US1] Validate: run quickstart "US1 — Cutaway & viewing arc" checklist manually (`?dev` click-through of every clickable, full-arc drag during a lift carry); `npm run test` + `npm run build` green

**Checkpoint (M1)**: Deployable — cutaway with v1 colors is a complete visibility upgrade on its own.

## Phase 4: User Story 2 — Pastel daylight style (P2)

**Goal**: Bright diorama look; floor function readable by hue; actors pop; moods stay daylight.

**Independent Test**: Quickstart "US2 — Pastel daylight style" checklist: distinct hues per floor group, vivid actors, three distinguishable flash colors, all four moods read as daylight.

- [X] T011 [US2] Fill `PALETTE` with the pastel values (data-model FloorPalette hue families) in `src/scene/Building.ts` and apply to ground/road/warehouse; swap `World.ts` background/fog to the sky tone and retune lights (hemisphere sky/warm higher intensity, key ~1.2, add soft front fill; no shadow maps) per research R4
- [X] T012 [P] [US2] Retint actors for saturation-against-pastel: `src/scene/Worker.ts`, `src/scene/Courier.ts`, `src/scene/effects/Pulse.ts`, lift car in `src/scene/Lift.ts` (FR-006)
- [X] T013 [US2] Re-tune `MOODS` in `src/scene/index.ts` as daylight variants and extend `setMood` to also tween the hemisphere light color (research R5; same keys/signature/duration)
- [X] T014 [US2] Update signal colors (`PALETTE.signals`, used by `flash` in `src/scene/Building.ts`) to the dark-on-pastel triplet and retune bloom in `src/scene/effects/Neon.ts` (strength ~0.35, higher threshold; toggle/watchdog logic untouched) per research R8
- [X] T015 [US2] Validate: quickstart US2 checklist incl. `?lowq` (bloom off must still look right); `npm run test` green

**Checkpoint (M2)**: Deployable — full daylight restyle on top of the cutaway.

## Phase 5: User Story 3 — Camera follows the action (P3)

**Goal**: `follow` verb tracks courier/lift/pulses; chapters retuned; grab/pause/disposal safe.

**Independent Test**: Quickstart "US3 — Follow camera" checklist: ch7 van tracked door-to-door, ch6 lift ride tracked, grab kills tracking instantly, pause freezes it, delivered-pulse follow settles cleanly.

- [X] T016 [US3] Add `TIMING.follow` default to `src/scene/timing.ts` and implement `follow(target, opts?)` in `src/scene/index.ts` per research R3: progress-proxy tween whose `onUpdate` lerps `controls.target` toward the resolved object (courier group / lift car / pulse mesh), registered in the shared `activeCameraTl` slot, last-known-position freeze on disposed pulse (FR-011)
- [X] T017 [US3] Update the contract trio in lockstep: add `follow` + `FollowTarget` to the `SceneVerbs` interface in `src/scene/index.ts` (done in T016), to `specs/001-cpu-building-story/contracts/scene-verbs.md`, and to `CONTRACT_VERBS` in `tests/unit/cue-integrity.test.ts`; add a `follow` button to the `?dev` harness in `src/main.ts`
- [X] T018 [P] [US3] Unit tests for follow lifecycle in `tests/unit/camera-arc.test.ts` (stubbed GSAP/objects, FakeTimeline pattern from `tests/unit/story-engine.test.ts`): starting follow kills prior camera timeline, flyTo kills follow, user-grab kills follow, disposed-target freeze, default duration from `TIMING.follow`
- [X] T019 [US3] Retune chapters `src/story/chapters/ch1-welcome.ts` … `ch4-decode.ts`: adjust `flyTo` usage for the new framing; cue counts frozen (makeChapter guard must not fire)
- [X] T020 [US3] Retune chapters `src/story/chapters/ch5-execute.ts` … `ch8-recap.ts`: compose `follow` into existing cue timelines for the ch6 miss-cascade lift rides and ch7 courier trip (follow duration = trip duration); cue counts frozen
- [X] T021 [US3] Validate: quickstart US3 checklist (grab/pause/disposal cases) + full `npm run test`; eyeball ch1/ch8 framing

**Checkpoint (M3)**: Deployable — cinematic tracking on the restyled cutaway.

## Phase 6: User Story 4 — Living environment (P4)

**Goal**: Neighbor buildings, trees, streetlights, drifting clouds; inert, cheap, out of the story's way.

**Independent Test**: Quickstart "US4 — Living environment" checklist: props present, clouds drift smoothly over 30 s, clicks do nothing, van path unobstructed, fps holds.

- [X] T022 [P] [US4] Implement `src/scene/Environment.ts` per research R7: 5–7 pastel neighbor buildings, 8–12 trees, 4–6 streetlights (emissive heads), 4–6 clouds in one drift group; static props merged via `BufferGeometryUtils.mergeGeometries` (≤ ~60 added draw calls); exactly one `world.onFrame` callback for cloud drift+wrap, zero per-frame allocations; props placed clear of the road corridor and warehouse apron
- [X] T023 [P] [US4] Unit test in `tests/unit/environment.test.ts`: constructing Environment (three mocked/headless) registers zero click targets and exactly one frame callback; prop counts within the data-model ranges
- [X] T024 [US4] Instantiate `Environment` in the `Scene` constructor in `src/scene/index.ts` (after Building, before effects); confirm nothing is passed to `addClickable`
- [X] T025 [US4] Validate: quickstart US4 checklist + `?fps` on integrated graphics with environment active (30+), `?lowq` run, `npm run test` green

**Checkpoint (M4)**: Deployable — full v2 visual experience.

## Phase 7: Polish & Cross-Cutting

- [X] T026 Run the full quickstart "Cross-cutting regression" list: deep-link `#chapter-6`, `?lowq`, `?nowebgl` fallback (narration byte-identical), highlight sync both directions, 800px drawer layout, free-play journeys/cycle counts
- [X] T027 `npm run build` (bundle still < 2 MB gzipped vs T001 baseline) then `npm run test:smoke` — all 4 Playwright tests green against the built site
- [X] T028 [P] Update `README.md` look-and-feel description/screenshots reference and add any new hard-won gotchas (e.g., transparent lift tube depthWrite, orbit clamp values) to `CLAUDE.md`
- [X] T029 Final deploy prep: commit per milestone if not already done; tag `v2.0.0` once the manual checklist and CI are green

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → **Foundational (P2)** → user stories.
- **US1 (Phase 3)**: only depends on Foundational. **BLOCKS US2/US3 in practice** (same files: Building, index) — this is a solo sequential project, so run stories in priority order.
- **US2 (Phase 4)**: depends on US1's reworked geometry (colors applied to final rooms).
- **US3 (Phase 5)**: depends on US1 (vantage/arc final); independent of US2 except trivial merge.
- **US4 (Phase 6)**: depends only on Foundational + US2's palette for matching hues; can start any time after Phase 4 (or after Phase 2 with placeholder colors).
- **Polish (Phase 7)**: after all desired stories.

### Within Each Story

- Test tasks marked [P] can be written alongside their implementation task (same story, different files).
- Contract trio (T017) must land in the same commit as the verb (T016) — cue-integrity enforces it.
- Chapter retunes (T019/T020) only after the verb exists (T016).

### Parallel Opportunities

Solo project, but independent-file pairs within a phase: T003 ∥ T004; T006 ∥ T005/T007; T012 ∥ T011; T018 ∥ T019; T022 ∥ T023. US4 (T022/T023) can be developed in parallel with US3 by a second contributor — zero file overlap.

## Implementation Strategy

**MVP first**: Phases 1–3 only (T001–T010) is a shippable, visibly better product — occlusion solved with v1 colors. Deploy, then layer US2 → US3 → US4, deploying at each checkpoint. If time is short, US4 is the natural cut line (pure atmosphere, P4).
