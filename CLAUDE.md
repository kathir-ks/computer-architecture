# CPU Building 3D

Interactive 3D web explainer teaching CPU fundamentals (fetch–decode–execute + memory
hierarchy) as a story set in a 10-story building. Three.js + TypeScript + Vite + GSAP,
no UI framework. Static site — no backend, no runtime network calls, all geometry
procedural. Deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Commands

```bash
npm run dev          # Vite dev server → http://localhost:5173
npm run test         # Vitest unit tests (tests/unit/)
npm run build        # tsc --noEmit + vite build → dist/
npm run test:smoke   # Playwright smoke tests — run `npm run build` FIRST (serves dist/)
```

Useful URL params on the app: `?dev` (buttons for every scene verb — manual
choreography testing), `?lowq` (start with bloom off; headless/weak GPUs),
`?nowebgl` (force the static fallback), `#chapter-N` (deep-link a chapter).

## Architecture — the one rule that matters

**Scene–Story separation is NON-NEGOTIABLE** (constitution II, enforced by
`tests/unit/cue-integrity.test.ts`):

- `src/scene/` exposes animation **verbs** (`carry`, `flash`, `flyTo`, `follow`, `courierTrip`…)
  via the `SceneVerbs` interface in `src/scene/index.ts`. It never knows what chapter
  is playing. The verb contract is documented in
  `specs/001-cpu-building-story/contracts/scene-verbs.md` — keep interface, doc, and
  the `CONTRACT_VERBS` list in the cue-integrity test in sync when adding a verb.
- `src/story/` sequences those verbs inside GSAP timelines. It never touches meshes,
  materials, or the renderer. One chapter file per chapter in `src/story/chapters/`;
  each pairs narration (from `script.ts`) with cue functions via `makeChapter`.
- `src/sync/Highlighter.ts` is the only bridge between panel text and 3D glow.
- `src/ui/` is plain DOM (NarrationPanel, FreePlayPanel).

Other single-sources-of-truth:

- **All narration text** lives in `src/story/script.ts` with `[[id:term]]` markers;
  ids must exist in `ALL_HIGHLIGHT_IDS` (`src/scene/locations.ts`). The no-WebGL
  fallback renders from the same file — never fork the text.
- **Latency numbers** (registers 0 / L1 4 / L2 12 / RAM 200 / disk 4M cycles) live
  only in `src/scene/locations.ts`; **animation pacing** only in `src/scene/timing.ts`.
- Narration paragraph count per chapter must equal cue count — `makeChapter` throws
  otherwise, and the cue-integrity test catches it.

## Testing expectations (constitution IV)

Everything non-visual gets a Vitest test; choreography is verified by eye against the
per-chapter checklist in `specs/001-cpu-building-story/quickstart.md`. Playwright
smoke (4 tests) gates deploy in CI. GSAP is stubbed in engine tests (see FakeTimeline
in `tests/unit/story-engine.test.ts`).

## Gotchas learned the hard way

- `StoryEngine` writes `location.hash`; the browser echoes it back as a `hashchange`
  event — the engine tracks `lastWrittenHash` to ignore its own writes. Don't remove.
- Deep links skip chapter 1's reveals, so `main.ts` pre-reveals all rooms when
  starting past chapter 1.
- Headless Chromium renders WebGL on a software rasterizer — bloom makes it crawl.
  Smoke tests that interact must use `?lowq`.
- If rollup/rolldown fails with MODULE_NOT_FOUND on a `*-win32-x64-msvc` binding,
  first check `npm config get os` — an `os=linux` line in `~/.npmrc` was the real
  cause on this machine (makes npm skip all win32 optional packages); remove it, then
  delete `node_modules` + `package-lock.json` and reinstall. Do NOT add the binding
  package to `package.json` directly — that forces it as a mandatory dep on every
  platform and breaks `npm ci` on Linux CI runners (EBADPLATFORM).
- Camera verbs (`flyTo`, `follow`) share one `CameraSlot` — creating either kills the
  previous owner *at cue build time*. That's safe: GSAP's `add()` revives a killed
  child timeline (verified empirically), which is also why v1's chained flyTos worked.
- The lift's glass tube must keep `depthWrite: false` (single convex transparent
  shell) — anything else brings back transparency-sorting artifacts around the car.
- User orbit is clamped to `VIEW_ARC` (azimuth ±80° from the open +z face, polar
  0.15π–0.52π). Any new `VANTAGES` entry must sit inside it — `camera-arc.test.ts`
  fails otherwise. Nothing story-relevant may be placed behind the building.
- Colors live only in `PALETTE` (`src/scene/Building.ts`); `Environment.ts` is inert
  set dressing — it must never register clickables or gain scene verbs.

## Spec-driven workflow

This repo uses GitHub Spec Kit. Governance: `.specify/memory/constitution.md` (v1.0.0).
Feature docs: `specs/001-cpu-building-story/` (spec → plan → research → data-model →
contracts → quickstart → tasks, all 38 tasks done, tagged v1.0.0). Founding design doc:
`docs/superpowers/specs/2026-07-03-cpu-building-3d-design.md`. New features should go
through `/speckit-specify → clarify → plan → tasks → implement` (skills in
`.claude/skills/`). Future planned chapter: pipelining (add verbs + chapter files —
never rework existing chapters).

## Deployment status

No GitHub remote yet. To go live: create the repo, push (with tags), then set
Settings → Pages → Source = "GitHub Actions". CI runs unit tests → build → smoke →
deploy on every push to main/master.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/002-cutaway-visual-upgrade/plan.md
<!-- SPECKIT END -->
