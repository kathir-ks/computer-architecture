import type { CameraMode, QualityTier, ViewSnapshot } from './viewState';

export type { CameraMode, QualityTier, ViewSnapshot };

/**
 * Learner controls (contracts/view-controls.md). Deliberately NOT part of SceneVerbs:
 * only main.ts and src/ui/* receive this, so chapters cannot flip the learner's view.
 * The telemetry half (onLedger / resetTelemetry) is added with the ledger in Phase 7.
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
}
