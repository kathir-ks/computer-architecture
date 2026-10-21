# Contract delta: SceneVerbs v2 (story-facing)

Extends [v1 contract](../../001-cpu-building-story/contracts/scene-verbs.md). The v1 verbs and guarantees are unchanged. Keep **three** places in sync when editing: `SceneVerbs` in `src/scene/index.ts`, this document, and `CONTRACT_VERBS` in `tests/unit/cue-integrity.test.ts`.

## New verbs (M3)

```ts
import type { PipelineSchedule } from './pipelineSchedule';

export interface SceneVerbs {
  // ...v1 verbs unchanged...

  /** Reveal the assembly line on floor 10: belt, three stations, two clerks.
   *  Idempotent — safe to call when already set up (deep links to chapter 9). */
  pipelineSetup(): Timeline;

  /** Animate a schedule through the line. Cards advance station to station per tick,
   *  bubbles appear where the schedule has them, and the board shows
   *  one-at-a-time vs pipelined tick totals. Implies pipelineSetup(). */
  pipelineRun(schedule: PipelineSchedule, opts?: { fastForward?: boolean }): Timeline;

  /** Fold the line away (clerks leave, belt hides). Idempotent. */
  pipelineTeardown(): Timeline;
}

export type VantageId =
  | /* v1 ids */ 'street' | 'building-front' | 'floor10-desk' | 'floor9-shelves'
  | 'floor8-storeroom' | 'floor4-archive' | 'warehouse' | 'lift-shaft' | 'recap-wide'
  | 'pipeline-line'; // new: floor 10, framing the three stations
```

## Changed semantics (non-breaking)

| Verb | v1 | v2 |
|------|----|----|
| `flyTo(vantage, opts?)` | Always tweens camera + target | A **shot request**: the camera rig honours it per the learner's camera mode (Free = v1 tween; Cinematic = wall-safe arc + settle; Follow = ignored while data is tracked; Worker view = ignored). Still returns a Timeline of the requested duration so chapter sequencing is unchanged. |
| `flash(id, kind)` | Colour pulse | Same colour pulse **plus** shape feedback: `hit` = expanding ring + tick glyph, `miss` = brief shudder + cross glyph, `focus` unchanged. |
| `spawnPulse(at, tint)` | Sphere | `instruction` = card, `data` = block (tint kept). Returns the same `{id, tl}`. |

All other signatures are identical, so chapters 1–8 compile and play without edits.

## Highlight ids

`'pipeline'` is added to `SCENE_ELEMENT_IDS` (so narration may use `[[pipeline:the assembly line]]`). `Scene.setGlow('pipeline', on)` glows the belt and stations.

## Guarantees (additions)

1. **Verb timelines stay pause-safe**: everything the pipeline verbs animate lives in the returned timelines.
2. **Schedule is data**: `PipelineSchedule` is a plain object from the pure `buildSchedule()`; the scene never infers hazards, and the story never touches meshes.
3. **No story knowledge**: pipeline verbs take a schedule, never a chapter number.
4. **Cue integrity**: `ch9` cues may only call contract verbs; `CONTRACT_VERBS` gains `pipelineSetup`, `pipelineRun`, `pipelineTeardown`.

## Test updates implied (expected, not regressions)

- `cue-integrity.test.ts`: "exactly 8 chapters" → 9 (ids 1..9); `CONTRACT_VERBS` extended; stub returns inert timelines for the new verbs.
- All other existing tests unchanged and must keep passing.
