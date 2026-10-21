import * as THREE from 'three';
import gsap from 'gsap';
import { World } from './World';
import { anchorFor, Building, BLD_D, BLD_W, FLOORS, FLOOR_H } from './Building';
import { Worker, type RegisterName, type WorkKind } from './Worker';
import { Lift } from './Lift';
import { Courier } from './Courier';
import { Pulses, type PulseId, type PulseTint } from './effects/Pulse';
import { Neon } from './effects/Neon';
import { Trails } from './effects/Trails';
import { Quality } from './effects/Quality';
import { Materials } from './materials';
import { ViewState, type CameraMode, type QualityTier, type ViewSnapshot } from './view/viewState';
import { CameraRig } from './camera/CameraRig';
import type { VantageId } from './camera/shots';
import type { HighlightId, LocationId } from './locations';
import { TIMING } from './timing';
import { reducedMotion } from './motion';

export type { VantageId } from './camera/shots';

export type Mood = 'intro' | 'working' | 'tense-miss' | 'celebration';

/**
 * The ONLY interface the story layer may call (contract: scene-verbs.md).
 * The cue-integrity test runs chapters against a stub of this type.
 */
export interface SceneVerbs {
  flyTo(target: VantageId, opts?: { duration?: number }): gsap.core.Timeline;
  reveal(id: LocationId): gsap.core.Timeline;
  flash(id: LocationId, kind: 'hit' | 'miss' | 'focus'): gsap.core.Timeline;
  workerWork(kind: WorkKind): gsap.core.Timeline;
  drawer(action: 'put' | 'take', register: RegisterName): gsap.core.Timeline;
  dispenseTicket(): gsap.core.Timeline;
  showCard(): gsap.core.Timeline;
  splitCard(): gsap.core.Timeline;
  spawnPulse(at: LocationId, tint: PulseTint): { id: PulseId; tl: gsap.core.Timeline };
  carry(pulse: PulseId, from: LocationId, to: LocationId): gsap.core.Timeline;
  courierTrip(pulse: PulseId, opts?: { fastForward?: boolean }): gsap.core.Timeline;
  deliver(pulse: PulseId, to: LocationId | 'worker'): gsap.core.Timeline;
  setMood(mood: Mood): gsap.core.Timeline;
}

const MOODS: Record<Mood, { bg: number; fog: number }> = {
  intro: { bg: 0x0a0e1a, fog: 0x0a0e1a },
  working: { bg: 0x0c1222, fog: 0x0c1222 },
  'tense-miss': { bg: 0x160d18, fog: 0x160d18 },
  celebration: { bg: 0x0a1a1c, fog: 0x0a1a1c },
};

/** Concrete scene: builds the world and implements the verbs contract. */
export class Scene implements SceneVerbs {
  readonly world: World;
  readonly building: Building;
  readonly worker: Worker;
  readonly lift: Lift;
  readonly courier: Courier;
  readonly pulses: Pulses;
  readonly neon: Neon;
  readonly materials: Materials;
  readonly trails: Trails;
  readonly quality: Quality;
  readonly rig: CameraRig;
  /** Learner-controlled view settings (quality, camera mode; X-ray and Worker view arrive later). */
  readonly view: ViewState;

