# CPU Building 3D

Interactive 3D web explainer teaching CPU fundamentals (fetch–decode–execute, the memory
hierarchy and pipelining) as a nine-chapter story set in a 10-story building. Three.js + TypeScript + Vite + GSAP,
no UI framework. Static site — no backend, no runtime network calls, all geometry
procedural. Deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Commands

```bash
npm run dev          # Vite dev server → http://localhost:5173
npm run test         # Vitest unit tests (tests/unit/)
npm run build        # tsc --noEmit + vite build → dist/
npm run size         # gzip size of dist/assets/*.js vs the 215 kB budget (CI runs it too)
npm run test:smoke   # Playwright smoke tests — run `npm run build` FIRST (serves dist/)
```

Useful URL params on the app: `?dev` (buttons for every scene verb — manual
choreography testing), `?lowq` (start at the lowest quality tier; headless/weak GPUs),
`?nowebgl` (force the static fallback), `#chapter-N` (deep-link a chapter, 1–9),
`?cam=free|follow|cinematic`, `?xray`, `?view=worker`, and `?debug` (exposes
`window.__cpu = { view(), ledger(), scene }` for tests and inspection — never relied on by app code).

## Architecture — the one rule that matters

**Scene–Story separation is NON-NEGOTIABLE** (constitution II, enforced by
`tests/unit/cue-integrity.test.ts`):

- `src/scene/` exposes animation **verbs** (`carry`, `flash`, `flyTo`, `courierTrip`…)
  via the `SceneVerbs` interface in `src/scene/index.ts`. It never knows what chapter
  is playing. The verb contracts are `specs/001-cpu-building-story/contracts/scene-verbs.md`
  (v1) and `specs/002-cpu-building-v2/contracts/scene-verbs-v2.md` (v2 delta) — **keep
  three places in sync when adding a verb**: the `SceneVerbs` interface, the contract
  doc, and the `CONTRACT_VERBS` list in `tests/unit/cue-integrity.test.ts` (the
  stand-in `SceneVerbs` in `tests/unit/access-tracker.test.ts` needs it too).
- `src/story/` sequences those verbs inside GSAP timelines. It never touches meshes,
  materials, or the renderer. One chapter file per chapter in `src/story/chapters/`;
  each pairs narration (from `script.ts`) with cue functions via `makeChapter`.
- `src/sync/Highlighter.ts` is the only bridge between panel text and 3D glow.
- `src/ui/` is plain DOM (NarrationPanel, FreePlayPanel, ViewDock, AidsDock, LevelLadder,
  LocalityStrip).
- **Learner controls are not story beats.** Camera mode, Worker view, X-ray and quality live
  on `ViewControls` (`src/scene/view/controls.ts`, state in the pure `ViewState`); only
  `main.ts` and `src/ui/` receive it, so the story layer cannot flip them. `Scene`
  implements both interfaces.
- **The camera has one owner**, `CameraRig` (`src/scene/camera/`). A story `flyTo` is a *shot
  request* decided at play time by the learner's mode (Free = v1 lerp, Cinematic = wall-safe
  arc, Follow = tracks the pulse, Worker view = ignored). Any pointer/wheel/touch/key input
  cancels scripted motion synchronously and shows "Resume camera".
- **Telemetry is derived, never fed.** `AccessTracker` (`src/scene/telemetry/`) wraps
  `flash`, `carry`, `courierTrip`, `deliver`, `workerWork` and attaches ledger updates to
  each verb's *own timeline* (so pause, fast-forward and kill all work). `CycleLedger` is
  pure; the meter, ladder, X-ray scale and idle counter only read it. A journey costs
  exactly the *serving* level's latency, not the sum of levels checked. `main.ts` calls
  `scene.resetTelemetry()` on a chapter jump, a free-play reset and when free play unlocks.
- **Pipelining** is data: `buildSchedule` (`src/scene/pipelineSchedule.ts`, pure) produces the
  ticks, bubbles and stalls; `PipelineLine` only plays them. The scene never infers a hazard.

