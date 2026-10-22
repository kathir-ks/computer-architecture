import type * as THREE from 'three';
import gsap from 'gsap';
import { TIMING } from '../timing';
import { scaleDuration } from '../motion';

/** How see-through the decoration gets. Low enough to read the rooms, high enough to still feel like a building. */
export const XRAY_FADED_OPACITY = 0.12;

interface Faded {
  mat: THREE.Material;
  rest: number;
  restTransparent: boolean;
  restDepthWrite: boolean;
}

interface Revealed {
  mat: THREE.Material;
  shown: number;
}

/** What a CSS2D label looks like to us — keeps this module free of the renderer. */
export interface LabelLike {
  visible: boolean;
  element: HTMLElement;
}

/**
 * The X-ray cross-section (research D9). A material-opacity fade, not a clipping plane or a second render
 * pass, so it costs next to nothing and works on the lowest quality tier.
 *
 *  - decor     fades down to ~0.12 (outer walls, filler racks and their LEDs on the spare floors)
 *  - blueprint only exists while X-ray is on (outlines of the spare floors)
 *  - labels    the floor-role labels, shown only while X-ray is on
 *
 * It owns one tween on its own value and nothing else, so toggling it mid-animation never restarts, pauses
 * or desynchronises a story timeline. Toggling again mid-fade reverses from wherever it has got to.
 */
export class Xray {
  private decor: Faded[] = [];
  private blueprint: Revealed[] = [];
  private labels: LabelLike[] = [];
  private amount = { v: 0 };
  private target: 0 | 1 = 0;
  private tween: gsap.core.Tween | null = null;

  /** 0 = the full building, 1 = fully X-rayed. */
  get progress(): number {
    return this.amount.v;
  }

  get active(): boolean {
    return this.target === 1;
  }

  /** Decoration that fades out. Register each material once; shared materials fade everything that uses them. */
  fade(mat: THREE.Material): void {
    this.decor.push({ mat, rest: mat.opacity, restTransparent: mat.transparent, restDepthWrite: mat.depthWrite });
    this.apply();
  }

  /** Something that exists only in X-ray (a blueprint outline). Fades in to `shown` opacity. */
  reveal(mat: THREE.Material, shown = 0.6): void {
    this.blueprint.push({ mat, shown });
    this.apply();
  }

  /** A label shown only in X-ray. */
  label(obj: LabelLike): void {
    this.labels.push(obj);
    this.apply();
  }

  set(on: boolean, opts?: { instant?: boolean }): void {
    const target = on ? 1 : 0;
    // Already there, or already on the way: other view changes (quality, camera) must not restart a fade.
    if (target === this.target && !opts?.instant) return;
    this.target = target;
    this.tween?.kill();
    this.tween = null;

    const duration = scaleDuration(TIMING.xrayFade);
    if (opts?.instant || duration <= 0) {
      this.amount.v = target;
      this.apply();
      return;
    }
    this.tween = gsap.to(this.amount, {
      v: target,
      duration: duration * Math.abs(target - this.amount.v), // reversing mid-fade takes proportionally less
      ease: 'power2.inOut',
      onUpdate: () => this.apply(),
      onComplete: () => {
        this.tween = null;
        this.apply();
      },
    });
  }

  /** Write the current amount into every registered thing. Idempotent. */
  private apply(): void {
    const p = this.amount.v;

    for (const d of this.decor) {
      if (p <= 0) {
        // Back to exactly how it was built — no residual transparency or depth-write change.
        this.setFlags(d.mat, d.restTransparent, d.restDepthWrite);
        d.mat.opacity = d.rest;
        continue;
      }
      const faded = Math.min(d.rest, XRAY_FADED_OPACITY);
      d.mat.opacity = d.rest + (faded - d.rest) * p;
      // A see-through wall must not hide what is behind it.
      this.setFlags(d.mat, true, false);
    }

    for (const b of this.blueprint) {
      b.mat.visible = p > 0;
      b.mat.opacity = b.shown * p;
      this.setFlags(b.mat, true, false);
    }

    for (const l of this.labels) {
      l.visible = p > 0;
      l.element.style.opacity = String(p);
    }
  }

  private setFlags(mat: THREE.Material, transparent: boolean, depthWrite: boolean): void {
    if (mat.transparent !== transparent) {
      mat.transparent = transparent;
      mat.needsUpdate = true;
    }
    mat.depthWrite = depthWrite;
  }
}
