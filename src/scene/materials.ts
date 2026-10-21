import * as THREE from 'three';
import { createTextures, WINDOW_TILE, type TextureSet } from './textures';
import type { QualityTier } from './view/viewState';

/**
 * Shared PBR material presets. Built once and reused; surfaces that need
 * per-room glow come from `tint()` so `flash`/`reveal` can tween their emissive.
 */
export class Materials {
  readonly textures: TextureSet = createTextures();

  readonly slab = new THREE.MeshStandardMaterial({
    color: 0x6a7699,
    map: this.textures.repeated(this.textures.tiles, 5, 3),
    roughness: 0.72,
    metalness: 0.05,
  });

  readonly concrete = new THREE.MeshStandardMaterial({
    color: 0x8a97b8,
    map: this.textures.concrete,
    bumpMap: this.textures.concreteBump,
    bumpScale: 0.6,
    roughness: 0.9,
    metalness: 0.02,
  });

  readonly metal = new THREE.MeshStandardMaterial({
    color: 0x9aa6c4,
    roughness: 0.38,
    metalness: 0.85,
  });

  readonly darkMetal = new THREE.MeshStandardMaterial({
    color: 0x38425f,
    roughness: 0.45,
    metalness: 0.7,
  });

  readonly wood = new THREE.MeshStandardMaterial({
    color: 0x9c7048,
    roughness: 0.65,
    metalness: 0.02,
  });

  readonly rubber = new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.9, metalness: 0 });

  readonly asphalt = new THREE.MeshStandardMaterial({ color: 0x2c3447, roughness: 0.95, metalness: 0 });

  readonly ground = new THREE.MeshStandardMaterial({
    color: 0x2a3550,
    map: this.textures.repeated(this.textures.tiles, 40, 40),
    roughness: 0.95,
    metalness: 0,
  });

  readonly glass = new THREE.MeshPhysicalMaterial({
    color: 0xa8dcff,
    transparent: true,
    opacity: 0.26,
    roughness: 0.06,
    metalness: 0,
    depthWrite: false,
    clearcoat: 1,
  });

  /** Walls with a lit-window texture sized to a wall of `width` x `height` world units. */
  windowWall(width: number, height: number): THREE.MeshStandardMaterial {
    const rx = width / WINDOW_TILE.w;
    const ry = height / WINDOW_TILE.h;
    return new THREE.MeshStandardMaterial({
      color: 0x5f6d94,
      map: this.textures.repeated(this.textures.windowMap, rx, ry),
      emissive: 0xffffff,
      emissiveMap: this.textures.repeated(this.textures.windowEmissive, rx, ry),
      emissiveIntensity: 0.55,
      roughness: 0.85,
      metalness: 0.02,
    });
  }

  /** A surface with a self-lit tint — the kind `flash`, `reveal` and `setGlow` drive. */
  tint(color: number, emissiveIntensity: number, opts?: { whiteBase?: boolean }): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: opts?.whiteBase ? 0xffffff : color,
      emissive: color,
      emissiveIntensity,
      roughness: 0.5,
      metalness: 0.1,
    });
  }

  /** Pure light-emitter (strips, LEDs, lamp heads). */
  emitter(color: number, intensity = 1.4): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0x0a0e1a,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.4,
    });
  }

  setTier(tier: QualityTier): void {
    this.glass.clearcoat = tier === 'high' ? 1 : 0;
    this.glass.needsUpdate = true;
  }
}