Other single-sources-of-truth:

- **All narration text** lives in `src/story/script.ts` with `[[id:term]]` markers;
  ids must exist in `ALL_HIGHLIGHT_IDS` (`src/scene/locations.ts`). The no-WebGL
  fallback renders from the same file — never fork the text.
- **Latency numbers** (registers 0 / L1 4 / L2 12 / RAM 200 / disk 4M cycles) live
  only in `src/scene/locations.ts`; **animation pacing** only in `src/scene/timing.ts`.
- Narration paragraph count per chapter must equal cue count — `makeChapter` throws
  otherwise, and the cue-integrity test catches it.
- **Chapters 1–8 are frozen** (FR-031): `git diff 130a23f -- src/story/chapters/ch[1-8]*.ts`
  must stay empty. New teaching goes in new chapter files (chapter 9 is the pattern).
- **Bundle budget**: 215 kB gzip for the JS (`npm run size`). No new runtime dependencies;
  everything is procedural, no downloaded assets.

## Testing expectations (constitution IV)

Everything non-visual gets a Vitest test; choreography is verified by eye against the
per-chapter checklist in `specs/001-cpu-building-story/quickstart.md`. Playwright
smoke (9 tests) gates deploy in CI — a failing smoke test blocks the Pages deploy, so run
`npx playwright install chromium` once, then `npm run build && npm run test:smoke`
locally before merging to master. GSAP is stubbed in engine tests (see FakeTimeline
in `tests/unit/story-engine.test.ts`).

## Gotchas learned the hard way

- `StoryEngine` writes `location.hash`; the browser echoes it back as a `hashchange`
  event — the engine tracks `lastWrittenHash` to ignore its own writes. Don't remove.
- Deep links skip chapter 1's reveals, so `main.ts` pre-reveals all rooms when
  starting past chapter 1.
- Headless Chromium renders WebGL on a software rasterizer — bloom makes it crawl.
  Smoke tests that interact must use `?lowq`. Every action on the 3D page still takes
  0.5–1.5 s there, so tests that drive many of them need `test.setTimeout(SLOW_TEST_MS)`
  (the 60 s default is not enough), and should jump chapters by `location.hash` rather
  than reload the page. Locate dock buttons by their accessible name — the quality
  button's comes from its `aria-label` ("Graphics quality…"), so use `/quality/i`.
- npm on Windows sometimes drops `@rollup/rollup-win32-x64-msvc` (optional-deps bug);
  if rollup fails with MODULE_NOT_FOUND, delete `node_modules` and reinstall — do NOT
  add the package to `package.json` directly, since that forces it as a mandatory dep
  on every platform and breaks `npm ci` on Linux CI runners (EBADPLATFORM).

## Spec-driven workflow

This repo uses GitHub Spec Kit. Governance: `.specify/memory/constitution.md` (v1.0.0).
Feature docs: `specs/001-cpu-building-story/` (spec → plan → research → data-model →
contracts → quickstart → tasks, all 38 tasks done, tagged v1.0.0). Founding design doc:
`docs/superpowers/specs/2026-07-03-cpu-building-3d-design.md`. New features should go
through `/speckit-specify → clarify → plan → tasks → implement` (skills in
`.claude/skills/`). v2 (`specs/002-cpu-building-v2/`) is built through Milestone 3 (visuals +
cameras, X-ray + live aids, chapter 9); local milestone tags `v2-m1`, `v2-m2`, `v2-m3`.

## Deployment status

Remote: `kathir-ks/computer-architecture`. Pages source is "GitHub Actions". CI runs
unit tests → build → size budget → smoke → deploy on every push to main/master (and on
manual "Run workflow"). If a deploy run fails, the live site stays on the last
successful build — check which step failed before re-running. v2 ships in milestones on
branch `002-cpu-building-v2` (local tags `v2-m1`, `v2-m2`); merge to master only with
the full local gate green.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/002-cpu-building-v2/plan.md
<!-- SPECKIT END -->
