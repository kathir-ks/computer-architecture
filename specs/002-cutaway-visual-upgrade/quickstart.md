# Quickstart & Validation: Cutaway Visual Upgrade (v2)

## Prerequisites

- Node 20+ and npm
- A WebGL2-capable browser (Chrome/Edge/Firefox)

## Setup & run

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

Useful URLs while validating: `?dev` (buttons for every verb, incl. the new follow), `?lowq`, `?nowebgl`, `#chapter-N`.

## Automated validation

```bash
npm run test       # Vitest — incl. new camera-arc + follow lifecycle tests, extended cue integrity
npm run build      # tsc + bundle; must stay < 2 MB gzipped
npm run test:smoke # Playwright (run after build) — unchanged 4 tests, must stay green
```

Expected: all green. The cue-integrity test now accepts `follow` and still fails on any narration/cue count drift (there must be none — narration is frozen this feature).

## Per-story-slice validation (manual)

### US1 — Cutaway & viewing arc (P1)

- [ ] All 10 floors read as open dressed rooms from the default view; no dark filler blocks anywhere
- [ ] Drag orbit fully left/right: camera eases to a stop before any angle where the back/side walls hide room interiors; the stop feels soft, no snap
- [ ] Drag fully up/down: cannot go top-down past where slabs would hide rooms; cannot go below ground
- [ ] Run a lift carry (ch6 or `?dev`): car + cargo visible for the entire ride inside the front glass tube, from far-left and far-right of the arc
- [ ] `?dev` click-through: every v1 clickable still responds — floors 4/8/9/9(l1d)/10 rooms, worker, lift car, warehouse/disk

### US2 — Pastel daylight style (P2)

- [ ] Background is light daylight, not near-black; fog matches
- [ ] Desk / shelves / storeroom / archive / empty floors / warehouse each show a distinct hue — a first-time viewer can point at "desk", "shelves", "archive" within ~10 s
- [ ] Worker, courier van, lift car and pulses are clearly more vivid than any room surface
- [ ] Trigger hit, miss, focus flashes (`?dev`): three clearly different colors against the pastel rooms
- [ ] Play ch1 → ch6 → ch8: intro (golden), tense-miss (dusky), celebration (warm) moods all read as variants of daylight — no reversion to night

### US3 — Follow camera & retuned choreography (P3)

- [ ] Ch7 courier trip: camera aim tracks the van door-to-door; van stays in the central two-thirds of frame
- [ ] Ch6 long lift ride (L2→RAM): aim follows the car for the whole ride
- [ ] Grab the canvas mid-follow: scripted tracking dies instantly, manual control is immediate, story animation continues
- [ ] Pause mid-follow: aim freezes with everything else; resume continues tracking
- [ ] Follow a pulse that gets delivered (`?dev`): camera settles at the delivery point, no console errors
- [ ] Each chapter still pairs one narration paragraph per cue (automated, but eyeball ch1 and ch8 framing for the new vantage tuning)

### US4 — Living environment (P4)

- [ ] Neighbor buildings, trees, streetlights present along the road between building and warehouse
- [ ] Watch ~30 s: clouds drift slowly and wrap; motion is continuous, no stutter
- [ ] Click every environment prop type: nothing happens, no explanation panel
- [ ] Courier trip: the van's road path is not blocked or visually crowded by props

## Cross-cutting regression (from 001, must still pass)

- [ ] Reload with `#chapter-6`: cutaway fully dressed, environment present, correct chapter framing (deep-link pre-reveal)
- [ ] `?lowq`: loads, plays, no bloom; fps overlay (`?fps`) confirms 30+ on integrated graphics **with environment active**
- [ ] `?nowebgl`: static fallback shows full story text — text byte-identical to v1
- [ ] Hover/click highlight sync (both directions) unchanged
- [ ] Window at 800px: bottom-drawer layout; active floor remains visible above the drawer
- [ ] Free-play: LOAD × each location animates correct journey; cycle counts 4 / 12 / 200 / 4,000,000 unchanged

## References

- Contract delta: [contracts/scene-verbs-v2.md](contracts/scene-verbs-v2.md) (living contract: 001's scene-verbs.md)
- Entities & invariants: [data-model.md](data-model.md)
- Decisions & rationale: [research.md](research.md)
