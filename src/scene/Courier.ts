import * as THREE from 'three';
import gsap from 'gsap';
import { anchorFor, BLD_W, WAREHOUSE_POS } from './Building';
import { TIMING } from './timing';
import type { Pulses, PulseId } from './effects/Pulse';

/** The courier van that makes the painfully slow trip to the disk warehouse. */
export class Courier {
  readonly group = new THREE.Group();
  private van: THREE.Group;
  readonly clickTargets: THREE.Mesh[] = [];
  private home = new THREE.Vector3(-BLD_W / 2 - 2, 0.55, 8);

  constructor(scene: THREE.Scene, private pulses: Pulses) {
    this.van = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x6c4fe0,
      emissive: 0x6c4fe0,
      emissiveIntensity: 0.25,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.2), bodyMat);
    this.van.add(body);
    this.clickTargets.push(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.1), bodyMat);
    cab.position.set(-1.4, -0.1, 0);
    this.van.add(cab);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111 });
    for (const [wx, wz] of [
      [-1.3, 0.6],
      [0.7, 0.6],
      [-1.3, -0.6],
      [0.7, -0.6],
    ]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, -0.5, wz);
      this.van.add(w);
    }
    this.van.position.copy(this.home);
    this.group.add(this.van);
    scene.add(this.group);
  }

  /** The group the follow verb tracks during trips. */
  get vanGroup(): THREE.Group {
    return this.van;
  }

  setGlow(on: boolean): void {
    for (const t of this.clickTargets)
      (t.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.0 : 0.25;
  }

  /**
   * Round trip to the warehouse carrying/collecting a pulse.
   * `fastForward` compresses "…millions of cycles later" into a watchable beat.
   */
  trip(pulse: PulseId, opts?: { fastForward?: boolean }): gsap.core.Timeline {
    const tl = gsap.timeline();
    const mesh = this.pulses.meshOf(pulse);
    const total = opts?.fastForward ? TIMING.courierTripFast : TIMING.courierTrip;
    const leg = total / 2;
    const wh = WAREHOUSE_POS.clone().add(new THREE.Vector3(2, 0.55, 0));

    // Drive out (empty — going to fetch the page from disk).
    tl.to(this.van.position, { x: wh.x, z: wh.z, duration: leg, ease: 'power1.inOut' });
    // Load the pulse at the warehouse.
    if (mesh) {
      const src = anchorFor('disk');
      tl.call(() => mesh.position.copy(src));
      tl.to(mesh.position, { y: 1.35, duration: 0.4 });
      // Drive home with the pulse tracking the van.
      tl.to(this.van.position, { x: this.home.x, z: this.home.z, duration: leg, ease: 'power1.inOut' });
      tl.to(mesh.position, { x: this.home.x, z: this.home.z, y: 1.35, duration: leg, ease: 'power1.inOut' }, '<');
    } else {
      tl.to(this.van.position, { x: this.home.x, z: this.home.z, duration: leg, ease: 'power1.inOut' });
    }
    return tl;
  }
}
