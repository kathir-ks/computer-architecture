# Quickstart: validating CPU Building v2

Run guide, not an implementation guide. Details: [data-model.md](data-model.md), [contracts/](contracts/).

## Prerequisites

```bash
npm install          # if node_modules is missing
```

On Windows, if rollup fails with `MODULE_NOT_FOUND`, delete `node_modules` and reinstall (do **not** add the rollup native package to `package.json`; see CLAUDE.md).

## Automated gates (every milestone)

```bash
npm run test         # Vitest — all unit tests incl. new pure modules
npm run build        # tsc --noEmit + vite build
npm run test:smoke   # Playwright; run build first (serves dist/)
```

**Bundle budget (SC-009)**: after `npm run build`, gzip JS must be **≤ 215 kB** (baseline 172.0 kB at v1). Record the figure in the milestone's PR/commit message.

Expected existing-test edits (not regressions): `cue-integrity.test.ts` moves from 8 → 9 chapters and gains the three pipeline verbs (M3).

## Useful URLs

| URL | Shows |
|-----|-------|
| `/?dev` | Dev harness with a button per verb (extended with pipeline verbs in M3) |
| `/?lowq` | Lowest tier — verify everything still works |
| `/?cam=follow#chapter-6` | Follow mode on the miss cascade |
| `/?xray#chapter-5` | X-ray on during the happy path |
| `/?view=worker#chapter-6` | Worker first-person during the long wait |
| `/#chapter-9` | Pipelining chapter deep link (M3) |
| `/?nowebgl` | Static fallback (must include chapter 9 after M3) |
| `/?debug` | `window.__cpu` for smoke tests |

## M1 validation — Visuals + Cameras

Automated: `view-state`, `camera-follow`, `camera-safe-path`, `worker-look`, `motion`, `quality-tiers` tests green; smoke switch-sequence green.

Manual (each at default quality, then again with `?lowq`):

1. **US1 legibility** — Load `/`. With labels hidden (browser devtools: hide `.floor-label`), identify desk, L1 shelves, L2 storeroom, RAM archive, warehouse. Windows lit, props visible, no pure-black regions.
2. **Trails & shapes** — Chapter 3 and 5: instruction travels as a *card*, data as a *block*; both leave a fading trail.
3. **Worker states** — `/?dev`: `work compute`, `work read-card`, `work foot-tap`, idle all look different.
4. **Hit vs miss** — Chapter 5 vs 6: hit shows ring burst; miss shudders with a cross; distinguishable in greyscale.
5. **Quality** — Throttle CPU 6× in devtools → within ~10 s the tier steps down and the story continues; chip lets you step back up.
6. **Cameras** — Chapters 5–7 in each mode:
   - Follow: the pulse never leaves the frame, including the van trip.
   - Cinematic: each beat has a smooth arc/settle, no wall clipping.
   - Free: identical to v1.
7. **Input wins** — Mid-flight drag, wheel, touch-drag and arrow-key each stop scripted motion instantly; **Resume camera** appears; pressing it resumes at the current beat.
8. **Pause** — Pause mid-move: camera and scene freeze together.
9. **Worker view** — Enter, look around (clamped), fire free-play LOAD from L1 then RAM; compare door-empty time; exit restores previous mode.
10. **Reduced motion** — OS setting on: camera cuts/short; no strobing; teaching animations still play.
11. **Chapters 1–8** — Run the v1 manual checklist in `specs/001-cpu-building-story/quickstart.md`; content and sequence unchanged.

## M2 validation — X-ray + Live aids

Automated: `ledger`, `cache-line` tests; tracker replay test of chapters 5–7 verb sequences; smoke still green.

Manual:

1. **X-ray** — Toggle in every chapter: walls fade, ten floor labels appear, side scale shows exactly 0 / 4 / 12 / 200 / 4,000,000; marker follows the level being served; toggle off restores smoothly.
2. **Cycle meter** — Chapter 5 (L1 hit) ends at 4; chapter 6 (RAM) ends at 200; chapter 7 (disk) ends at 4,000,000; free-play L2 ends at 12.
3. **Ladder** — Chapter 6: L1 then L2 marked as misses in order, RAM served.
4. **Idle counter** — Rises only while the Worker waits; stops on delivery; `idle + working = elapsed` shown consistently.
5. **Locality strip** — Click a cold cell: miss, its 4-cell line fills; click a neighbour: hit.
6. **Free-play consistency** — Scoreboard totals equal the meter totals after a mixed run.
7. **Narrow screen (<900 px)** — Aids collapse to compact form; 3D focus area not covered.
8. **Tab hidden mid-journey** — Return: counters resume without jumping or double counting.
9. **Chapter jump mid-journey** — `#chapter-N` change: aids reset cleanly.

## M3 validation — Pipelining

Automated: `pipeline-schedule` tests (fill = `n+2` ticks, bubble on dependency, memory stall extends Execute and holds F/D, program order preserved); cue-integrity (9 chapters, new verbs); smoke: `#chapter-9` loads, 9 progress dots.

Manual:

1. Chapter 9 from chapter 8 and via deep link: line appears (deep link must not require earlier steps).
2. Steady state shows three cards in three stages simultaneously; board shows pipelined ticks < one-at-a-time ticks.
3. Hazard: a bubble forms, later cards wait, flow resumes.
4. Memory-miss stall: long Execute holds the whole line; the real figure (200) is annotated; narration links to the cache chapters.
5. Free play unlocks after chapter 9; works as before.
6. `/?nowebgl`: chapter 9 narration present.
7. `git diff 130a23f -- src/story/chapters/ch[1-8]*.ts` is empty (FR-031). `130a23f` is the last v1 commit; there is no `v1.0.0` git tag in this repo.

## Performance check

Open devtools Performance on `/` at each tier; target ≥ 30 fps after any automatic step-down on integrated graphics; record the tier reached. Run `npm run build` and compare gzip size to the 215 kB budget.

### Recorded numbers (T093) — 2026-10-25, production build `npm run build` + `npm run preview`

| Measure | Result | Target |
|---------|--------|--------|
| JS bundle (gzip) | 200.0 kB (`npm run size`) | ≤ 215 kB (v1 172.0 kB + 25%, SC-009) |
| Everything `dist/` serves (gzip) | 199.5 kB (715.9 kB raw) | no more than +25% on v1 (SC-009) |
| Page `load` event, localhost | 416–1258 ms | — |
| Scene ready (`#loading` hidden), headless Chromium on a **software rasteriser** | 4.7 s default, 6.5 s `?lowq`, 5.2 s `#chapter-9` | < 5 s on broadband (SC-009) |
| Frame rate, same software rasteriser | 0.3 fps default (bloom), 5 fps `?lowq` | ≥ 30 fps on integrated graphics after step-down |

**Not measured here:** the ≥ 30 fps target and a true time-to-interactive. Both Chromium builds available in this environment render WebGL in software, so scene-ready is dominated by shader compilation on the CPU and fps is meaningless as a GPU figure (the default tier crawls there by design — that is what `?lowq` and the automatic step-down are for). **Still to do by hand on real hardware:** open devtools Performance on `/` on an integrated-graphics laptop, play chapters 1–9 and free play, and record the tier the watchdog settles on. The size and structure of the bundle are verified; the frame rate is not.
