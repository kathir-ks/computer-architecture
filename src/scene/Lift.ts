import * as THREE from 'three';
import gsap from 'gsap';
import { anchorFor, floorBaseY, FLOOR_H, FLOORS, LIFT_X, LIFT_Z } from './Building';
import { locationOf, type LocationId } from './locations';
import { liftDuration } from './timing';
import type { Pulses, PulseId } from './effects/Pulse';

/** The glowing lift that carries data pulses between floors — the bus. */
export class Lift {
  readonly group = new THREE.Group();
  private car: THREE.Mesh;
  readonly clickTargets: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, private pulses: Pulses) {
    // Glass tube on the building's open face: one convex transparent shell.
    // depthWrite off so the car/pulse inside never get sorting artifacts.
    const tubeGeo = new THREE.CylinderGeometry(1.35, 1.35, FLOORS * FLOOR_H, 12, 1, true);
    const tube = new THREE.Mesh(
      tubeGeo,
      new THREE.MeshStandardMaterial({
        color: 0xbfd8e8,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    tube.position.set(LIFT_X, (FLOORS * FLOOR_H) / 2, LIFT_Z);
    this.group.add(tube);

    // Edge rails so the tube reads at a glance even where glass is invisible.
    const railGeo = new THREE.CylinderGeometry(0.05, 0.05, FLOORS * FLOOR_H, 6);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x0e7c9c, emissive: 0x0e7c9c, emissiveIntensity: 0.35 });
    for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(LIFT_X + Math.sin(a) * 1.35, (FLOORS * FLOOR_H) / 2, LIFT_Z + Math.cos(a) * 1.35);
      this.group.add(rail);
    }

    // Car
    const carMat = new THREE.MeshStandardMaterial({
      color: 0x9adfef,
      emissive: 0x0e7c9c,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.85,
    });
    this.car = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.1, 1.7), carMat);
    this.car.position.set(LIFT_X, floorBaseY(10) + 1.05, LIFT_Z);
    this.group.add(this.car);
    this.clickTargets.push(this.car);

    scene.add(this.group);
  }

  /** The mesh the follow verb tracks during carries. */
  get carMesh(): THREE.Mesh {
    return this.car;
  }

  setGlow(on: boolean): void {
    (this.car.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.2 : 0.4;
  }

  private floorOf(id: LocationId): number {
    const f = locationOf(id).floor;
    return f === 'outside' ? 1 : f;
  }

  /**
   * Carry a pulse from one location to another via the lift:
   * pulse slides to the shaft, rides down/up with the car, slides to its target.
   * Travel time is the latency the learner *feels*.
   */
  carry(pulse: PulseId, from: LocationId, to: LocationId): gsap.core.Timeline {
    const tl = gsap.timeline();
    const mesh = this.pulses.meshOf(pulse);
    if (!mesh) return tl;

    const fromFloor = this.floorOf(from);
    const toFloor = this.floorOf(to);
    const fromY = floorBaseY(fromFloor) + 1.05;
    const toY = floorBaseY(toFloor) + 1.05;
    const ride = liftDuration(fromFloor, toFloor);

    // Car comes to the pulse's floor if it isn't there.
    tl.to(this.car.position, { y: fromY, duration: 0.5, overwrite: 'auto' });
    // Pulse slides into the tube.
    tl.to(mesh.position, { x: LIFT_X, z: LIFT_Z, y: fromY, duration: 0.45, ease: 'power2.inOut' });
    // Ride together.
    tl.to(this.car.position, { y: toY, duration: ride, ease: 'power1.inOut' });
    tl.to(mesh.position, { y: toY, duration: ride, ease: 'power1.inOut' }, '<');
    // Pulse slides out to its destination anchor.
    const dest = anchorFor(to);
    tl.to(mesh.position, {
      x: dest.x,
      y: dest.y,
      z: dest.z,
      duration: 0.45,
      ease: 'power2.inOut',
    });
    return tl;
  }
}
