# CPU Building 3D — Design Spec

**Date:** 2026-07-03
**Status:** Approved pending final review
**Audience:** A third-year engineering student learning computer architecture (and anyone else who finds it).

## 1. Purpose

An interactive, web-based 3D explainer that teaches CPU fundamentals — the fetch–decode–execute cycle and the memory hierarchy — through a spatial story: the CPU is a 10-story building, and memory latency is felt as physical travel time. A guided narrated story builds intuition first; a free-play mode lets the learner cement it by firing instructions themselves.

## 2. Product decisions (settled)

| Decision | Choice |
|---|---|
| Experience shape | Story-first with live camera; free play unlocks after the story (option C) |
| v1 scope | Memory hierarchy + full fetch–decode–execute; pipelining deferred to a later "chapter 2" |
| Narration | Text panel with synchronized highlights (hover a term → 3D element glows, and reverse) |
| Platform | Desktop browser, hosted on GitHub Pages; graceful degradation below ~900px, no full mobile support |
| Visual style | Hybrid: architectural cutaway "dollhouse" building + neon data pulses and edge glow |
| Screen layout | 3D view left, persistent narration/reading panel right (side panel) |
| Tech stack | Vanilla Three.js + TypeScript + Vite + GSAP; no framework. New standalone repo. |

## 3. The world

A 10-story cutaway tower (front wall removed) in warm architectural materials with neon-cyan edge lighting; data moves as magenta light pulses.

| Location | Maps to | Analogy |
|---|---|---|
| Floor 10 | Core | The **Worker** (ALU + control unit personified) at a desk. Desk drawers = **registers** (instant reach). Program counter = ticket dispenser on the desk. |
| Floor 9 | L1 cache | Two small rooms: instruction shelf (L1i) and data shelf (L1d). One lift-floor ≈ a few cycles. |
| Floor 8 | L2 cache | One larger storage room — slower, bigger. |
| Floor 4 | RAM | A huge archive floor spanning the building's width — big but far. |
| Outside | Disk | Warehouse across the street; a courier van makes the trip. |
| Lift shaft | Buses | Glowing lift carries data pulses between floors; travel time is real and felt. |

Floors 1–3 and 5–7 exist but are dark/unlabeled — they make the height (latency) feel real and leave room for L3/other concepts later.

Reference latencies shown in the timing bar: register ≈ 0 (same desk), L1 = 4 cycles, L2 = 12, RAM = 200, disk = millions.

## 4. The story (8 chapters)

Each chapter is a sequence of steps; each step = one narration paragraph + one GSAP timeline. The user advances with **Next**, may pause, and may orbit the camera at any time.

1. **Welcome to the building** — camera tour from street level; labeled floors light up as introduced.
2. **The Worker's job** — meet the Worker; a program is a stack of instruction cards stored down in memory.
3. **Fetch** — the next card arrives from the L1 instruction shelf; program counter as ticket dispenser.
4. **Decode** — the card is read ("ADD the value in drawer R1 to the value at address 0x2F40") and visually splits into *what to do* and *where the data is*.
5. **Execute + happy path** — value found in L1d; lift down one floor and back in a flash; result into a drawer.
6. **The miss cascade** — data not in L1 → not in L2 → full lift ride to RAM on floor 4; Worker taps their foot; timing bar compares 4 / 12 / 200 cycles.
7. **The disk trip** — courier van to the warehouse; "…millions of cycles later" fast-forward gag; motivates why caches exist.
8. **Recap + free play unlocked** — latency ladder side by side; panel switches to free-play controls.

## 5. Free play

The panel becomes an instruction launcher: pick an operation (LOAD / ADD / STORE) and where the data lives (L1 / L2 / RAM / disk / random). Firing it drives the same scene verbs the story used, with a live cycle counter and a hit/miss scoreboard — cache locality learned through play.

## 6. Screen layout & interaction

- **Left:** full-height 3D canvas, orbit controls always live. Camera *fly-to* cues ease toward targets but release the moment the user drags.
- **Right:** narration panel — story text accumulates like a book (previous paragraphs dimmed above), chapter progress, Next/pause controls, timing bar when relevant.
- **Highlight sync:** narration is authored with `[[id:term]]` markers rendered as highlighted spans. Hover span → neon outline on the registered 3D object. Click a 3D object → the panel scrolls to and flashes the first mention of that term. Identical behavior in story and free play.
- **URL hash** reflects the current chapter (`#chapter-6`) for bookmarking/sharing.

