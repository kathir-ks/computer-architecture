# Tasks: CPU Building Story — Interactive 3D Memory Hierarchy Explainer

**Input**: Design documents from `specs/001-cpu-building-story/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/scene-verbs.md](contracts/scene-verbs.md), [research.md](research.md), [quickstart.md](quickstart.md)

**Tests**: Included — constitution principle IV mandates automated tests for all non-visual logic and a Playwright smoke gate.

**Milestone mapping** (constitution VI: each milestone ends deployed): M1 ≈ Phase 1 · M2 ≈ Phase 2 · M3–M4 ≈ Phase 3 + Phase 4 · M5 ≈ Phase 5 · M6 ≈ Phase 6.

## Phase 1: Setup

- [X] T001 Initialize npm project with Vite + TypeScript strict template; add deps `three`, `gsap`, devDeps `vitest`, `@playwright/test`, `@types/three`; scripts `dev/build/test/test:smoke` in `package.json`, `vite.config.ts`, `tsconfig.json`
- [X] T002 Create `index.html` skeleton: full-height canvas container left, narration panel `<aside>` right, loading overlay ("powering up the building…"), base CSS in `src/styles.css` (dark theme, panel typography, <900px bottom-drawer media query shell)
- [X] T003 [P] Create GitHub Actions workflow `.github/workflows/deploy.yml`: vitest → vite build → playwright (chromium against `vite preview` of that build) → deploy the same build to Pages; document Pages "GitHub Actions" source setting in `README.md`
- [X] T004 [P] Create `README.md` with project pitch, quickstart commands from `specs/001-cpu-building-story/quickstart.md`, and link to the founding design doc

**Checkpoint (M1)**: `npm run dev` shows empty dark page + panel shell; CI deploys it to Pages.

## Phase 2: Foundational — the 3D world & scene verbs

**Purpose**: Everything user stories depend on: the world, the verbs contract, shared data tables. No story content here (constitution II).

- [X] T005 [P] Create latency/location table (`Location`, `LocationId`, floors, `latencyCycles`) per data-model.md in `src/scene/locations.ts`, and pacing constants (`carry` 0.6s + 0.35s/floor, courier 12s/3s) in `src/scene/timing.ts`
- [X] T006 [P] Unit test: location table completeness/uniqueness in `tests/unit/locations.test.ts`
- [X] T007 Implement `src/scene/World.ts`: WebGL2/1 detection, renderer, scene, camera, OrbitControls, CSS2DRenderer overlay, resize handling, render loop with rolling-fps sampler hook
- [X] T008 Implement `src/scene/Building.ts`: procedural 10-story cutaway tower (front open), labeled lit floors (10/9/8/4) with rooms per design, dark floors 1–3/5–7, floor labels via CSS2D, raycast + label hover/click event emission, `reveal()`/`flash()` verbs
- [X] T009 [P] Implement `src/scene/effects/Neon.ts` (edge-glow materials, UnrealBloomPass wiring, `setQuality(on)`) and `src/scene/effects/Pulse.ts` (glowing pulse meshes + trail, spawn/dispose)
- [X] T010 [P] Implement `src/scene/Worker.ts`: low-poly character at desk on floor 10, register drawers (r1/r2), PC ticket dispenser, instruction card + `splitCard()`, animations `compute/read-card/idle/foot-tap`
- [X] T011 [P] Implement `src/scene/Lift.ts`: shaft spanning floors, car movement, `carry(pulse, from, to)` with duration from `timing.ts`, trip queueing
- [X] T012 [P] Implement `src/scene/Courier.ts`: warehouse across street, van, `courierTrip()` with fast-forward variant
- [X] T013 Implement `SceneVerbs` facade in `src/scene/index.ts` assembling World/Building/Worker/Lift/Courier/effects into the exact contract of `contracts/scene-verbs.md`, including `flyTo` vantage table and pointerdown-kills-camera-tween arbitration (research D6), `setMood()`
- [X] T014 Create dev harness page behind `?dev` flag in `src/main.ts` that lists every verb as a button for manual choreography testing (used by quickstart validation; also proves verbs work before any story exists)

**Checkpoint (M2)**: Deployed site shows the full neon cutaway building; `?dev` buttons trigger every verb correctly.

## Phase 3: User Story 1 — Follow the guided story (P1) 🎯 MVP

**Goal**: All 8 chapters playable start-to-finish with Next/pause, live orbit, hash deep-links.

**Independent test**: Click Next through all 8 chapters; pause/resume mid-animation; orbit during playback; reload with `#chapter-6`.

