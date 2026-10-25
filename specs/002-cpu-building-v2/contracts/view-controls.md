# Contract: ViewControls (UI-facing scene interface)

Learner controls are **not** story beats. They live on a second interface that only `main.ts` and `src/ui/*` receive; the story layer is typed against `SceneVerbs` alone, so it cannot flip the learner's camera, X-ray or quality.

```ts
export type CameraMode = 'free' | 'follow' | 'cinematic';
export type QualityTier = 'high' | 'medium' | 'low';

export interface ViewSnapshot {
  cameraMode: CameraMode;
  workerView: boolean;
  handedBack: boolean;   // learner took control; show "Resume camera"
  xray: boolean;
  quality: QualityTier;
}

export interface ViewControls {
  // ---- state ----
  getView(): ViewSnapshot;
  onView(cb: (v: ViewSnapshot) => void): () => void;   // returns unsubscribe

  // ---- camera ----
  setCameraMode(mode: CameraMode): void;
  enterWorkerView(): void;
  exitWorkerView(): void;
  /** Learner pressed "Resume camera": rig re-issues the last shot request in the current mode. */
  resumeCamera(): void;

  // ---- look ----
  setXray(on: boolean): void;
  setQuality(tier: QualityTier): void;   // manual; auto step-down uses the same path

  // ---- telemetry (read-only for UI) ----
  onLedger(cb: (s: LedgerSnapshot) => void): () => void;
  /** Called by main.ts on chapter jump / free-play reset; timelines were killed, so partial journeys are dropped. */
  resetTelemetry(): void;
}

export interface LedgerSnapshot {
  current: AccessJourney | null;   // see data-model.md
  idleCycles: number;
  workingCycles: number;
  elapsedCycles: number;
}
```

## As built

- `Scene` `implements SceneVerbs, ViewControls`; `src/scene/view/controls.ts` holds the interface and re-exports `LedgerSnapshot` / `AccessJourney`, which are defined next to the pure ledger in `src/scene/telemetry/ledger.ts`. State lives in the pure `ViewState`.
- X-ray follows the view store: `Scene` subscribes to `ViewState` and drives `Xray.set()`, so the dock, `?xray` and tests all fade the same way. Asking for the state it is already heading to never restarts a fade.
- `onLedger` returns an unsubscribe function but does **not** fire immediately; read `getLedger()` (also exposed as `window.__cpu.ledger()` under `?debug`) for the current book.
- `resetTelemetry()` is called by `main.ts` on a chapter jump, on a free-play reset and when free play unlocks (so the aids count from zero in step with the scoreboard). The free-play "Reset scoreboard" button is disabled while data is in transit.
- Entering Worker view stores the previous mode **and** the previous hand-back; exit restores both. Picking a camera mode while seated clears the hand-back (re-engages the automation).
- The latency scale and the live aids exist only when 3D booted (`main.ts` mounts them after `Scene`); the no-WebGL fallback never creates them.

## Behaviour rules

1. **Input wins**: any pointer, wheel, touch or key input on the canvas cancels scripted camera motion and sets `handedBack`. Cancel is synchronous (within the event handler).
2. **Pause-coupled**: scripted camera moves are part of step timelines or driven by the frame loop reading paused state, so pausing the story pauses camera automation; the learner's own camera input is never paused.
3. **Worker view**: entering stores the previous mode; shot requests are ignored; exit restores the previous mode (and re-issues the last shot request if not handed back).
4. **X-ray**: independent of camera mode; toggling mid-animation never restarts any timeline.
5. **Quality**: auto step-down (watchdog) and manual changes both go through `setQuality`; the app must work correctly at every tier, including X-ray and Worker view at `low`.
6. **Telemetry**: `LedgerSnapshot` values obey the invariants in [data-model.md](../data-model.md); UI components never compute cycle costs themselves.
7. **Fallback**: in the no-WebGL path none of this exists; no code in `ui/` may assume a `ViewControls` instance exists unless 3D booted.

## URL parameters (entry points; read once at boot)

| Param | Effect |
|-------|--------|
| `?cam=free\|follow\|cinematic` | Initial camera mode |
| `?xray` | Start with X-ray on |
| `?view=worker` | Start in Worker view |
| `?lowq` | Start at `low` tier (existing) |
| `?debug` | Expose `window.__cpu = { view(), ledger(), scene }` for smoke tests and manual inspection only |
| `?dev`, `?nowebgl` | Existing behaviour |
| `#chapter-N` | Existing deep link; now 1–9 |
