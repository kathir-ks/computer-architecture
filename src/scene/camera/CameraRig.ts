import * as THREE from 'three';
import gsap from 'gsap';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BASE_FOV, SHOTS, type VantageId } from './shots';
import { makeCurve, safePath, type Rect } from './safePath';
import { followStep } from './follow';
import { applyDrag, clampLook, DEFAULT_LOOK, lookDirection, type Look } from './workerLook';
import { scaleDuration } from '../motion';
import { TIMING } from '../timing';
import type { ViewSnapshot, ViewState } from '../view/viewState';

/** Cinematic arcs keep this far outside the tower footprint. */
const SAFE_MARGIN = 2.5;
/** Longest frame step the follow steering will integrate (guards against throttled tabs). */
const MAX_DT = 0.25;
/** First-person field of view and near plane (the seat is close to the desk). */
const WORKER_FOV = 68;
const WORKER_NEAR = 0.05;
const NORMAL_NEAR = 0.1;
/** How far ahead of the eye the orbit target sits while seated. */
const LOOK_RANGE = 5;
/** Entering/leaving the seat goes through the open front, level with the eye, never through walls or floors. */
const STANDOFF = new THREE.Vector3(3, 0, 12);
/** Head-turn smoothing (1/s) and keyboard step (radians). */
const LOOK_RATE = 14;
const LOOK_KEY_STEP = 0.09;

export interface WorkerHooks {
  /** World position of the Worker's eyes. */
  eye(out: THREE.Vector3): THREE.Vector3;
  /** Hide / show the Worker's own head. */
  onFirstPerson(on: boolean): void;
}

/**
 * The single owner of the camera. Story `flyTo` calls become *shot requests*; what happens to a request
 * is decided when it starts playing, from the learner's camera mode:
 *  - free       exactly the v1 tween
 *  - cinematic  a wall-safe arc with an eased arrival
 *  - follow     ignored while a pulse is being tracked (the camera steers after it); cinematic otherwise
 *  - (Worker view) ignored entirely; the camera sits at the Worker's eyes and the learner looks around
 * Learner input cancels scripted motion synchronously (`userGrab`) until they choose Resume.
 */
export class CameraRig {
  private activeTl: gsap.core.Timeline | null = null;
  private activeGate: { skip: boolean } | null = null;
  private tracked: THREE.Object3D | null = null;
  private lastPos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private hasLast = false;
  private lastShot: { id: VantageId; duration: number } | null = null;
  private paused = false;
  private scratch = new THREE.Vector3();
  private prevMode: ViewSnapshot['cameraMode'];

