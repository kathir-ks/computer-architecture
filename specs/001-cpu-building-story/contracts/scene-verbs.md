# Contract: SceneVerbs — the scene layer's public API

The only interface the story layer may use (constitution II). Implemented by `src/scene/`; consumed by `src/story/chapters/*`. The cue-integrity unit test runs every chapter against a stub implementation of this interface — any call outside this contract fails CI.

Every verb returns a `gsap.core.Timeline` (or a tween coerced into one) so cues can sequence and nest them. Verbs never mutate story state.

```ts
export interface SceneVerbs {
  // ---- camera ----
  /** Ease camera + orbit target to a named vantage. Killed instantly by user pointerdown. */
  flyTo(target: VantageId, opts?: { duration?: number }): Timeline;

  // ---- building ----
  /** Turn a floor/location's lights + label on (chapter 1 tour). */
  reveal(id: LocationId): Timeline;
  /** Emissive glow pulse on a location (also used by Highlighter, steady-state variant). */
  flash(id: LocationId, kind: 'hit' | 'miss' | 'focus'): Timeline;

  // ---- worker (floor 10) ----
  workerWork(kind: 'compute' | 'read-card' | 'idle' | 'foot-tap'): Timeline;
  /** Open/close a register drawer; optionally deposit/withdraw a pulse. */
  drawer(action: 'put' | 'take', register: 'r1' | 'r2'): Timeline;
  /** Program-counter ticket dispenser pops the next ticket. */
  dispenseTicket(): Timeline;
  /** Instruction card pops into view on the desk (fetch arrival). */
  showCard(): Timeline;
  /** Instruction card splits into opcode + operand halves (decode). */
  splitCard(): Timeline;

  // ---- data movement ----
  /** Spawn a pulse at a location; returns handle id used by carry/deliver. */
  spawnPulse(at: LocationId, tint: 'data' | 'instruction'): { id: PulseId; tl: Timeline };
  /** Lift carries a pulse between floors; duration ∝ |floor delta| (latency feel). */
  carry(pulse: PulseId, from: LocationId, to: LocationId): Timeline;
  /** Courier van round-trip to the warehouse with a pulse. */
  courierTrip(pulse: PulseId, opts?: { fastForward?: boolean }): Timeline;
  /** Pulse absorbed at destination (into drawer, shelf, or worker). */
  deliver(pulse: PulseId, to: LocationId | 'worker'): Timeline;

  // ---- ambience ----
  setMood(mood: 'intro' | 'working' | 'tense-miss' | 'celebration'): Timeline;
}

export type VantageId =
  | 'street' | 'building-front' | 'floor10-desk' | 'floor9-shelves'
  | 'floor8-storeroom' | 'floor4-archive' | 'warehouse' | 'lift-shaft' | 'recap-wide';
```

## Guarantees

1. **Idempotent-safe**: calling a verb while its previous timeline runs is legal; the scene resolves conflicts internally (e.g., lift queues trips).
2. **Pause-safe**: all motion created by verbs lives in the returned timelines — pausing the parent step timeline freezes everything.
3. **Latency mapping**: `carry` duration = `0.6s + 0.35s × floors traveled`; `courierTrip` = 12 s or 3 s fast-forwarded. These constants live in one file (`scene/timing.ts`) so pacing is tunable without touching chapters.
4. **No story knowledge**: verbs take locations/kinds, never chapter numbers.

## UI contracts (panel ↔ engine)

- `NarrationPanel.show(step: ParsedNarration, chapterMeta)` — appends paragraph, dims previous.
- `NarrationPanel.showTiming(rows: {id: LocationId; cycles: number}[])` — timing comparison bar (chapters 6/8).
- `FreePlayPanel.onFire(cb: (req: FreePlayRequest) => void)` — free-play trigger.
- `Highlighter.glow(id, on)` / `Highlighter.focusText(id)` — the only cross-layer highlight path.
