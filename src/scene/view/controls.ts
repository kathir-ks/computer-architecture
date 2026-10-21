import type { CameraMode, QualityTier, ViewSnapshot } from './viewState';
import type { AccessJourney, LedgerSnapshot } from '../telemetry/ledger';

export type { CameraMode, QualityTier, ViewSnapshot, AccessJourney, LedgerSnapshot };

/**
 * Learner controls (contracts/view-controls.md). Deliberately NOT part of SceneVerbs:
 * only main.ts and src/ui/* receive this, so chapters cannot flip the learner's view.
 */
export interface ViewControls {
  getView(): ViewSnapshot;
  /** Returns an unsubscribe function. */
  onView(cb: (v: ViewSnapshot) => void): () => void;

  setCameraMode(mode: CameraMode): void;
  enterWorkerView(): void;
  exitWorkerView(): void;
  /** Learner pressed "Resume camera": re-issue the last shot request in the current mode. */
  resumeCamera(): void;

  setXray(on: boolean): void;
  /** Manual change; the automatic step-down uses the same path. */
  setQuality(tier: QualityTier): void;

  // ---- telemetry (read-only for the UI; values obey the invariants in data-model.md) ----

  /** Called whenever the cycle book changes. Returns an unsubscribe function. */
  onLedger(cb: (s: LedgerSnapshot) => void): () => void;
  /** Chapter jump / free-play reset: timelines were killed, so partial journeys are dropped. */
  resetTelemetry(): void;
}
