# Phase 0 Research: CPU Building Story

All major unknowns were resolved interactively during the brainstorming phase (recorded in the founding design doc). This file consolidates each decision with rationale and alternatives, plus research on the few remaining implementation-level choices.

## D1. Rendering stack

- **Decision**: Vanilla Three.js + TypeScript + Vite, no UI framework.
- **Rationale**: The project's difficulty is animation choreography, not state management; vanilla keeps Three.js APIs directly at hand, minimizes bundle, and matches the maintainer's non-React background. Vite gives instant dev server + one-command static build for Pages.
- **Alternatives considered**: React Three Fiber + drei + zustand (better declarative UI↔3D sync, rejected for React dependency and abstraction over animation debugging); Babylon.js (batteries included, rejected — smaller ecosystem, no unique need).

## D2. Animation sequencing

- **Decision**: GSAP 3 timelines as the only choreography mechanism outside the scene layer.
- **Rationale**: Story steps are pausable, resumable, seekable sequences — GSAP's native model. `timeline.pause()/resume()` directly satisfies FR-005/FR-015. Free `gsap` core covers all needs (no paid plugins: no MorphSVG etc. required).
- **Alternatives considered**: Three.js AnimationMixer (keyframe clips, awkward for dynamic programmatic sequences); hand-rolled rAF tweening (reinvents pause/seek/easing poorly).

## D3. Neon glow / highlight rendering

- **Decision**: Selective emissive materials + `UnrealBloomPass` from three/examples for the neon look; hover/click highlight via an additive `OutlinePass`-style emissive boost on registered objects (not full OutlinePass, which is heavy).
- **Rationale**: Bloom is the single post-processing cost, and it is toggleable per constitution V. Emissive-boost highlighting is one material tweak, works with bloom off, costs nothing extra.
- **Alternatives considered**: OutlinePass per highlight (expensive, doubles scene render); CSS-blended sprite glows (don't sit correctly in 3D depth).

## D4. FPS watchdog & quality step-down

- **Decision**: Rolling 60-frame average in the render loop; if < 30 fps sustained for 3 s during the first 15 s (or any later 10 s window), disable bloom and antialias down; expose manual toggle in a corner settings chip.
- **Rationale**: Simple, no dependency, satisfies FR-013 verifiably in unit-testable logic (the decision function is pure; the render loop just feeds it).
- **Alternatives considered**: `three-perf`/stats.js integration (dev-only tooling, not a runtime policy); WebGL renderer capability sniffing (unreliable proxy for actual fps).

## D5. Floor labels & in-world text

- **Decision**: CSS2DRenderer (three/examples) for floor labels and callouts — DOM elements tracked to 3D positions.
- **Rationale**: Crisp text at any zoom, free hover/click events (feeds `Highlighter` without raycasting for labels), zero font-atlas work. Raycasting still used for clicking the meshes themselves.
- **Alternatives considered**: SDF text via troika-three-text (extra dependency, texture cost); texture-baked labels (blurry, no events).

## D6. Camera control arbitration (story vs user)

- **Decision**: OrbitControls always enabled; scripted moves tween the camera + controls.target via GSAP; any `pointerdown` on the canvas kills the active camera tween (`tween.kill()`) while the rest of the step timeline continues.
- **Rationale**: Directly implements FR-006 ("yield instantly"); killing only the camera tween keeps data-pulse choreography intact.
- **Alternatives considered**: Camera lock during story (violates spec); dual-camera crossfade (complexity without learner value).

## D7. Narration marker format

- **Decision**: `[[id:display text]]` inline markers in `script.ts` strings, parsed by a tiny pure function into `{text, spans[]}`; ids must exist in the highlight registry (enforced by unit test).
- **Rationale**: Human-editable teaching text in one file (constitution I), trivially parseable, testable.
- **Alternatives considered**: Markdown + custom renderer (heavier parse, no benefit); JSX/HTML in script (couples text to DOM).

## D8. URL chapter state

- **Decision**: `location.hash = "#chapter-N"` on chapter entry; on load, parse hash, clamp invalid values to chapter 1 (FR-010, edge case). Steps within a chapter are not addressable.
- **Rationale**: Chapter granularity matches the sharing use case ("watch the miss cascade"); hash avoids Pages routing config entirely.
- **Alternatives considered**: History API paths (needs 404 redirect hack on Pages); query params (uglier, same power).

## D9. Free-play randomness

- **Decision**: "Random" location draws from a weighted distribution favoring hits (L1 50%, L2 25%, RAM 20%, disk 5%) via injectable RNG (seedable for tests).
- **Rationale**: Mirrors real locality so the scoreboard teaches the right lesson; injectable RNG keeps SC-006 deterministic in tests.
- **Alternatives considered**: Uniform random (misteaches — disk trips every 4th click); scripted sequence (not play).

## D10. Deployment pipeline

- **Decision**: GitHub Actions workflow: `vitest run` → `playwright test` (chromium, built preview) → `vite build` → deploy to Pages via `actions/deploy-pages`. Repo setting: Pages from Actions.
- **Rationale**: Constitution IV/VI — tests gate deploy; every merge to main ships.
- **Alternatives considered**: Pages from `gh-pages` branch (extra branch juggling); Netlify/Vercel (unneeded accounts for a static bundle).

## D11. WebGL fallback detection

- **Decision**: Try `canvas.getContext('webgl2') ?? getContext('webgl')` at bootstrap before constructing the renderer; on failure, `fallback/static-page.ts` replaces the layout with an inline-SVG labeled building illustration + full story text (rendered from the same `script.ts`, markers stripped to plain emphasis).
- **Rationale**: FR-012/SC-005; reusing `script.ts` means the fallback can never drift from the real narration.
- **Alternatives considered**: WEBGL.isWebGLAvailable() helper from examples (same check, fine to use); separate hand-written fallback HTML (drifts from script).

All NEEDS CLARIFICATION: none remained after brainstorming. ✅