## 7. Code architecture

Static site, single Vite bundle, no backend, no external assets (all geometry procedural).

```
cpu-building-3d/
├── index.html            # canvas + narration panel skeleton
├── src/
│   ├── main.ts           # bootstrap: scene, panel, story engine
│   ├── scene/            # the 3D world (knows nothing about the story)
│   │   ├── World.ts      # scene, camera, renderer, lights, orbit controls
│   │   ├── Building.ts   # cutaway tower, floors, labels
│   │   ├── Worker.ts     # character + desk + register drawers
│   │   ├── Lift.ts       # lift shaft, car, data-pulse movement
│   │   ├── Courier.ts    # van + warehouse (disk)
│   │   └── effects/      # neon edges, glow/highlight, pulse trails
│   ├── story/            # the narrative (knows nothing about Three.js)
│   │   ├── StoryEngine.ts    # chapter/step state machine, play/pause/next
│   │   ├── chapters/         # one file per chapter: narration + cues
│   │   └── script.ts         # all narration text in one place
│   ├── ui/
│   │   ├── NarrationPanel.ts # text, highlights, progress, Next button
│   │   └── FreePlayPanel.ts  # instruction launcher, hit/miss scoreboard
│   └── sync/
│       └── Highlighter.ts    # two-way term↔3D-object glow registry
└── docs/superpowers/specs/
```

**Key boundary:** `scene/` exposes verbs (`lift.carry(pulse, from, to)`, `worker.playWork()`, `building.highlight('l1d')`); `story/` chapters are scripts calling those verbs inside GSAP timelines. The story never touches meshes; the scene never knows the chapter. This is what makes the future pipeline chapter purely additive (new verbs + new chapter files).

**Sync registry:** panel and scene register elements under shared IDs (`'l1d'`, `'ram'`, `'pc'`); `Highlighter` routes hover/click both directions.

## 8. Story engine mechanics

State: `(chapterIndex, stepIndex, status: playing | paused | waiting)`.

On **Next**: advance step → panel shows its paragraph → the step's cue function builds and plays a GSAP timeline of scene verbs → status `playing`; on timeline completion, `waiting` (Next button pulses). **Pause** freezes the timeline mid-flight (native GSAP); resume continues exactly. Tab hidden → timelines pause; visible → resume.

## 9. Robustness

- **Performance budget:** low-poly procedural geometry only; `UnrealBloomPass` is the one real GPU cost. Quality toggle (bloom on/off), auto-disabled if the first seconds render below ~30 fps. Target: smooth on an average laptop with integrated graphics.
- **No WebGL:** startup detection → static labeled illustration of the building with full story text readable below.
- **Loading:** no network calls after page load; a "powering up the building…" loader covers the JS bundle.
- **Resize:** canvas/camera adapt; below ~900px the panel folds into a bottom drawer (graceful, not polished mobile).

## 10. Testing

Automated (Vitest) — everything that isn't pixels:
- `StoryEngine` state transitions (next/prev/pause/resume, chapter boundaries, hash sync).
- Script marker parsing; every `[[id:…]]` resolves to a registered highlight ID.
- **Cue integrity dry-run:** walk every chapter's cues, assert each references only real scene verbs and registered element IDs — no rendering. Keeps story and scene honest against each other.
- Free-play cycle counting and hit/miss bookkeeping.

Manual: per-chapter visual checklist (camera framing, pulse visibly travels, no clipping) before each deploy.

Smoke (Playwright): page loads, canvas renders, Next advances narration — a broken deploy can't ship silently.

## 11. Milestones

Each milestone ends deployed to GitHub Pages and viewable.

1. **Skeleton** — Vite/TS/Three.js boots, placeholder building, orbit camera, empty panel, CI deploy.
2. **The world** — full cutaway tower, labeled floors, lift, Worker, courier van, neon styling.
3. **Story engine + chapters 1–4** — Next/pause machinery, camera choreography, fetch/decode.
4. **Chapters 5–8 + highlight sync** — miss cascade, disk trip, recap; two-way glow.
5. **Free play** — launcher, cycle counter, scoreboard.
6. **Polish** — quality toggle, no-WebGL fallback, small-screen drawer, pacing tune-up.

## 12. Out of scope for v1

- Pipelining chapter (designed-for, not built): multiple workers as an assembly line — future chapter 2.
- Audio narration.
- Full mobile/touch experience.
- Multicore, branch prediction, virtual memory detail (page tables), superscalar — candidates for later chapters.
