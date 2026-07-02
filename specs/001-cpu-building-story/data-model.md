# Phase 1 Data Model: CPU Building Story

All state is in-memory TypeScript; no persistence. Types live beside their owners (`story/types.ts`, `sync/Highlighter.ts`, `ui/FreePlayPanel.ts`).

## Location

Represents a memory level in the world. The single source of truth for the latency numbers shown anywhere.

| Field | Type | Notes |
|---|---|---|
| id | `LocationId = 'registers' \| 'l1i' \| 'l1d' \| 'l2' \| 'ram' \| 'disk'` | Also the highlight-registry key |
| label | string | Display name ("L1 data cache") |
| floor | number \| 'outside' | 10, 9, 8, 4, or 'outside' |
| latencyCycles | number | 0, 4, 4, 12, 200, 4_000_000 |

Validation: ids unique; every `LocationId` present exactly once (unit-tested constant table).

## Step & Chapter

| Field | Type | Notes |
|---|---|---|
| Chapter.id | number (1–8) | Order fixed by array position |
| Chapter.title | string | Shown in progress UI |
| Chapter.steps | Step[] | ≥ 1 |
| Step.narration | string | Raw text with `[[id:term]]` markers |
| Step.cue | `(verbs: SceneVerbs) => gsap.core.Timeline` | Pure builder; MUST only call contract verbs |

Validation (cue-integrity test): every marker id in every `narration` resolves in the registry; every chapter has ≥ 1 step; cue functions build without throwing against a stub `SceneVerbs`.

## StoryState (StoryEngine)

| Field | Type | Notes |
|---|---|---|
| chapterIndex | number | 0-based internally, 1-based in hash |
| stepIndex | number | Within chapter |
| status | `'playing' \| 'paused' \| 'waiting'` | `waiting` = timeline finished, Next enabled |
| mode | `'story' \| 'freeplay'` | `freeplay` unlocks at chapter 8 completion |

Transitions:

```
waiting --next()--> playing --timeline.onComplete--> waiting
playing --pause()--> paused --resume()--> playing
waiting(last step of ch8) --next()--> mode=freeplay
any --hashchange(valid N)--> chapterIndex=N-1, stepIndex=0, waiting
any --hashchange(invalid)--> chapterIndex=0
```

Invariants: `next()` is a no-op while `status === 'playing'` unless invoked as fast-forward (completes current timeline via `timeline.progress(1)` first — never overlapping timelines). Tab-hidden pauses iff `status === 'playing'`; tab-visible resumes only what tab-hidden paused.

## Marker / ParsedNarration

| Field | Type |
|---|---|
| ParsedNarration.plainText | string |
| ParsedNarration.spans | `{ start: number; end: number; id: string }[]` |

Parser is a pure function `parseMarkers(raw: string): ParsedNarration`; round-trip and malformed-marker cases unit-tested (unclosed `[[`, empty id, unknown id → parse error listing the offender).

## HighlightRegistry (sync/Highlighter)

| Field | Type | Notes |
|---|---|---|
| entries | `Map<string, { object?: Object3D; spans: HTMLElement[] }>` | Filled by scene (objects) and panel (spans) at build time |

Operations: `register3D(id, obj)`, `registerSpan(id, el)`, `glow(id, on)`, `focusText(id)`. Unknown id → dev-mode throw, prod no-op warn.

## FreePlayRequest & Scoreboard

| Field | Type | Notes |
|---|---|---|
| Request.op | `'LOAD' \| 'ADD' \| 'STORE'` | |
| Request.target | `LocationId \| 'random'` | random resolved via injected RNG (weights: l1d .5, l2 .25, ram .2, disk .05) |
| Outcome.resolved | `LocationId` | Where data was found |
| Outcome.cycles | number | = Location.latencyCycles lookup |
| Outcome.hit | boolean | resolved ∈ {l1d} for loads/adds; store policy: hit iff l1d |
| Scoreboard.hits / misses / totalCycles | number | Monotonic counters, reset button |

Validation: cycles always equals the latency table value for `resolved` (SC-006 test); scoreboard counts equal sum of outcomes.
