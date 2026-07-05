import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Non-interactive set dressing outside the tower: neighbor buildings, trees,
 * streetlights and slowly drifting clouds (spec US4 / FR-013).
 *
 * Deliberately inert: registers NO click targets, exposes NO verbs, imports
 * nothing from story/sync/ui. Static props are merged into a handful of
 * meshes; the only animation is one frame callback drifting the cloud group.
 * All positions are deterministic and stay clear of the story's travel
 * corridors (the road z∈[6,10] between tower and warehouse, and the
 * warehouse apron around x=-26).
 */
export class Environment {
  readonly group = new THREE.Group();

  /** Prop counts, exposed for the bookkeeping unit test. */
  readonly counts = { buildings: 6, trees: 10, streetlights: 5, clouds: 5 };

  private clouds: THREE.Mesh[] = [];
  private static readonly CLOUD_SPEED = 0.55; // world units / second
  private static readonly CLOUD_WRAP_X = 70;

  constructor(scene: THREE.Scene, onFrame: (cb: (dt: number) => void) => void) {
    this.buildNeighborhood();
    this.buildClouds();
    scene.add(this.group);
    onFrame((dt) => this.drift(dt));
  }

  private buildNeighborhood(): void {
    const bodyGeos: THREE.BufferGeometry[] = [];
    const trunkGeos: THREE.BufferGeometry[] = [];
    const canopyGeos: THREE.BufferGeometry[] = [];
    const poleGeos: THREE.BufferGeometry[] = [];
    const headGeos: THREE.BufferGeometry[] = [];

    // Neighbor buildings: low pastel blocks on the flanks and behind the
    // tower — never in the front viewing arc's foreground, never on the road.
    const blocks: Array<[x: number, z: number, w: number, h: number, d: number]> = [
      [-36, 14, 6, 7, 5],
      [-34, 0, 5, 9, 5],
      [24, 10, 5, 8, 5],
      [28, -2, 6, 12, 5],
      [12, -16, 6, 9, 5],
      [-14, -18, 6, 11, 5],
    ];
    for (const [x, z, w, h, d] of blocks) {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, h / 2, z);
      bodyGeos.push(g);
    }

    // Trees: trunk + faceted canopy, scattered on the lawn.
    const trees: Array<[x: number, z: number, s: number]> = [
      [-14, 14, 1], [-4, 16, 1.2], [8, 14, 0.9], [14, 8, 1.1], [18, 13, 0.8],
      [-30, 14, 1], [-18, 2, 0.9], [12, 26, 1.2], [-2, 30, 1], [24, 14, 1],
    ];
    for (const [x, z, s] of trees) {
      const trunk = new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 1.4 * s, 6);
      trunk.translate(x, 0.7 * s, z);
      trunkGeos.push(trunk);
      const canopy = new THREE.IcosahedronGeometry(1.05 * s, 0);
      canopy.translate(x, 2.1 * s, z);
      canopyGeos.push(canopy);
    }

    // Streetlights along the road's far edge (z = 10.5): pole + emissive head.
    for (const x of [-26, -21, -16, -11, -6]) {
      const pole = new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6);
      pole.translate(x, 1.7, 10.5);
      poleGeos.push(pole);
      const head = new THREE.SphereGeometry(0.22, 8, 6);
      head.translate(x, 3.5, 10.5);
      headGeos.push(head);
    }

    const add = (geos: THREE.BufferGeometry[], mat: THREE.Material) => {
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      this.group.add(new THREE.Mesh(merged, mat));
    };
    add(bodyGeos, new THREE.MeshStandardMaterial({ color: 0xe3c8b4 })); // warm stucco
    add(trunkGeos, new THREE.MeshStandardMaterial({ color: 0x8a6f52 }));
    add(canopyGeos, new THREE.MeshStandardMaterial({ color: 0x7fb069 }));
    add(poleGeos, new THREE.MeshStandardMaterial({ color: 0x6b7683 }));
    add(
      headGeos,
      new THREE.MeshStandardMaterial({
        color: 0xfff1c4,
        emissive: 0xffd75e,
        emissiveIntensity: 0.8, // past bloom threshold: lamp heads twinkle
      }),
    );
  }

  private buildClouds(): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const spots: Array<[x: number, y: number, z: number, s: number]> = [
      [-40, 40, -10, 1.4],
      [-15, 46, 6, 1.0],
      [5, 42, -18, 1.8],
      [25, 44, 2, 1.2],
      [45, 39, -6, 0.9],
    ];
    for (const [x, y, z, s] of spots) {
      const puffs = [
        new THREE.SphereGeometry(2.6 * s, 8, 6),
        new THREE.SphereGeometry(1.9 * s, 8, 6),
        new THREE.SphereGeometry(1.6 * s, 8, 6),
      ];
      puffs[0].scale(1.4, 0.55, 1);
      puffs[1].translate(2.4 * s, 0.4 * s, 0.4 * s);
      puffs[1].scale(1.1, 0.6, 1);
      puffs[2].translate(-2.2 * s, 0.3 * s, -0.3 * s);
      puffs[2].scale(1.1, 0.6, 1);
      const cloud = new THREE.Mesh(mergeGeometries(puffs), mat);
      puffs.forEach((g) => g.dispose());
      cloud.position.set(x, y, z);
      this.group.add(cloud);
      this.clouds.push(cloud);
    }
  }

  /** One cheap per-frame update: constant drift + wrap. No allocations. */
  private drift(dt: number): void {
    for (const c of this.clouds) {
      c.position.x += Environment.CLOUD_SPEED * dt;
      if (c.position.x > Environment.CLOUD_WRAP_X) c.position.x = -Environment.CLOUD_WRAP_X;
    }
  }
}