- [ ] T015 [P] [US1] Define `Chapter`/`Step` types and `parseMarkers()` pure function (with malformed-marker errors) in `src/story/types.ts` and `src/story/markers.ts`
- [ ] T016 [P] [US1] Unit test: marker parser round-trip + malformed cases in `tests/unit/markers.test.ts`
- [ ] T017 [US1] Implement `src/story/StoryEngine.ts`: state machine per data-model.md (waiting/playing/paused, next with fast-forward-no-overlap, pause/resume, chapter advance, freeplay unlock event, `#chapter-N` hash read/write with invalid→1 clamp)
- [ ] T018 [US1] Unit test: StoryEngine transitions, mash-Next fast-forward, hash clamp in `tests/unit/story-engine.test.ts` (GSAP mocked with instant timelines)
- [ ] T019 [US1] Implement `src/ui/NarrationPanel.ts`: book-style accumulating paragraphs (previous dimmed), chapter/step progress, Next button (pulses when waiting), pause/resume control, `showTiming()` latency bar
- [ ] T020 [US1] Write all 8 chapters' narration with `[[id:term]]` markers in `src/story/script.ts` (teaching voice per design doc: Worker, ticket dispenser, drawers, miss cascade foot-tap, "…millions of cycles later" gag, recap ladder; ch3 must include a beat explaining instruction cards were sent up to the L1i shelf in batches earlier — plants prefetch intuition)
- [ ] T021 [US1] Implement chapter cue functions `src/story/chapters/ch1-welcome.ts` through `ch4-decode.ts` (tour reveal sequence, worker's job, fetch via L1i, decode card split) using only `SceneVerbs`
- [ ] T022 [US1] Implement `src/story/chapters/ch5-execute.ts` through `ch8-recap.ts` (L1d hit + drawer store, L1→L2→RAM miss cascade with `showTiming`, courier disk trip with fast-forward, recap ladder + freeplay unlock signal)
- [ ] T023 [US1] Unit test: cue-integrity dry-run — every chapter builds against a stub `SceneVerbs`, only contract verbs called, every narration marker id exists in the `locations.ts` id table, every chapter ≥1 step, in `tests/unit/cue-integrity.test.ts` (registry cross-check happens in T026)
- [ ] T024 [US1] Wire bootstrap in `src/main.ts`: world + panel + engine + chapters, remove loading overlay, run quickstart chapter checklist items 1–8 manually and fix choreography

**Checkpoint (M3+M4 story half)**: Full story playable on the deployed site — this is the MVP.

## Phase 4: User Story 2 — Connect words to the world (P2)

**Goal**: Two-way hover/click sync between narration terms and 3D elements.

**Independent test**: Hover each highlighted term → correct element glows; click each labeled element → panel scrolls to its explanation.

- [ ] T025 [US2] Implement `src/sync/Highlighter.ts` registry (`register3D`, `registerSpan`, `glow`, `focusText`; unknown-id dev-throw/prod-warn) per data-model.md
- [ ] T026 [P] [US2] Unit test: registry operations + unknown-id behavior in `tests/unit/highlighter.test.ts`
- [ ] T027 [US2] Render marker spans as interactive highlights in `src/ui/NarrationPanel.ts` (hover → `glow`, focus style) and register all scene objects/labels with `Highlighter` in `src/scene/index.ts`; scene click/label-click → `focusText` scroll-and-flash
- [ ] T028 [US2] Manual validation: cross-cutting hover/click checks from quickstart on all chapters; ensure glow works with bloom disabled

**Checkpoint**: Words and world linked both directions on the deployed site.

## Phase 5: User Story 3 — Learn by playing (P3)

**Goal**: Free-play launcher with cycle counter and hit/miss scoreboard after the recap.

**Independent test**: Finish story → fire each op × each location → correct journey, correct cycles, correct tallies.

- [ ] T029 [P] [US3] Implement free-play logic (request resolution, weighted RNG with injectable seed per research D9, cycle lookup, hit/miss rules, scoreboard counters/reset) in `src/story/freeplay.ts`
- [ ] T030 [P] [US3] Unit test: resolution, weighted distribution with seeded RNG, cycles = latency table (SC-006), scoreboard math in `tests/unit/freeplay.test.ts`
- [ ] T031 [US3] Implement `src/ui/FreePlayPanel.ts`: op × location pickers, Fire button, live cycle counter animation, scoreboard display, reset; swap into panel on StoryEngine freeplay unlock
- [ ] T032 [US3] Wire free-play requests to scene journeys (spawn/carry/courier/deliver per resolved location) in `src/story/freeplay.ts` + `src/main.ts`; run quickstart free-play validation

**Checkpoint (M5)**: Free play live on the deployed site.

## Phase 6: Polish & Cross-Cutting

- [ ] T033 [P] Implement fps watchdog auto-step-down (pure decision function + render-loop feed) and settings chip with manual quality toggle in `src/scene/effects/Neon.ts` + `src/ui/` corner chip; unit test decision function in `tests/unit/quality.test.ts`
- [ ] T034 [P] Implement no-WebGL fallback `src/fallback/static-page.ts`: inline-SVG labeled building + full story text rendered from `script.ts` (markers → emphasis), switched at bootstrap in `src/main.ts`
- [ ] T035 [P] Tab-visibility pause/resume (only auto-resume what auto-paused) in `src/story/StoryEngine.ts` + unit test in `tests/unit/story-engine.test.ts`
- [ ] T036 [P] Finish <900px bottom-drawer responsive layout in `src/styles.css` + drawer toggle in `src/ui/NarrationPanel.ts`
- [ ] T037 Playwright smoke test in `tests/smoke/story.spec.ts`: page loads, canvas present, Next advances narration text, `#chapter-6` deep-link works; wire into CI ahead of deploy step
- [ ] T038 Final pass: run full quickstart manual checklist on the deployed Pages site, tune pacing constants in `src/scene/timing.ts`, confirm bundle < 2 MB gzipped, tag `v1.0.0`

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3 (US1)** are strictly sequential prerequisites.
- **US2 (Phase 4)** depends on US1's panel + script markers existing; independent of US3.
- **US3 (Phase 5)** depends on Phase 2 verbs + US1's engine unlock event; independent of US2.
- **Phase 6** items are independent of each other; T037–T038 last.
- US2 and US3 can be built in either order (or in parallel) after US1.

### Parallel opportunities

- Phase 2: T005+T006 ∥ T009 ∥ T010 ∥ T011 ∥ T012 (after T007–T008 for the ones touching the scene graph: T010–T012 need Building floor positions from T008)
- Phase 3: T015+T016 ∥ T019 while T017–T018 proceed; T020 (writing) parallel to everything
- Phase 6: T033 ∥ T034 ∥ T035 ∥ T036

## Implementation Strategy

Ship the MVP as Phases 1–3 (US1): the guided story alone delivers the full learning outcome. Add US2 (highlight sync) next for the "alive" feel, then US3 (free play). Polish phase hardens what already works. Every checkpoint ends deployed (constitution VI) — send your brother the link as early as the M3 checkpoint.
