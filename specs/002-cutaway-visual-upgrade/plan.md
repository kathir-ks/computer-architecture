# Implementation Plan: Cutaway Visual Upgrade (v2)

**Branch**: `master` (solo project, milestone-based; no feature branch) | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-cutaway-visual-upgrade/spec.md`

## Summary

Visual and camera upgrade of the shipped v1 explainer, teaching content unchanged. Four workstreams: (1) finish the cutaway — the building's front face is already open, but dark filler blocks, side-wall angles, and unclamped orbit still hide the action; remove fillers, dress every floor as an open room, and clamp the orbit to a front viewing arc; (2) restyle from night-neon to a pastel daylight diorama with per-function floor hues and saturated "actor" colors; (3) add a `follow` scene verb (camera tracks courier/lift/pulse from outside) and retune chapter vantages/cues for the new framing; (4) add a non-interactive living environment (neighbor buildings, trees, streetlights, drifting clouds). All within the existing scene–story contract: one new verb, no narration changes.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), ES2022 target — unchanged from 001

**Primary Dependencies**: three (r16x), gsap (3.x), vite (6.x); dev: vitest, playwright — no new dependencies

**Storage**: None (URL hash carries chapter state)

**Testing**: Vitest (cue integrity extended for `follow`, vantage-arc test, environment bookkeeping); Playwright smoke unchanged (4 tests, `?lowq`); manual per-chapter checklist updated in quickstart.md

**Target Platform**: Desktop evergreen browsers, WebGL2 with static fallback; GitHub Pages

**Project Type**: Single static web app (no backend)

**Performance Goals**: 30+ fps on integrated graphics with environment active; bundle stays < 2 MB gzipped; environment adds ≤ ~60 draw calls (merged/instanced where trivial)

**Constraints**: Procedural geometry only (no models/textures); no UI framework; no network calls post-load; scene–story boundary (constitution II)

**Scale/Scope**: ~5 files reworked in `src/scene/` (Building, World, Lift, index, effects/Neon), 1 new scene module (Environment), 1 new verb, 8 chapter files retuned (cues only), 0 narration changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Learner-First Clarity | ✅ | Every change serves visibility: cutaway kills occlusion, palette encodes floor function, follow keeps the data's journey on screen. Environment is bounded set dressing; if it ever distracts, it simplifies (spec FR-013, SC-005). Narration untouched. |
| II | Scene–Story Separation | ✅ | One new verb `follow` added to `SceneVerbs` + contract doc + `CONTRACT_VERBS`; chapters only re-sequence verbs. Environment lives entirely in `src/scene/`, invisible to story. |
| III | Static Simplicity | ✅ | Zero new dependencies; all environment geometry procedural; single bundle unchanged. |
| IV | Test What Isn't Pixels | ✅ | Cue-integrity test extended; new unit tests for follow lifecycle (stubbed GSAP) and vantage-arc bounds; quickstart checklist rewritten per chapter; smoke suite still gates deploy. |
| V | Performance on Modest Hardware | ✅ | Draw-call budget for environment; clouds animate via one per-frame group update; `?lowq` and fps watchdog unchanged; daylight look actually reduces reliance on bloom. |
| VI | Ship Each Milestone | ✅ | Four user stories are four shippable increments (P1 cutaway alone is deployable). |

**Post-Phase-1 re-check**: PASS — design artifacts add one verb to the existing contract and no new dependencies or boundary crossings.

## Project Structure

### Documentation (this feature)

```text
specs/002-cutaway-visual-upgrade/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output (validation + updated manual chapter checklist)
├── contracts/
│   └── scene-verbs-v2.md # Phase 1 output (delta to 001 contract: follow verb, arc guarantee)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── scene/
│   ├── World.ts            # MODIFY: daylight sky/fog/lights, orbit azimuth+polar clamps
│   ├── Building.ts         # MODIFY: remove dark fillers, dress floors as open rooms,
│   │                       #         pastel FLOOR_PALETTE, side-wall inset, keep all
│   │                       #         clickable ids and anchors stable
│   ├── Lift.ts             # MODIFY: glass tube shaft on the open (+z) face edge,
│   │                       #         car restyle; carry API unchanged
│   ├── Courier.ts          # MODIFY: color retune only (actor saturation)
│   ├── Worker.ts           # MODIFY: color retune only
│   ├── Environment.ts      # NEW: neighbor buildings, trees, streetlights, cloud drift
│   ├── index.ts            # MODIFY: follow verb, retuned VANTAGES, daylight MOODS
│   ├── locations.ts        # unchanged (ids, latency numbers)
│   ├── timing.ts           # MODIFY: add follow-related pacing constants only
│   └── effects/
│       ├── Neon.ts         # MODIFY: bloom retuned subtle for daylight; toggle logic unchanged
│       └── Pulse.ts        # MODIFY: tint retune only
├── story/
│   ├── script.ts           # UNCHANGED (byte-identical narration)
│   └── chapters/ch1…ch8    # MODIFY: cue functions only — add follow calls, same cue counts
├── sync/Highlighter.ts     # unchanged
└── fallback/static-page.ts # unchanged
tests/
├── unit/cue-integrity.test.ts   # MODIFY: CONTRACT_VERBS += 'follow'
├── unit/camera-arc.test.ts      # NEW: vantages within allowed arc; follow lifecycle
└── smoke/                       # unchanged
specs/001-cpu-building-story/contracts/scene-verbs.md  # MODIFY: add follow (kept as living contract)
```

**Structure Decision**: Same single-app layout as 001. The only structural addition is `src/scene/Environment.ts`, a leaf module owned by `Scene` with no story or sync coupling. The 001 scene-verbs contract remains the living document; this feature's `contracts/scene-verbs-v2.md` records the delta and the 001 file is updated in place (constitution: keep interface, doc, and CONTRACT_VERBS in sync).

## Complexity Tracking

No constitution violations; table not needed.
