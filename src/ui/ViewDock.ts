import type { CameraMode, QualityTier, ViewSnapshot } from '../scene/view/viewState';

/** The slice of ViewControls the dock needs (Worker view and X-ray join it in later phases). */
export interface DockControls {
  getView(): ViewSnapshot;
  onView(cb: (v: ViewSnapshot) => void): () => void;
  setCameraMode(mode: CameraMode): void;
  resumeCamera(): void;
  enterWorkerView(): void;
  exitWorkerView(): void;
  setQuality(tier: QualityTier): void;
}

const MODES: Array<{ mode: CameraMode; label: string; hint: string }> = [
  { mode: 'free', label: 'Free', hint: 'Story shots fly the camera like the original; you steer any time' },
  { mode: 'follow', label: 'Follow', hint: 'The camera tracks the data as it travels' },
  { mode: 'cinematic', label: 'Cinematic', hint: 'A directed camera glides between story beats' },
];

const TIERS: QualityTier[] = ['high', 'medium', 'low'];
export function nextTier(t: QualityTier): QualityTier {
  return TIERS[(TIERS.indexOf(t) + 1) % TIERS.length];
}

/**
 * Plain-DOM control dock over the 3D view: camera mode, "Resume camera" (only when the learner has
 * taken the camera in a directed mode) and the graphics-quality chip. Reads and writes only through
 * the controls interface; never touches the scene.
 */
export class ViewDock {
  private modeButtons = new Map<CameraMode, HTMLButtonElement>();
  private resumeBtn: HTMLButtonElement;
  private workerBtn: HTMLButtonElement;
  private hint: HTMLSpanElement;
  private qualityBtn: HTMLButtonElement;

  constructor(root: HTMLElement, controls: DockControls) {
    root.hidden = false;
    const dock = document.createElement('div');
    dock.className = 'view-dock';
    dock.setAttribute('role', 'toolbar');
    dock.setAttribute('aria-label', 'View controls');

    const seg = document.createElement('div');
    seg.className = 'dock-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Camera mode');
    for (const m of MODES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.label;
      b.title = m.hint;
      b.addEventListener('click', () => controls.setCameraMode(m.mode));
      this.modeButtons.set(m.mode, b);
      seg.appendChild(b);
    }

    this.resumeBtn = document.createElement('button');
    this.resumeBtn.type = 'button';
    this.resumeBtn.className = 'dock-resume';
    this.resumeBtn.textContent = '↺ Resume camera';
    this.resumeBtn.title = 'Hand the camera back to the story';
    this.resumeBtn.hidden = true;
    this.resumeBtn.addEventListener('click', () => controls.resumeCamera());

    this.workerBtn = document.createElement('button');
    this.workerBtn.type = 'button';
    this.workerBtn.className = 'dock-worker';
    this.workerBtn.addEventListener('click', () => {
      if (controls.getView().workerView) controls.exitWorkerView();
      else controls.enterWorkerView();
    });

    this.hint = document.createElement('span');
    this.hint.className = 'dock-hint';
    this.hint.textContent = 'Drag or use the arrow keys to look around · Esc to leave';
    this.hint.hidden = true;

    this.qualityBtn = document.createElement('button');
    this.qualityBtn.type = 'button';
    this.qualityBtn.className = 'dock-quality';
    this.qualityBtn.addEventListener('click', () => controls.setQuality(nextTier(controls.getView().quality)));

    dock.append(seg, this.workerBtn, this.resumeBtn, this.qualityBtn, this.hint);

    // Esc leaves the Worker's seat from anywhere on the page.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && controls.getView().workerView) controls.exitWorkerView();
    });
    root.appendChild(dock);

    controls.onView((v) => this.render(v));
    this.render(controls.getView());
  }

  private render(v: ViewSnapshot): void {
    for (const [mode, btn] of this.modeButtons) {
      const on = v.cameraMode === mode;
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('on', on);
    }
    this.workerBtn.textContent = v.workerView ? '✕ Exit Worker view' : '👁 Worker view';
    this.workerBtn.setAttribute('aria-pressed', String(v.workerView));
    this.workerBtn.classList.toggle('on', v.workerView);
    this.hint.hidden = !v.workerView;
    // From the Worker's seat the room labels would just float across the desk.
    document.body.classList.toggle('worker-view', v.workerView);
    // Free mode re-flies on every beat (v1 behaviour), so there is nothing to resume there.
    this.resumeBtn.hidden = !(v.handedBack && v.cameraMode !== 'free' && !v.workerView);
    this.qualityBtn.textContent = `${v.quality === 'high' ? '✦' : '✧'} Quality: ${v.quality}`;
    this.qualityBtn.classList.toggle('on', v.quality === 'high');
    this.qualityBtn.setAttribute('aria-label', `Graphics quality: ${v.quality}. Click to change.`);
  }
}