  // ---- Worker view ----
  private prevWorker = false;
  private workerTl: gsap.core.Timeline | null = null;
  private workerReady = false;
  private look: Look = { ...DEFAULT_LOOK };
  private lookTarget: Look = { ...DEFAULT_LOOK };
  private savedPose: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private handedBackBefore = false;
  private savedLimits = { minDistance: 0, maxPolarAngle: 0 };
  private eyeTmp = new THREE.Vector3();
  private dirTmp = new THREE.Vector3();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private controls: OrbitControls,
    private view: ViewState,
    private tower: Rect,
    private worker: WorkerHooks,
  ) {
    this.prevMode = view.get().cameraMode;
    this.handedBackBefore = view.get().handedBack;
    view.subscribe((v) => {
      if (v.workerView !== this.prevWorker) {
        this.prevWorker = v.workerView;
        this.prevMode = v.cameraMode;
        if (v.workerView) this.enterWorker();
        else this.exitWorker();
        return;
      }
      if (!v.workerView) this.handedBackBefore = v.handedBack;
      // Choosing a different mode re-enters it from the current beat.
      if (v.cameraMode === this.prevMode) return;
      this.prevMode = v.cameraMode;
      if (v.workerView || !this.lastShot) return;
      if (v.cameraMode === 'follow' && this.tracked) return;
      this.requestShot(this.lastShot.id, this.lastShot.duration);
    });
  }

  // ---- story-facing ----

  /**
   * Returns a timeline of the requested duration so chapter sequencing never changes, even when the
   * camera is not actually moved (follow tracking, Worker view, learner in control).
   */
  requestShot(id: VantageId, duration: number): gsap.core.Timeline {
    this.lastShot = { id, duration };
    const dur = Math.max(scaleDuration(duration), 0.001);
    const shot = SHOTS[id];
    const toPos = new THREE.Vector3(...shot.pos);
    const toTarget = new THREE.Vector3(...shot.target);

    const tl = gsap.timeline();
    const gate = { skip: false };
    const proxy = { u: 0 };
    let run: ((u: number) => void) | null = null;
    let pushedFov = false;

    tl.to(proxy, {
      u: 1,
      duration: dur,
      ease: 'power2.inOut',
      onStart: () => {
        const v = this.view.get();
        if (this.shouldIgnore(v)) {
          gate.skip = true;
          return;
        }
        // A newer shot supersedes any older one still running.
        if (this.activeTl && this.activeTl !== tl && this.activeGate) this.activeGate.skip = true;
        this.activeTl = tl;
        this.activeGate = gate;

        const fromPos = this.camera.position.clone();
        const fromTarget = this.controls.target.clone();
        if (v.cameraMode === 'free') {
          run = (u) => {
            this.camera.position.lerpVectors(fromPos, toPos, u);
            this.controls.target.lerpVectors(fromTarget, toTarget, u);
          };
        } else {
          const curve = makeCurve(safePath(fromPos, toPos, this.tower, SAFE_MARGIN));
          run = (u) => {
            curve.getPointAt(u, this.camera.position);
            this.controls.target.lerpVectors(fromTarget, toTarget, u);
            // A gentle push-in through the middle of the move that is back to normal on arrival.
            const fov = BASE_FOV + TIMING.camFovPush * Math.sin(Math.PI * u);
            if (Math.abs(fov - this.camera.fov) > 1e-4) {
              this.camera.fov = fov;
              this.camera.updateProjectionMatrix();
              pushedFov = true;
            }
          };
        }
      },
      onUpdate: () => {
        if (!gate.skip && run) run(proxy.u);
      },
      onComplete: () => {
        if (pushedFov && this.camera.fov !== BASE_FOV) {
          this.camera.fov = BASE_FOV;
          this.camera.updateProjectionMatrix();
        }
        if (this.activeTl === tl) {
          this.activeTl = null;
          this.activeGate = null;
        }
      },
    });
    return tl;
  }

  /** Called by the scene when a pulse (or the van) starts a journey. */
  track(obj: THREE.Object3D): void {
    this.tracked = obj;
    this.hasLast = false;
    this.vel.set(0, 0, 0);
    const v = this.view.get();
    if (v.cameraMode === 'follow' && !v.handedBack && this.activeGate) this.activeGate.skip = true;
  }

  untrack(obj?: THREE.Object3D): void {
    if (!obj || this.tracked === obj) this.tracked = null;
  }

  // ---- learner-facing ----

  /** Learner input: scripted motion stops now, in the same event. */
  userGrab(): void {
    if (this.activeGate) this.activeGate.skip = true;
    this.activeTl?.kill();
    this.activeTl = null;
    this.activeGate = null;
    this.view.userGrab();
  }

  /** "Resume camera": re-issue the current beat's shot in the chosen mode. */
  resume(): void {
    this.view.resume();
    if (this.lastShot && !this.view.get().workerView) this.requestShot(this.lastShot.id, this.lastShot.duration);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Worker view: pointer drag (pixels). Ignored outside Worker view. */
  lookDrag(dx: number, dy: number): void {
    if (!this.view.get().workerView) return;
    this.lookTarget = applyDrag(this.lookTarget, dx, dy);
  }

  /** Worker view: arrow keys (+1 / -1 per axis). */
  lookKey(yawDir: number, pitchDir: number): void {
    if (!this.view.get().workerView) return;
    this.lookTarget = clampLook({
      yaw: this.lookTarget.yaw + yawDir * LOOK_KEY_STEP,
      pitch: this.lookTarget.pitch + pitchDir * LOOK_KEY_STEP,
    });
  }

  // ---- per frame ----

  update(rawDt: number): void {
    const v = this.view.get();
    const dt = Math.min(rawDt, MAX_DT);
    if (v.workerView) {
      // The learner's own head-turning is never paused by the story.
      if (this.workerReady && dt > 0) this.workerUpdate(dt);
      return;
    }
    if (this.paused || dt <= 0) return;

    const obj = this.tracked;
    if (!obj) return;
    if (!obj.parent) {
      this.tracked = null;
      return;
    }
    obj.getWorldPosition(this.scratch);
    if (this.hasLast) {
      const raw = this.scratch.clone().sub(this.lastPos).divideScalar(dt);
      this.vel.lerp(raw, 0.3);
    }
    this.lastPos.copy(this.scratch);
    this.hasLast = true;

    if (v.cameraMode !== 'follow' || v.handedBack) return;
    followStep({ camera: this.camera, target: this.controls.target }, this.scratch, this.vel, dt);
  }

  private shouldIgnore(v: ViewSnapshot): boolean {
    if (v.workerView) return true;
    if (v.cameraMode !== 'free' && v.handedBack) return true;
    if (v.cameraMode === 'follow' && this.tracked) return true;
    return false;
  }

  // ---- Worker view ----

  private workerUpdate(dt: number): void {
    const k = 1 - Math.exp(-LOOK_RATE * dt);
    this.look.yaw += (this.lookTarget.yaw - this.look.yaw) * k;
    this.look.pitch += (this.lookTarget.pitch - this.look.pitch) * k;
    this.worker.eye(this.eyeTmp);
    this.camera.position.copy(this.eyeTmp);
    lookDirection(this.look, this.dirTmp);
    this.controls.target.copy(this.eyeTmp).addScaledVector(this.dirTmp, LOOK_RANGE);
  }

  private stopScripted(): void {
    if (this.activeGate) this.activeGate.skip = true;
    this.activeTl?.kill();
    this.activeTl = null;
    this.activeGate = null;
    this.workerTl?.kill();
    this.workerTl = null;
  }

  /** A path that leaves/enters through the open front: `from` → stand-off (round the tower if needed) → `to`. */
  private frontPath(from: THREE.Vector3, standoff: THREE.Vector3, to: THREE.Vector3): THREE.Curve<THREE.Vector3> {
    return makeCurve([...safePath(from, standoff, this.tower, SAFE_MARGIN), to.clone()]);
  }

  private enterWorker(): void {
    this.stopScripted();
    this.workerReady = false;
    this.savedPose = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    this.savedLimits = { minDistance: this.controls.minDistance, maxPolarAngle: this.controls.maxPolarAngle };
    // OrbitControls would otherwise drag the eye around to honour its orbit limits.
    this.controls.enabled = false;
    this.controls.minDistance = 0.1;
    this.controls.maxPolarAngle = Math.PI;
    this.camera.near = WORKER_NEAR;

    this.look = { ...DEFAULT_LOOK };
    this.lookTarget = { ...DEFAULT_LOOK };
    const eye = this.worker.eye(new THREE.Vector3());
    const standoff = eye.clone().add(STANDOFF);
    const curve = this.frontPath(this.camera.position, standoff, eye);
    const endTarget = eye.clone().addScaledVector(lookDirection(DEFAULT_LOOK), LOOK_RANGE);
    const fromTarget = this.controls.target.clone();
    const fromFov = this.camera.fov;
    let hidden = false;

    const proxy = { u: 0 };
    const tl = gsap.timeline();
    tl.to(proxy, {
      u: 1,
      duration: Math.max(scaleDuration(TIMING.workerEnter), 0.001),
      ease: 'power2.inOut',
      onUpdate: () => {
        const u = proxy.u;
        curve.getPointAt(u, this.camera.position);
        this.controls.target.lerpVectors(fromTarget, endTarget, u);
        this.camera.fov = THREE.MathUtils.lerp(fromFov, WORKER_FOV, u);
        this.camera.updateProjectionMatrix();
        if (!hidden && u > 0.75) {
          hidden = true;
          this.worker.onFirstPerson(true);
        }
      },
      onComplete: () => {
        if (!hidden) this.worker.onFirstPerson(true);
        this.workerTl = null;
        this.workerReady = true;
      },
    });
    this.workerTl = tl;
  }

  private exitWorker(): void {
    this.stopScripted();
    this.workerReady = false;
    this.worker.onFirstPerson(false);

    const reissue = !!this.lastShot && !this.handedBackBefore;
    const eye = this.worker.eye(new THREE.Vector3());
    const standoff = eye.clone().add(STANDOFF);
    const fromPos = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    const fromFov = this.camera.fov;
    // Look back at the desk while backing out of the room.
    const exitTarget = new THREE.Vector3(3.2, eye.y - 1.2, 0);

    const proxy = { u: 0 };
    const tl = gsap.timeline();
    tl.to(proxy, {
      u: 1,
      duration: Math.max(scaleDuration(TIMING.workerExit) * 0.6, 0.001),
      ease: 'power2.inOut',
      onUpdate: () => {
        const u = proxy.u;
        this.camera.position.lerpVectors(fromPos, standoff, u);
        this.controls.target.lerpVectors(fromTarget, exitTarget, u);
        this.camera.fov = THREE.MathUtils.lerp(fromFov, BASE_FOV, u);
        this.camera.updateProjectionMatrix();
      },
      onComplete: () => {
        this.workerTl = null;
        this.controls.enabled = true;
        this.controls.minDistance = this.savedLimits.minDistance;
        this.controls.maxPolarAngle = this.savedLimits.maxPolarAngle;
        this.camera.near = NORMAL_NEAR;
        this.camera.fov = BASE_FOV;
        this.camera.updateProjectionMatrix();
        if (this.view.get().workerView) return; // entered again meanwhile
        if (reissue && this.lastShot) this.requestShot(this.lastShot.id, this.lastShot.duration);
        else if (this.savedPose) this.travel(this.savedPose.pos, this.savedPose.target, TIMING.workerExit * 0.4);
      },
    });
    this.workerTl = tl;
  }

  /** Arc back to a saved pose. Cancellable by learner input like any scripted move. */
  private travel(toPos: THREE.Vector3, toTarget: THREE.Vector3, duration: number): void {
    const fromPos = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    const curve = makeCurve(safePath(fromPos, toPos, this.tower, SAFE_MARGIN));
    const gate = { skip: false };
    const proxy = { u: 0 };
    const tl = gsap.timeline();
    tl.to(proxy, {
      u: 1,
      duration: Math.max(scaleDuration(duration), 0.001),
      ease: 'power2.inOut',
      onUpdate: () => {
        if (gate.skip) return;
        curve.getPointAt(proxy.u, this.camera.position);
        this.controls.target.lerpVectors(fromTarget, toTarget, proxy.u);
      },
      onComplete: () => {
        if (this.activeTl === tl) {
          this.activeTl = null;
          this.activeGate = null;
        }
      },
    });
    this.activeTl = tl;
    this.activeGate = gate;
  }
}
