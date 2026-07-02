# Implementation Plan: CPU Building Story — Interactive 3D Memory Hierarchy Explainer

**Branch**: `main` (solo project, milestone-based; no feature branch) | **Date**: 2026-07-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-cpu-building-story/spec.md`

## Summary

A static, single-bundle web app that teaches the fetch–decode–execute cycle and memory hierarchy through an 8-chapter narrated story in a 3D cutaway building, followed by a free-play mode. Technical approach: Three.js renders the procedural building world; GSAP timelines choreograph story steps as sequences of scene "verbs"; a plain HTML/CSS narration panel syncs two-way with the 3D scene through a highlight registry; Vite builds it; GitHub Pages hosts it. Full product rationale in the founding design doc: [2026-07-03-cpu-building-3d-design.md](../../docs/superpowers/specs/2026-07-03-cpu-building-3d-design.md).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), ES2022 target

**Primary Dependencies**: three (r16x), gsap (3.x), vite (6.x); dev: vitest, playwright, typescript

**Storage**: None (URL hash carries chapter state; no persistence)

**Testing**: Vitest (unit: story engine, marker parsing, cue integrity, free-play logic); Playwright (smoke: load, canvas, Next advances)

**Target Platform**: Desktop evergreen browsers (Chrome/Edge/Firefox/Safari), WebGL2 with WebGL1/static fallback; hosted on GitHub Pages

**Project Type**: Single static web app (no backend)

**Performance Goals**: 30+ fps on integrated graphics (Intel Iris Xe class); < 2 MB gzipped bundle; interactive < 3 s on campus Wi-Fi

**Constraints**: No network requests after page load; no downloaded models/textures (procedural geometry only); no UI framework

**Scale/Scope**: 8 chapters × ~3–6 steps each; ~6 highlightable locations; 1 character; ~15 scene verbs; 5 free-play data locations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Learner-First Clarity | ✅ | All narration lives in `src/story/script.ts`; every visual effect maps to a teaching purpose (glow = "you are here", pulse = data in motion, travel time = latency) |
| II | Scene–Story Separation | ✅ | Plan enforces `scene/` verbs + `story/` scripts; the cue-integrity test makes violations fail CI |
| III | Static Simplicity | ✅ | Runtime deps limited to three + gsap; procedural geometry; single Vite bundle; no fetches post-load |
| IV | Test What Isn't Pixels | ✅ | Vitest for engine/parsing/cues/free-play; per-chapter manual checklist (quickstart.md); Playwright smoke gates deploy |
| V | Performance on Modest Hardware | ✅ | Bloom toggle + fps watchdog auto-disable; low-poly budget; WebGL/no-WebGL fallbacks planned |
| VI | Ship Each Milestone | ✅ | 6 milestones, each ends deployed via GitHub Actions to Pages |

**Post-Phase-1 re-check**: PASS — design artifacts introduce no new dependencies or boundary violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-cpu-building-story/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output (validation + manual chapter checklist)
├── contracts/
│   └── scene-verbs.md   # Phase 1 output (scene layer public API)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
index.html                  # canvas + narration panel skeleton
vite.config.ts
src/
├── main.ts                 # bootstrap: WebGL check, world, panel, engine wiring
├── scene/                  # 3D world — exposes verbs, knows nothing of chapters
│   ├── World.ts            # renderer, camera, orbit controls, render loop, fps watchdog
│   ├── Building.ts         # cutaway tower, floors, labels, highlight targets
│   ├── Worker.ts           # character, desk, register drawers, work/idle animations
│   ├── Lift.ts             # shaft, car, pulse-carry between floors
│   ├── Courier.ts          # van, warehouse, street trip
│   └── effects/
│       ├── Neon.ts         # edge glow materials, bloom pass, quality toggle
│       └── Pulse.ts        # data pulse meshes + trails
├── story/                  # narrative — calls scene verbs, never touches meshes
│   ├── StoryEngine.ts      # chapter/step state machine, play/pause/next, hash sync
│   ├── script.ts           # ALL narration text with [[id:term]] markers
│   └── chapters/
│       ├── ch1-welcome.ts … ch8-recap.ts   # cue functions per chapter
├── ui/
│   ├── NarrationPanel.ts   # book-style text, progress, Next/pause, timing bar
│   └── FreePlayPanel.ts    # op × location launcher, cycle counter, scoreboard
├── sync/
│   └── Highlighter.ts      # two-way id → (span, object3d) glow registry
└── fallback/
    └── static-page.ts      # no-WebGL illustrated fallback
tests/
├── unit/                   # story-engine, script-markers, cue-integrity, free-play
└── smoke/                  # playwright: load, canvas, next-advances
.github/workflows/deploy.yml # test + build + Pages deploy
```

**Structure Decision**: Single static web app. The four top-level `src/` areas map 1:1 to the constitution's boundary rule: `scene/` (verbs), `story/` (scripts), `ui/` (panel), `sync/` (the only bridge).

## Complexity Tracking

No constitution violations; table not needed.
