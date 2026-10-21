import * as THREE from 'three';
import gsap from 'gsap';
import { anchorFor, BLD_W, WAREHOUSE_POS } from './Building';
import { TIMING } from './timing';
import type { Pulses, PulseId } from './effects/Pulse';
import type { Materials } from './materials';

const WHEEL_RADIUS = 0.28;
/** How long the van takes to swing round at each end — overlapped with driving, adds no time. */
const TURN = 0.5;

/** The courier van that makes the painfully slow trip to the disk warehouse. */
export class Courier {
  readonly group = new THREE.Group();
  private van: THREE.Group;
  private wheels: THREE.Group[] = [];
  private bodyMat: THREE.MeshStandardMaterial;
  readonly clickTargets: THREE.Mesh[] = [];
  private home = new THREE.Vector3(-BLD_W / 2 - 2, 0.55, 8);

  constructor(scene: THREE.Scene, private pulses: Pulses, m: Materials) {
    this.van = new THREE.Group();
    this.bodyMat = m.tint(0x7a62d1, 0.25);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.2), this.bodyMat);
    this.van.add(body);
    this.clickTargets.push(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.1), this.bodyMat);
    cab.position.set(-1.4, -0.1, 0);
    this.van.add(cab);
    this.clickTargets.push(cab);

    // Windscreen + side windows, roof stripe.
    const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.9), m.glass);
    windscreen.position.set(-1.81, 0, 0);
    this.van.add(windscreen);
    for (const sz of [0.56, -0.56]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.03), m.glass);
      win.position.set(-1.4, 0.02, sz);
      this.van.add(win);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 1.22), m.emitter(0x00e5ff, 0.9));
    stripe.position.set(0, 0.2, 0);
    this.van.add(stripe);

    // Headlights (front = -x).
    for (const hz of [0.4, -0.4]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.2), m.emitter(0xfff0c0, 2.2));
      lamp.position.set(-1.82, -0.28, hz);
      this.van.add(lamp);
    }

    // Wheels: the pivot spins about z; the cylinder is turned to lie along the axle.
    const wheelGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.18, 14);
    const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 8);
    for (const [wx, wz] of [
      [-1.3, 0.6],
      [0.7, 0.6],
      [-1.3, -0.6],
      [0.7, -0.6],
    ]) {
      const pivot = new THREE.Group();
      pivot.position.set(wx, -0.5, wz);
      const tyre = new THREE.Mesh(wheelGeo, m.rubber);
      tyre.rotation.x = Math.PI / 2;
      const hub = new THREE.Mesh(hubGeo, m.metal);
      hub.rotation.x = Math.PI / 2;
      pivot.add(tyre, hub);
      this.van.add(pivot);
      this.wheels.push(pivot);
    }

    this.van.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !(mesh.material as THREE.Material).transparent) mesh.castShadow = true;
    });
    this.van.position.copy(this.home);
    this.group.add(this.van);
    scene.add(this.group);
  }

  /** The van, for the camera to follow during a trip. */
  get vanObject(): THREE.Object3D {
    return this.van;
  }

  setGlow(on: boolean): void {
    this.bodyMat.emissiveIntensity = on ? 1.0 : 0.25;
  }

  /** Roll the wheels for a drive of `distance` taking `duration` seconds. */
  private spin(tl: gsap.core.Timeline, distance: number, duration: number, at: number | string): void {
    const turns = distance / WHEEL_RADIUS;
    for (const w of this.wheels) {
      tl.to(w.rotation, { z: `+=${distance < 0 ? -turns : turns}`, duration, ease: 'power1.inOut' }, at);
    }
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
    const dist = Math.hypot(wh.x - this.home.x, wh.z - this.home.z);

    // Drive out (empty — going to fetch the page from disk). Front of the van is -x.
    tl.to(this.van.position, { x: wh.x, z: wh.z, duration: leg, ease: 'power1.inOut' });
    this.spin(tl, dist, leg, '<');
    // Swing round at the warehouse during the loading pause.
    tl.to(this.van.rotation, { y: Math.PI, duration: TURN, ease: 'power2.inOut' }, `>-${TURN}`);

    // Load the pulse at the warehouse.
    if (mesh) {
      const src = anchorFor('disk');
      tl.call(() => mesh.position.copy(src));
      tl.to(mesh.position, { y: 1.35, duration: 0.4 });
      // Drive home with the pulse tracking the van.
      tl.to(this.van.position, { x: this.home.x, z: this.home.z, duration: leg, ease: 'power1.inOut' });
      this.spin(tl, dist, leg, '<');
      tl.to(mesh.position, { x: this.home.x, z: this.home.z, y: 1.35, duration: leg, ease: 'power1.inOut' }, '<');
    } else {
      tl.to(this.van.position, { x: this.home.x, z: this.home.z, duration: leg, ease: 'power1.inOut' });
      this.spin(tl, dist, leg, '<');
    }
    // Back at the kerb: turn to face the warehouse again, ready for the next trip.
    tl.to(this.van.rotation, { y: 0, duration: TURN, ease: 'power2.inOut' }, `>-${TURN}`);
    return tl;
  }
}
