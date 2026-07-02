<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Modified principles: n/a (initial ratification)
- Added sections: Core Principles (I–VI), Technology Constraints, Development Workflow, Governance
- Removed sections: none
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ aligned (stock Constitution Check section works against these principles)
  - .specify/templates/spec-template.md ✅ aligned (no mandatory-section changes introduced)
  - .specify/templates/tasks-template.md ✅ aligned (testing discipline maps to existing task categories)
- Follow-up TODOs: none
-->

# CPU Building 3D Constitution

## Core Principles

### I. Learner-First Clarity
Every feature, animation, and visual effect MUST be judged by one question: does it make
the concept more intuitive for a student seeing it for the first time? Choreography
clarity beats visual spectacle. If an effect looks impressive but muddies what the data
is doing, it goes. Narration text MUST be editable in one place (`src/story/script.ts`)
so the teaching content can be improved without touching engine code.

### II. Scene–Story Separation (NON-NEGOTIABLE)
The 3D scene layer (`src/scene/`) exposes named verbs (e.g. `lift.carry`,
`building.highlight`) and MUST NOT know what chapter is playing. The story layer
(`src/story/`) sequences those verbs inside GSAP timelines and MUST NOT touch meshes,
materials, or the renderer directly. This boundary is what makes future chapters
(pipelining, L3, branch prediction) purely additive: new verbs + new chapter files,
never rework.

### III. Static Simplicity
The product is a static site: no backend, no network calls after page load, no
downloaded 3D models or textures — all geometry is procedural. It MUST build to a
single Vite bundle deployable to GitHub Pages. New runtime dependencies require
justification against this principle.

### IV. Test What Isn't Pixels
All non-visual logic MUST have automated tests (Vitest): story-engine state
transitions, narration marker parsing, free-play bookkeeping, and the cue-integrity
dry-run that asserts every chapter references only real scene verbs and registered
element IDs. Choreography is verified by a written per-chapter manual checklist before
each deploy. A Playwright smoke test (page loads, canvas renders, Next advances
narration) MUST pass before any deploy — a broken build must not reach the learner
silently.

### V. Performance on Modest Hardware
Target: smooth (~30+ fps) on an average college laptop with integrated graphics.
Post-processing (bloom) MUST be toggleable and auto-disable when the frame rate
falls below ~30 fps. The app MUST degrade gracefully: a static illustrated fallback
when WebGL is unavailable, and a usable bottom-drawer layout below ~900px width.

### VI. Ship Each Milestone
Work proceeds in milestones that each end deployed to GitHub Pages and viewable.
No long-lived undeployable branches: the learner-visible site is the integration test.

## Technology Constraints

- Stack: Three.js + TypeScript + Vite + GSAP. No UI framework (no React/Vue); the
  narration panel is plain HTML/CSS/TS.
- Animation sequencing uses GSAP timelines; ad-hoc requestAnimationFrame choreography
  outside the scene layer is not allowed.
- Hosting: GitHub Pages via CI on the default branch.

## Development Workflow

- Spec-driven: features flow through Spec Kit (`specify → clarify → plan → tasks →
  implement`); specs and plans live in the repo and are committed before implementation.
- The design spec at `docs/superpowers/specs/2026-07-03-cpu-building-3d-design.md` is
  the founding product document; feature specs refine it, and conflicts are resolved in
  favor of the newer approved spec.
- Every milestone ends with: tests green, smoke test green, manual chapter checklist
  run, deploy verified.

## Governance

This constitution supersedes ad-hoc practice. Amendments are made by editing this file
with a semantic version bump (MAJOR: principle removed/redefined; MINOR: principle or
section added or materially expanded; PATCH: clarification) and a dated entry in the
Sync Impact Report. Reviews and merges MUST verify compliance, especially the
Scene–Story boundary (II) and the test gates (IV). Complexity beyond what a chapter's
teaching goal requires MUST be justified in the plan or removed.

**Version**: 1.0.0 | **Ratified**: 2026-07-03 | **Last Amended**: 2026-07-03
