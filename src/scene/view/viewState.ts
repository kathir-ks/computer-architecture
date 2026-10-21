export type CameraMode = 'free' | 'follow' | 'cinematic';
export type QualityTier = 'high' | 'medium' | 'low';

export interface ViewSnapshot {
  cameraMode: CameraMode;
  workerView: boolean;
  /** The learner took the camera; the UI offers "Resume camera". */
  handedBack: boolean;
  xray: boolean;
  quality: QualityTier;
}

const QUALITY_ORDER: readonly QualityTier[] = ['high', 'medium', 'low'];

/**
 * Pure store for every learner-controlled view setting (data-model.md "ViewState").
 * The camera rig, quality manager and UI read and write only this.
 */
export class ViewState {
  private snap: ViewSnapshot;
  private returnMode: CameraMode;
  private returnHandedBack = false;
  private subscribers = new Set<(v: ViewSnapshot) => void>();

  constructor(initial?: Partial<ViewSnapshot>) {
    this.snap = {
      cameraMode: 'cinematic',
      workerView: false,
      handedBack: false,
      xray: false,
      quality: 'high',
      ...initial,
    };
    this.returnMode = this.snap.cameraMode;
  }

  get(): ViewSnapshot {
    return { ...this.snap };
  }

  /** Returns an unsubscribe function. */
  subscribe(cb: (v: ViewSnapshot) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  setCameraMode(mode: CameraMode): void {
    if (this.snap.cameraMode === mode) return;
    // Picking a mode re-engages the automation. In Worker view it is remembered for exit.
    this.returnMode = mode;
    this.returnHandedBack = false;
    this.update({ cameraMode: mode, handedBack: false });
  }

  enterWorkerView(): void {
    if (this.snap.workerView) return;
    this.returnMode = this.snap.cameraMode;
    this.returnHandedBack = this.snap.handedBack;
    this.update({ workerView: true, handedBack: false });
  }

  exitWorkerView(): void {
    if (!this.snap.workerView) return;
    // Leaving the seat puts the learner back exactly where they were, including having the camera in hand.
    this.update({ workerView: false, cameraMode: this.returnMode, handedBack: this.returnHandedBack });
  }

  /** Learner input on the canvas. In Worker view their look-around is not a hand-back. */
  userGrab(): void {
    if (this.snap.workerView || this.snap.handedBack) return;
    this.update({ handedBack: true });
  }

  resume(): void {
    if (!this.snap.handedBack) return;
    this.update({ handedBack: false });
  }

  setXray(on: boolean): void {
    if (this.snap.xray === on) return;
    this.update({ xray: on });
  }

  setQuality(tier: QualityTier): void {
    if (this.snap.quality === tier) return;
    this.update({ quality: tier });
  }

  /** Automatic step-down used by the fps watchdog. Returns false when already at the lowest tier. */
  stepDownQuality(): boolean {
    const i = QUALITY_ORDER.indexOf(this.snap.quality);
    if (i >= QUALITY_ORDER.length - 1) return false;
    this.setQuality(QUALITY_ORDER[i + 1]);
    return true;
  }

  private update(patch: Partial<ViewSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    const copy = this.get();
    for (const cb of this.subscribers) cb(copy);
  }
}
