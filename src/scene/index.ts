import * as THREE from 'three';
import gsap from 'gsap';
import { World } from './World';
import { anchorFor, Building } from './Building';
import { Worker, type RegisterName, type WorkKind } from './Worker';
import { Lift } from './Lift';
import { Courier } from './Courier';
import { Environment } from './Environment';
import { Pulses, type PulseId, type PulseTint } from './effects/Pulse';
import { Neon } from './effects/Neon';
import type { HighlightId, LocationId } from './locations';
import { TIMING } from './timing';

export type VantageId =
  | 'street'
  | 'building-front'
  | 'floor10-desk'
  | 'floor9-shelves'
  | 'floor8-storeroom'
  | 'floor4-archive'
  | 'warehouse'
  | 'lift-shaft'
  | 'recap-wide';

export type Mood = 'intro' | 'working' | 'tense-miss' | 'celebration';

/**
 * The ONLY interface the story layer may call (contract: scene-verbs.md).
 * The cue-integrity test runs chapters against a stub of this type.
 */
/** What the follow verb may track (contract: scene-verbs-v2.md). */
export type FollowTarget = 'courier' | 'lift' | PulseId;

/**
 * The single scripted-camera slot: flyTo and follow both register here, so
 * starting either kills the other, and a user grab kills whichever is active.
 * Pure bookkeeping — unit-tested with fake timelines.
 */
export class CameraSlot {
  private tl: { kill(): void } | null = null;

  /** Kill the current owner (if any) and install a new one. */
  acquire(tl: { kill(): void }): void {
    this.tl?.kill();
    this.tl = tl;
  }

  /** Called from a timeline's onComplete — only clears if still the owner. */
  release(tl: { kill(): void }): void {
    if (this.tl === tl) this.tl = null;
  }

  /** User grab: kill and clear whatever scripted move is running. */
  killActive(): void {
    this.tl?.kill();
    this.tl = null;
  }
}

/**
 * Aim updater for follow: tracks the target's last known world position so a
 * disposed pulse (delivered mid-follow) leaves the aim settling at its final
 * spot rather than chasing a vanished object (FR-011). Pure — unit-tested.
 */
export function createFollowAim(
  resolve: () => THREE.Object3D | null,
  aim: THREE.Vector3,
  lerp = 0.08,
): () => void {
  const last = new THREE.Vector3();
  resolve()?.getWorldPosition(last);
  return () => {
    resolve()?.getWorldPosition(last);
    aim.lerp(last, lerp);
  };
}

