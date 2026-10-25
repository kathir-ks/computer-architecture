# CPU Building 3D 🏢⚡

An interactive, web-based 3D story that teaches how a CPU works — built for anyone
starting out in computer architecture.

The processor is a **10-story building**: the Worker (your ALU + control unit) sits at
a desk on floor 10 with register drawers in arm's reach. The L1 cache shelves are one
floor below, the L2 storeroom below that, the vast RAM archive down on floor 4 — and
the disk is a warehouse across the street. Data moves as glowing pulses in the lift,
and **latency is something you feel**: one floor is instant, floor 4 takes a while,
and the courier van to the warehouse takes… *millions of cycles*.

A 9-chapter guided story covers the fetch–decode–execute cycle, the memory hierarchy
and finally **pipelining** (an assembly line, then the hazards that stall it). Then a
**free-play mode** lets you fire your own instructions and watch the cycle counter
climb.

## What's in v2

- **Better look** — a lit, textured building with windows, soft shadows, bloom and
  particle trails on moving data, a more characterful Worker, and an automatic
  quality step-down for weak GPUs (`high` → `medium` → `low`; the Quality chip cycles
  it by hand).
- **Four ways to look** — *Follow* the data as it travels, a *Cinematic* directed camera,
  *Free* (the original behaviour), and a **Worker first-person view** from the desk.
  Touching the view always takes the camera from the story; **Resume camera** hands it
  back.
- **X-ray** — fades the walls, labels every floor by its role and shows a latency scale
  (0 / 4 / 12 / 200 / 4,000,000 cycles) whose marker follows the data.
- **Live aids** — a cycle meter for the current access, a memory ladder (which levels
  were checked, which one served it), a waiting-versus-working counter for the Worker,
  and a small locality toy that shows why a miss brings its neighbours along.
- **Chapter 9 · Pipelining** — an assembly line on floor 10 with a board comparing
  pipelined and one-at-a-time ticks.
- **Hit / miss feedback** that differs by *shape and motion*, not just colour, and full
  support for the OS "reduce motion" setting.

## Run it locally

```bash
npm install
npm run dev        # → http://localhost:5173
```

### URL parameters

| Parameter | Effect |
|-----------|--------|
| `#chapter-N` | Open chapter N (1–9) |
| `?cam=free\|follow\|cinematic` | Start in that camera mode (default `cinematic`) |
| `?xray` | Start with X-ray on |
| `?view=worker` | Start in the Worker's first-person view |
| `?lowq` | Start at the lowest graphics tier (weak GPUs, headless tests) |
| `?nowebgl` | Force the static no-3D fallback (same story text, from the same source) |
| `?dev` | Buttons for every scene verb — manual choreography testing |
| `?debug` | Expose `window.__cpu` (`view()`, `ledger()`, `scene`) for tests and inspection |

## Validate

```bash
npm run test       # unit tests (story engine, cue integrity, ledger, schedule, cameras…)
npm run build      # type-check + production bundle → dist/
npm run size       # gzip size of the JS bundle against the 215 kB budget
npx playwright install chromium   # once
npm run test:smoke # Playwright smoke tests against the built preview (build first)
```

The smoke tests render WebGL on a software rasteriser, so they are slow (a few minutes);
a failing smoke test blocks the Pages deploy, so run them before merging to `master`.

## Deployment

Pushes to `main` / `master` run the unit tests, build, size budget and smoke tests, then
deploy `dist/` to GitHub Pages via `.github/workflows/deploy.yml` (it can also be run by
hand from the Actions tab). One-time repo setting: **Settings → Pages → Source →
"GitHub Actions"**. If a run fails, the site stays on the last successful build — check
which step failed before re-running.

## How it's built

Three.js + TypeScript + Vite + GSAP, no UI framework, everything procedural (no
downloaded assets). The architecture keeps a strict boundary: `src/scene/` exposes
animation *verbs* (`carry`, `flash`, `flyTo`, `pipelineRun`…) and knows nothing about the
story; `src/story/` scripts those verbs into GSAP timelines and never touches a mesh.
All narration lives in one file, `src/story/script.ts`; latency numbers in
`src/scene/locations.ts`; pacing in `src/scene/timing.ts`.

Learner controls (camera mode, Worker view, X-ray, quality) are a separate interface,
`ViewControls`, that only `main.ts` and `src/ui/` receive — the story cannot change
them. The cycle meter, ladder, scale and idle counter are all derived from one pure
`CycleLedger` that watches the verbs the story already calls, so they cannot disagree
with each other or with the free-play scoreboard.

This project is spec-driven (GitHub Spec Kit): `specs/001-cpu-building-story/` is v1 and
`specs/002-cpu-building-v2/` is v2 (spec, plan, research, data model, contracts,
tasks). `docs/superpowers/specs/` holds the founding design document.
