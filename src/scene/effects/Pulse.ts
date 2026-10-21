import * as THREE from 'three';
import { reducedMotion } from '../motion';
import type { Trails } from './Trails';

export type PulseId = number;
export type PulseTint = 'data' | 'instruction';

const TINTS: Record<PulseTint, number> = {
  data: 0xff2ea6,
  instruction: 0x00e5ff,
};

const BLOCK = new THREE.BoxGeometry(0.42, 0.42, 0.42);
const BLOCK_EDGES = new THREE.EdgesGeometry(BLOCK);
const CARD = new THREE.BoxGeometry(0.68, 0.44, 0.05);
const STRIPE = new THREE.BoxGeometry(0.46, 0.04, 0.02);

/**
 * Glowing things that travel through the world. Instructions are flat CARDS, data values are
 * spinning BLOCKS — shape and colour both tell the learner which is which.
 */
export class Pulses {
  private meshes = new Map<PulseId, THREE.Mesh>();
  private tints = new Map<PulseId, PulseTint>();
  private nextId = 1;

  constructor(
    private scene: THREE.Scene,
    private trails?: Trails,
  ) {}

  spawn(at: THREE.Vector3, tint: PulseTint): PulseId {
    const color = TINTS[tint];
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: tint === 'data' ? 2.2 : 1.8,
      roughness: 0.35,
    });
    const mesh = new THREE.Mesh(tint === 'data' ? BLOCK : CARD, mat);
    if (tint === 'data') {
      mesh.add(new THREE.LineSegments(BLOCK_EDGES, new THREE.LineBasicMaterial({ color: 0xffffff })));
    } else {
      const ink = new THREE.MeshBasicMaterial({ color: 0x06202a });
      for (const y of [0.1, 0, -0.1]) {
        const stripe = new THREE.Mesh(STRIPE, ink);
        stripe.position.set(0, y, 0.03);
        mesh.add(stripe);
      }
    }
    mesh.position.copy(at);
    this.scene.add(mesh);
    const id = this.nextId++;
    this.meshes.set(id, mesh);
    this.tints.set(id, tint);
    this.trails?.attach(mesh, color);
    return id;
  }

  /** The mesh whose position GSAP tweens move around. */
  meshOf(id: PulseId): THREE.Mesh | undefined {
    return this.meshes.get(id);
  }

  /** Per-frame life: data blocks tumble slowly (skipped under reduced motion). */
  update(dt: number): void {
    if (reducedMotion()) return;
    for (const [id, mesh] of this.meshes) {
      if (this.tints.get(id) === 'data') {
        mesh.rotation.y += dt * 1.6;
        mesh.rotation.x += dt * 0.7;
      }
    }
  }

  dispose(id: PulseId): void {
    const mesh = this.meshes.get(id);
    if (!mesh) return;
    this.trails?.detach(mesh);
    mesh.removeFromParent();
    // Geometries are shared module constants; only materials are per-pulse.
    mesh.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      mat?.dispose();
    });
    this.meshes.delete(id);
    this.tints.delete(id);
  }
}
