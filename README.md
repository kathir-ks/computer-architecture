# CPU Building 3D 🏢⚡

An interactive, web-based 3D story that teaches how a CPU works — built for anyone
starting out in computer architecture.

The processor is a **10-story building**: the Worker (your ALU + control unit) sits at
a desk on floor 10 with register drawers in arm's reach. The L1 cache shelves are one
floor below, the L2 storeroom below that, the vast RAM archive down on floor 4 — and
the disk is a warehouse across the street. Data moves as glowing pulses in the lift,
and **latency is something you feel**: one floor is instant, floor 4 takes a while,
and the courier van to the warehouse takes… *millions of cycles*.

An 8-chapter guided story covers the fetch–decode–execute cycle and the memory
hierarchy, then a **free-play mode** lets you fire your own instructions and watch the
cycle counter climb.

**v2 look**: the tower is an open-faced *dollhouse cutaway* in pastel daylight — every
room stays visible while the story plays, the camera is clamped to a front viewing arc
so the action can never hide behind a wall, tracking shots follow the courier van and
the lift on long trips, and the building sits in a small living neighborhood (trees,
streetlights, drifting clouds).

## Run it locally

```bash
npm install
npm run dev        # → http://localhost:5173
```

## Validate

```bash
npm run test       # unit tests (story engine, markers, cue integrity, free play)
npm run build      # type-check + production bundle → dist/
npm run test:smoke # Playwright smoke tests against the built preview
```

## Deployment

Pushes to `main` run tests, build, smoke-test the build, and deploy `dist/` to GitHub
Pages via `.github/workflows/deploy.yml`. One-time repo setting: **Settings → Pages →
Source → "GitHub Actions"**.

## How it's built

Three.js + TypeScript + Vite + GSAP, no UI framework. The architecture keeps a strict
boundary: `src/scene/` exposes animation *verbs* (`lift.carry(...)`,
`building.flash(...)`) and knows nothing about the story; `src/story/` scripts those
verbs into GSAP timelines and never touches a mesh. All narration lives in one file,
`src/story/script.ts`.

This project is spec-driven — see `specs/001-cpu-building-story/` (the original
story feature) and `specs/002-cutaway-visual-upgrade/` (the v2 visual/camera upgrade)
for specifications, plans, and task breakdowns, and `docs/superpowers/specs/` for the
founding design document.
