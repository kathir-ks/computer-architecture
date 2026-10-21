import * as THREE from 'three';
import { TIMING } from '../timing';

interface Sample {
  p: THREE.Vector3;
  age: number;
}

/** A teleport (e.g. the van "loading" a pulse) larger than this clears the trail instead of streaking. */
const JUMP = 6;
const MIN_STEP = 0.05;
const HEAD_WIDTH = 0.24;

class Trail {
  readonly samples: Sample[] = [];
  readonly mesh: THREE.Mesh;
  private pos: THREE.BufferAttribute;
  private col: THREE.BufferAttribute;
  private geo = new THREE.BufferGeometry();
  private base: THREE.Color;

  constructor(
    readonly target: THREE.Object3D,
    color: number,
    cap: number,
  ) {
    this.base = new THREE.Color(color);
    this.pos = new THREE.BufferAttribute(new Float32Array(cap * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.BufferAttribute(new Float32Array(cap * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pos);
    this.geo.setAttribute('color', this.col);
    const index: number[] = [];
    for (let i = 0; i < cap - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(index);
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
  }

  update(dt: number, camera: THREE.Camera, life: number, maxSamples: number): void {
    for (const s of this.samples) s.age += dt;

    const now = this.target.position;
    const head = this.samples[0];
    if (!head || head.p.distanceTo(now) > MIN_STEP) {
      if (head && head.p.distanceTo(now) > JUMP) this.samples.length = 0;
      this.samples.unshift({ p: now.clone(), age: 0 });
    }
    while (this.samples.length > maxSamples) this.samples.pop();
    while (this.samples.length && this.samples[this.samples.length - 1].age > life) this.samples.pop();

    const n = this.samples.length;
    this.mesh.visible = n >= 2;
    if (n < 2) return;

    const view = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const s = this.samples[i];
      const prev = this.samples[Math.max(i - 1, 0)].p;
      const next = this.samples[Math.min(i + 1, n - 1)].p;
      tangent.subVectors(prev, next);
      view.subVectors(camera.position, s.p);
      side.crossVectors(tangent, view);
      if (side.lengthSq() < 1e-8) side.set(0, 1, 0);
      side.normalize();

      const fade = Math.max(0, 1 - s.age / life);
      const taper = 1 - i / n;
      const w = HEAD_WIDTH * taper * 0.5;
      this.pos.setXYZ(i * 2, s.p.x + side.x * w, s.p.y + side.y * w, s.p.z + side.z * w);
      this.pos.setXYZ(i * 2 + 1, s.p.x - side.x * w, s.p.y - side.y * w, s.p.z - side.z * w);
      const k = fade * fade * taper * 1.6;
      this.col.setXYZ(i * 2, this.base.r * k, this.base.g * k, this.base.b * k);
      this.col.setXYZ(i * 2 + 1, this.base.r * k, this.base.g * k, this.base.b * k);
    }
    this.pos.needsUpdate = true;
    this.col.needsUpdate = true;
    this.geo.setDrawRange(0, (n - 1) * 6);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/**
 * Fading ribbon trails behind moving pulses: the length and spread of a trail are a direct
 * read-out of direction and speed. Length scales with the quality tier; detail 0 hides them.
 */
export class Trails {
  private trails = new Map<THREE.Object3D, Trail>();
  private detail = 1;

  constructor(private scene: THREE.Scene) {}

  attach(target: THREE.Object3D, color: number): void {
    if (this.trails.has(target)) return;
    const trail = new Trail(target, color, TIMING.trailSamples);
    this.scene.add(trail.mesh);
    this.trails.set(target, trail);
  }

  detach(target: THREE.Object3D): void {
    const t = this.trails.get(target);
    if (!t) return;
    t.dispose();
    this.trails.delete(target);
  }

  /** 1 = full length, 0 = none. */
  setDetail(detail: number): void {
    this.detail = detail;
    if (detail <= 0) for (const t of this.trails.values()) t.mesh.visible = false;
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this.detail <= 0) return;
    const life = TIMING.trailLife * (0.5 + 0.5 * this.detail);
    const maxSamples = Math.max(2, Math.ceil(TIMING.trailSamples * this.detail));
    for (const t of this.trails.values()) t.update(dt, camera, life, maxSamples);
  }
}