export interface SceneVerbs {
  flyTo(target: VantageId, opts?: { duration?: number }): gsap.core.Timeline;
  /**
   * Keep the camera aimed at a moving element for a bounded duration.
   * Aim-only (eases controls.target); shares the single scripted-camera slot
   * with flyTo; killed instantly by user grab. A disposed pulse target freezes
   * the aim at its last position (FR-011).
   */
  follow(target: FollowTarget, opts?: { duration?: number }): gsap.core.Timeline;
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

export const VANTAGES: Record<VantageId, { pos: [number, number, number]; target: [number, number, number] }> = {
  street: { pos: [6, 8, 44], target: [0, 10, 0] },
  'building-front': { pos: [20, 18, 32], target: [0, 14, 0] },
  'floor10-desk': { pos: [9, 31, 11], target: [3.2, 28.8, 0] },
  'floor9-shelves': { pos: [5, 27.5, 13], target: [0.2, 25.5, 0] },
  'floor8-storeroom': { pos: [6, 24.5, 13], target: [0.5, 22.5, 0] },
  'floor4-archive': { pos: [6, 12.5, 14], target: [0.5, 10.5, 0] },
  warehouse: { pos: [-16, 9, 26], target: [-26, 2.5, 8] },
  'lift-shaft': { pos: [-16, 17, 18], target: [-5.4, 15, 3.9] },
  'recap-wide': { pos: [26, 22, 42], target: [-8, 12, 0] },
};

// Daylight variants (FR-007): mood shifts stay within the pastel daytime look.
// hemi tints the hemisphere light so the mood reaches the room interiors,
// where a background-only change would be invisible.
const MOODS: Record<Mood, { bg: number; hemi: number }> = {
  intro: { bg: 0xf4e2c4, hemi: 0xffe2b3 }, // golden hour
  working: { bg: 0xdfe9f3, hemi: 0xbfd9ff }, // neutral daylight
  'tense-miss': { bg: 0xc9b3bd, hemi: 0xc79ab4 }, // overcast dusk, red-violet cast
  celebration: { bg: 0xf6ecd2, hemi: 0xffe9c0 }, // warm bright
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
  readonly environment: Environment;

  private cameraSlot = new CameraSlot();

  constructor(canvasHost: HTMLElement, labelsHost: HTMLElement) {
    this.world = new World(canvasHost, labelsHost);
    this.building = new Building(this.world);
    // Set dressing only — registers nothing clickable, unknown to the story.
    this.environment = new Environment(this.world.scene, (cb) => this.world.onFrame(cb));
    this.pulses = new Pulses(this.world.scene);
    this.worker = new Worker(this.world.scene);
    this.lift = new Lift(this.world.scene, this.pulses);
    this.courier = new Courier(this.world.scene, this.pulses);
    this.neon = new Neon(this.world);

    // Worker/lift/courier meshes participate in click-to-explain raycasting.
    for (const m of this.worker.clickTargets) this.building.addClickable(m, 'worker');
    for (const m of this.lift.clickTargets) this.building.addClickable(m, 'lift');
    for (const m of this.courier.clickTargets) this.building.addClickable(m, 'disk');

    // User input instantly wins over scripted camera moves (FR-006).
    this.world.onUserGrab(() => this.cameraSlot.killActive());

    this.world.start();
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

  // ---- SceneVerbs implementation ----

  flyTo(target: VantageId, opts?: { duration?: number }): gsap.core.Timeline {
    const v = VANTAGES[target];
    const dur = opts?.duration ?? TIMING.flyTo;
    const tl = gsap.timeline({ onComplete: () => this.cameraSlot.release(tl) });
    tl.to(this.world.camera.position, {
      x: v.pos[0],
      y: v.pos[1],
      z: v.pos[2],
      duration: dur,
      ease: 'power2.inOut',
    });
    tl.to(
      this.world.controls.target,
      { x: v.target[0], y: v.target[1], z: v.target[2], duration: dur, ease: 'power2.inOut' },
      '<',
    );
    this.cameraSlot.acquire(tl);
    return tl;
  }

  follow(target: FollowTarget, opts?: { duration?: number }): gsap.core.Timeline {
    const dur = opts?.duration ?? TIMING.follow;
    const resolve = (): THREE.Object3D | null =>
      target === 'courier'
        ? this.courier.vanGroup
        : target === 'lift'
          ? this.lift.carMesh
          : (this.pulses.meshOf(target) ?? null);

    const aim = createFollowAim(resolve, this.world.controls.target);
    const proxy = { t: 0 };
    const tl = gsap.timeline({ onComplete: () => this.cameraSlot.release(tl) });
    tl.to(proxy, { t: 1, duration: dur, ease: 'none', onUpdate: aim });
    this.cameraSlot.acquire(tl);
    return tl;
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
    return this.lift.carry(pulse, from, to);
  }

  courierTrip(pulse: PulseId, opts?: { fastForward?: boolean }): gsap.core.Timeline {
    return this.courier.trip(pulse, opts);
  }

  deliver(pulse: PulseId, to: LocationId | 'worker'): gsap.core.Timeline {
    const tl = gsap.timeline();
    const mesh = this.pulses.meshOf(pulse);
    if (!mesh) return tl;
    const dest = anchorFor(to === 'worker' ? 'worker' : to);
    tl.to(mesh.position, { x: dest.x, y: dest.y, z: dest.z, duration: 0.5, ease: 'power2.in' });
    tl.to(mesh.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.3 });
    tl.call(() => this.pulses.dispose(pulse));
    return tl;
  }

  setMood(mood: Mood): gsap.core.Timeline {
    const m = MOODS[mood];
    const tl = gsap.timeline();
    const bg = this.world.scene.background as THREE.Color;
    const fog = this.world.scene.fog as THREE.Fog;
    const target = new THREE.Color(m.bg);
    const hemi = new THREE.Color(m.hemi);
    tl.to(bg, { r: target.r, g: target.g, b: target.b, duration: 1.2 });
    tl.to(fog.color, { r: target.r, g: target.g, b: target.b, duration: 1.2 }, '<');
    tl.to(this.world.hemi.color, { r: hemi.r, g: hemi.g, b: hemi.b, duration: 1.2 }, '<');
    return tl;
  }
}