  constructor(
    canvasHost: HTMLElement,
    labelsHost: HTMLElement,
    opts?: { quality?: QualityTier; cameraMode?: CameraMode },
  ) {
    this.world = new World(canvasHost, labelsHost);
    this.materials = new Materials();
    this.view = new ViewState({
      quality: opts?.quality ?? 'high',
      cameraMode: opts?.cameraMode ?? 'cinematic',
    });
    this.building = new Building(this.world, this.materials);
    this.trails = new Trails(this.world.scene);
    this.pulses = new Pulses(this.world.scene, this.trails);
    this.worker = new Worker(this.world.scene, this.materials);
    this.lift = new Lift(this.world.scene, this.pulses, this.materials);
    this.courier = new Courier(this.world.scene, this.pulses, this.materials);
    this.neon = new Neon(this.world);

    // Quality tiers drive bloom, shadows, environment light, trail length and glass detail.
    this.quality = new Quality(this.view, {
      setBloom: (on) => this.neon.setQuality(on),
      setShadows: (on) => this.world.setShadowsEnabled(on),
      setEnv: (on) => this.world.setEnvEnabled(on),
      setTrailDetail: (d) => this.trails.setDetail(d),
      setMaterialTier: (t) => {
        this.materials.setTier(t);
        this.building.setQualityTier(t);
      },
    });
    this.world.onFps((fps) => this.quality.feedFps(fps));

    // The rig owns the camera; story flyTo calls are shot requests it honours per the learner's mode.
    this.rig = new CameraRig(
      this.world.camera,
      this.world.controls,
      this.view,
      {
        minX: -BLD_W / 2,
        maxX: BLD_W / 2,
        minZ: -BLD_D / 2,
        maxZ: BLD_D / 2,
        topY: FLOORS * FLOOR_H,
      },
      {
        eye: (out) => this.worker.eyePosition(out),
        onFirstPerson: (on) => this.worker.setFirstPerson(on),
      },
    );
    this.wireWorkerLook();

    // Per-frame life: scripted camera, tumbling data blocks and fading trails.
    this.world.onFrame((dt) => {
      this.rig.update(dt);
      this.pulses.update(dt);
      this.trails.update(dt, this.world.camera);
    });

    // Worker/lift/courier meshes participate in click-to-explain raycasting.
    for (const m of this.worker.clickTargets) this.building.addClickable(m, 'worker');
    for (const m of this.lift.clickTargets) this.building.addClickable(m, 'lift');
    for (const m of this.courier.clickTargets) this.building.addClickable(m, 'disk');

    // User input instantly wins over scripted camera moves (FR-016).
    this.world.onUserGrab(() => this.rig.userGrab());

    this.world.start();
  }

  /** Head-turning in Worker view: drag with pointer or touch, or use the arrow keys. */
  private wireWorkerLook(): void {
    const el = this.world.renderer.domElement;
    let dragging = false;
    el.addEventListener('pointerdown', (e) => {
      if (!this.view.get().workerView) return;
      dragging = true;
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (dragging) this.rig.lookDrag(e.movementX, e.movementY);
    });
    const stop = () => {
      dragging = false;
    };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    window.addEventListener('keydown', (e) => {
      if (!this.view.get().workerView) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const yaw = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      const pitch = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
      if (yaw || pitch) {
        e.preventDefault();
        this.rig.lookKey(yaw, pitch);
      }
    });
  }

  /** Steady hover glow, routed to whichever module owns the element. */
  setGlow(id: HighlightId, on: boolean): void {
    switch (id) {
      case 'worker':
      case 'registers':
      case 'pc':
        this.worker.setGlow(on);
        break;
      case 'lift':
        this.lift.setGlow(on);
        break;
      case 'disk':
      case 'courier':
        this.courier.setGlow(on);
        this.building.setGlow('disk', on);
        break;
      default:
        this.building.setGlow(id, on);
    }
  }

  onElementClick(cb: (id: HighlightId) => void): void {
    this.building.onElementClick(cb);
  }

  // ---- view (learner controls; Worker view and X-ray arrive in later phases) ----

  getView(): ViewSnapshot {
    return this.view.get();
  }

  onView(cb: (v: ViewSnapshot) => void): () => void {
    return this.view.subscribe(cb);
  }

  setQuality(tier: QualityTier): void {
    this.view.setQuality(tier);
  }

  setCameraMode(mode: CameraMode): void {
    this.view.setCameraMode(mode);
  }

  /** Sit at the Worker's desk and look around. */
  enterWorkerView(): void {
    this.view.enterWorkerView();
  }

  exitWorkerView(): void {
    this.view.exitWorkerView();
  }

  /** Learner pressed "Resume camera". */
  resumeCamera(): void {
    this.rig.resume();
  }

  /** Story paused/resumed: scripted camera steering pauses with it. */
  setAutomationPaused(paused: boolean): void {
    this.rig.setPaused(paused);
  }

