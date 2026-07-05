import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as THREE from 'three';
import type { World } from '../World';

/**
 * Bloom post-processing with a quality switch. When quality is off the World
 * falls back to plain rendering (renderOverride = null) — highlights still work
 * because they are emissive-intensity based, not bloom-dependent.
 */
export class Neon {
  private composer: EffectComposer;
  private enabled = false;
  private changeCbs = new Set<(on: boolean) => void>();

  constructor(private world: World) {
    this.composer = new EffectComposer(world.renderer);
    this.composer.addPass(new RenderPass(world.scene, world.camera));
    const size = world.renderer.getSize(new THREE.Vector2());
    // Daylight tuning: bloom is an accent for emissive actors (pulses, lift,
    // glows) only — high threshold keeps pastel surfaces crisp (research R8).
    this.composer.addPass(new UnrealBloomPass(size, 0.35, 0.5, 0.92));
    world.onResize((w, h) => this.composer.setSize(w, h));
    this.setQuality(true);
  }

  get isOn(): boolean {
    return this.enabled;
  }

  setQuality(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    this.world.renderOverride = on ? () => this.composer.render() : null;
    for (const cb of this.changeCbs) cb(on);
  }

  onChange(cb: (on: boolean) => void): void {
    this.changeCbs.add(cb);
  }
}

/**
 * Pure decision function for the fps watchdog (unit-testable, no rendering).
 * Feed it fps samples (one per ~60 frames); it returns true exactly once when
 * quality should step down: sustained low fps over `windowSize` samples.
 */
export function createQualityWatchdog(opts?: {
  threshold?: number;
  windowSize?: number;
}): (fps: number) => boolean {
  const threshold = opts?.threshold ?? 30;
  const windowSize = opts?.windowSize ?? 3;
  let consecutiveLow = 0;
  let tripped = false;
  return (fps: number) => {
    if (tripped) return false;
    consecutiveLow = fps < threshold ? consecutiveLow + 1 : 0;
    if (consecutiveLow >= windowSize) {
      tripped = true;
      return true;
    }
    return false;
  };
}
