# Quickstart & Validation: CPU Building Story

## Prerequisites

- Node 20+ and npm
- A WebGL2-capable browser (Chrome/Edge/Firefox)

## Setup & run

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

## Automated validation

```bash
npm run test       # Vitest: story engine, marker parsing, cue integrity, free-play logic
npm run test:smoke # Playwright: builds, serves preview, asserts load/canvas/Next
npm run build      # Production bundle → dist/ (must stay < 2 MB gzipped)
```

Expected: all suites green. CI (`.github/workflows/deploy.yml`) runs the same three commands and only deploys to GitHub Pages when they pass.

## End-to-end story validation (manual, per deploy)

Run through once per deploy — this is the constitution IV "manual chapter checklist".

| # | Chapter | Verify |
|---|---------|--------|
| 1 | Welcome | Camera rises from street; floors 4, 8, 9, 10 + warehouse light up as each is introduced; labels readable |
| 2 | Worker's job | Worker visible at desk; instruction-card stack shown down in the archive |
| 3 | Fetch | Ticket dispenser pops; instruction pulse arrives from L1i shelf to desk |
| 4 | Decode | Card visibly splits into "what to do" / "where the data is" halves |
| 5 | Execute (hit) | Pulse: desk → L1d → desk, fast; drawer opens; result stored; celebratory beat |
| 6 | Miss cascade | L1 flash-miss → L2 flash-miss → long lift ride to floor 4; Worker foot-taps; timing bar shows 4 / 12 / 200 |
| 7 | Disk trip | Courier van departs to warehouse; "…millions of cycles later" fast-forward; return + deliver |
| 8 | Recap | Latency ladder displayed; free-play controls replace Next |

Cross-cutting checks (any chapter):

- [ ] Orbit drag mid-animation: camera obeys instantly, story continues
- [ ] Pause mid-lift: everything freezes; resume continues from same spot
- [ ] Hover "L1 cache" text → floor 9 glows; click floor 4 → panel scrolls to RAM paragraph
- [ ] Reload with `#chapter-6` → opens at miss cascade; `#chapter-99` → chapter 1
- [ ] Hide tab mid-animation, return → resumed, nothing skipped
- [ ] Mash Next during a step → no overlapping animations
- [ ] Window at 800px wide → panel folds to bottom drawer, all controls reachable

## Free-play validation

1. Finish chapter 8 → launcher appears.
2. Fire LOAD × each location (L1/L2/RAM/disk): correct journey animates; cycle counter shows 4 / 12 / 200 / 4,000,000.
3. Fire ~10 "random" requests: scoreboard hit/miss tallies match what animated.

## Fallback validation

- Launch Chrome with `--disable-webgl --disable-webgl2` (or use a browser profile with hardware acceleration off): page shows the static labeled building illustration and the full story text (SC-005).
- Settings chip: toggling quality off removes bloom; fps overlay (dev mode `?fps`) confirms 30+ on integrated graphics.

## References

- Scene API: [contracts/scene-verbs.md](contracts/scene-verbs.md)
- Entities & state machine: [data-model.md](data-model.md)
- Decisions & rationale: [research.md](research.md)