  // ---- SceneVerbs implementation ----

  flyTo(target: VantageId, opts?: { duration?: number }): gsap.core.Timeline {
    return this.rig.requestShot(target, opts?.duration ?? TIMING.flyTo);
  }

  reveal(id: LocationId): gsap.core.Timeline {
    return this.building.reveal(id);
  }

  flash(id: LocationId, kind: 'hit' | 'miss' | 'focus'): gsap.core.Timeline {
    return this.building.flash(id, kind);
  }

  workerWork(kind: WorkKind): gsap.core.Timeline {
    return this.worker.playWork(kind);
  }

  drawer(action: 'put' | 'take', register: RegisterName): gsap.core.Timeline {
    return this.worker.drawer(action, register);
  }

  dispenseTicket(): gsap.core.Timeline {
    return this.worker.dispenseTicket();
  }

  showCard(): gsap.core.Timeline {
    return this.worker.showCard();
  }

  splitCard(): gsap.core.Timeline {
    return this.worker.splitCard();
  }

  spawnPulse(at: LocationId, tint: PulseTint): { id: PulseId; tl: gsap.core.Timeline } {
    const tl = gsap.timeline();
    const id = this.pulses.spawn(anchorFor(at), tint);
    const mesh = this.pulses.meshOf(id)!;
    mesh.scale.setScalar(0.01);
    tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(2)' });
    return { id, tl };
  }

  carry(pulse: PulseId, from: LocationId, to: LocationId): gsap.core.Timeline {
    const tl = this.lift.carry(pulse, from, to);
    const mesh = this.pulses.meshOf(pulse);
    if (mesh) {
      tl.call(() => this.rig.track(mesh), undefined, 0);
      tl.call(() => this.rig.untrack(mesh));
      // Launch wind-up: a quick squash-and-stretch while the car comes to the floor (adds no time).
      if (!reducedMotion()) {
        const w = TIMING.launchWindup;
        const squash = gsap.timeline();
        squash.to(mesh.scale, { x: 1.28, y: 0.72, z: 1.28, duration: w, ease: 'power2.out' });
        squash.to(mesh.scale, { x: 1, y: 1, z: 1, duration: w * 1.8, ease: 'elastic.out(1, 0.45)' });
        tl.add(squash, 0);
      }
    }
    return tl;
  }

  courierTrip(pulse: PulseId, opts?: { fastForward?: boolean }): gsap.core.Timeline {
    const tl = this.courier.trip(pulse, opts);
    const van = this.courier.vanObject;
    tl.call(() => this.rig.track(van), undefined, 0);
    tl.call(() => this.rig.untrack(van));
    return tl;
  }

  deliver(pulse: PulseId, to: LocationId | 'worker'): gsap.core.Timeline {
    const tl = gsap.timeline();
    const mesh = this.pulses.meshOf(pulse);
    if (!mesh) return tl;
    const dest = anchorFor(to === 'worker' ? 'worker' : to);
    tl.to(mesh.position, { x: dest.x, y: dest.y, z: dest.z, duration: 0.5, ease: 'power2.in' });
    // Arrival settle: a small squash on impact before it is absorbed.
    if (!reducedMotion()) {
      tl.to(mesh.scale, { x: 1.25, y: 0.78, z: 1.25, duration: TIMING.arriveSettle * 0.5, ease: 'power2.out' });
    }
    tl.to(mesh.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.3 });
    tl.call(() => {
      this.rig.untrack(mesh);
      this.pulses.dispose(pulse);
    });
    return tl;
  }

  setMood(mood: Mood): gsap.core.Timeline {
    const m = MOODS[mood];
    const tl = gsap.timeline();
    const bg = this.world.scene.background as THREE.Color;
    const fog = this.world.scene.fog as THREE.Fog;
    const target = new THREE.Color(m.bg);
    tl.to(bg, { r: target.r, g: target.g, b: target.b, duration: 1.2 });
    tl.to(fog.color, { r: target.r, g: target.g, b: target.b, duration: 1.2 }, '<');
    return tl;
  }
}
