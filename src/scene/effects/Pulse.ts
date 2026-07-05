import * as THREE from 'three';

export type PulseId = number;
export type PulseTint = 'data' | 'instruction';

const TINTS: Record<PulseTint, number> = {
  data: 0xff2ea6,
  instruction: 0x00a8d6,
};

/** Glowing data pulses that travel through the world. */
export class Pulses {
  private meshes = new Map<PulseId, THREE.Mesh>();
  private nextId = 1;

  constructor(private scene: THREE.Scene) {}

  spawn(at: THREE.Vector3, tint: PulseTint): PulseId {
    const mat = new THREE.MeshStandardMaterial({
      color: TINTS[tint],
      emissive: TINTS[tint],
      emissiveIntensity: 2.4,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), mat);
    mesh.position.copy(at);
    this.scene.add(mesh);
    const id = this.nextId++;
    this.meshes.set(id, mesh);
    return id;
  }

  /** The mesh whose position GSAP tweens move around. */
  meshOf(id: PulseId): THREE.Mesh | undefined {
    return this.meshes.get(id);
  }

  dispose(id: PulseId): void {
    const mesh = this.meshes.get(id);
    if (!mesh) return;
    mesh.removeFromParent();
    (mesh.material as THREE.Material).dispose();
    mesh.geometry.dispose();
    this.meshes.delete(id);
  }
}
