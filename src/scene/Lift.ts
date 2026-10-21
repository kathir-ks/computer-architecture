import * as THREE from 'three';
import gsap from 'gsap';
import { anchorFor, floorBaseY, FLOOR_H, FLOORS, LIFT_X } from './Building';
import { locationOf, type LocationId } from './locations';
import { liftDuration } from './timing';
import { reducedMotion } from './motion';
import type { Pulses, PulseId } from './effects/Pulse';
import type { Materials } from './materials';

/**
 * A ride eases with a small wind-up at the start and a settle at the end. `back.inOut` bakes both
 * into the ride's own duration, so the contract timing (0.6 s + 0.35 s per floor) is unchanged.
 */
const RIDE_EASE = 'back.inOut(1.4)';
const RIDE_EASE_REDUCED = 'power1.inOut';

/** The glowing lift that carries data pulses between floors — the bus. */
export class Lift {
  readonly group = new THREE.Group();
  private car = new THREE.Group();
  private doorMat: THREE.MeshStandardMaterial;
  private frameMat: THREE.LineBasicMaterial;
  readonly clickTargets: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, private pulses: Pulses, m: Materials) {
    const H = FLOORS * FLOOR_H;

    // Shaft outline and guide rails.
    const shaft = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2, H, 2)),
      new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.5 }),
    );
    shaft.position.set(LIFT_X, H / 2, 0);
    this.group.add(shaft);
    for (const [rx, rz] of [
      [-0.95, -0.95],
      [0.95, -0.95],
      [-0.95, 0.95],
      [0.95, 0.95],
    ]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, 0.05), m.darkMetal);
      rail.position.set(LIFT_X + rx, H / 2, rz);
      this.group.add(rail);
    }

    // Car: glass box, frame, floor, roof with a light, and door light strips on the open side.
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.1, 1.7), m.glass);
    this.clickTargets.push(glass);
    this.frameMat = new THREE.LineBasicMaterial({ color: 0x00e5ff });
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.7, 2.1, 1.7)), this.frameMat);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.08, 1.64), m.darkMetal);
    floor.position.y = -1.0;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.1, 1.74), m.darkMetal);
    roof.position.y = 1.07;
    const roofLight = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 1.2), m.emitter(0xcff6ff, 1.6));
    roofLight.position.y = 1.0;
    this.doorMat = m.emitter(0x00e5ff, 0.8);
    for (const dx of [-0.74, 0.74]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.8, 0.04), this.doorMat);
      strip.position.set(dx, 0, 0.87);
      this.car.add(strip);
    }
    this.car.add(glass, frame, floor, roof, roofLight);
    this.car.position.set(LIFT_X, floorBaseY(10) + 1.05, 0);
    this.group.add(this.car);

    scene.add(this.group);
  }

  setGlow(on: boolean): void {
    this.doorMat.emissiveIntensity = on ? 2.8 : 0.8;
    this.frameMat.color.setHex(on ? 0xffffff : 0x00e5ff);
  }

  private floorOf(id: LocationId): number {
    const f = locationOf(id).floor;
    return f === 'outside' ? 1 : f;
  }

  /** A short "ding": the door lights flare as the car arrives. Adds no time when placed with '<'. */
  private ding(): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.to(this.doorMat, { emissiveIntensity: 3.2, duration: 0.12, ease: 'power2.out' });
    tl.to(this.doorMat, { emissiveIntensity: 0.8, duration: 0.3, ease: 'power1.in' });
    return tl;
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
    const ease = reducedMotion() ? RIDE_EASE_REDUCED : RIDE_EASE;

    // Car comes to the pulse's floor if it isn't there.
    tl.to(this.car.position, { y: fromY, duration: 0.5, overwrite: 'auto' });
    // Pulse slides into the shaft.
    tl.to(mesh.position, { x: LIFT_X, z: 0, y: fromY, duration: 0.45, ease: 'power2.inOut' });
    // Ride together.
    tl.to(this.car.position, { y: toY, duration: ride, ease });
    tl.to(mesh.position, { y: toY, duration: ride, ease }, '<');
    // Pulse slides out to its destination anchor as the doors "ding".
    const dest = anchorFor(to);
    tl.to(mesh.position, {
      x: dest.x,
      y: dest.y,
      z: dest.z,
      duration: 0.45,
      ease: 'power2.inOut',
    });
    tl.add(this.ding(), '<');
    return tl;
  }
}
