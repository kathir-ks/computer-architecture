import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CameraSlot, createFollowAim, VANTAGES } from '../../src/scene/index';
import { VIEW_ARC } from '../../src/scene/World';
import { TIMING } from '../../src/scene/timing';

/**
 * Every scripted vantage must sit inside the user's allowed viewing arc —
 * otherwise a flyTo parks the camera somewhere OrbitControls' clamps then
 * fight the moment the user touches the mouse (spec FR-002, data-model
 * ViewingArc invariant).
 */

/** Spherical angles of the camera offset, matching THREE.Spherical/OrbitControls:
 *  azimuth (theta) measured around +y from the +z axis; polar (phi) from +y. */
function anglesOf(pos: [number, number, number], target: [number, number, number]) {
  const dx = pos[0] - target[0];
  const dy = pos[1] - target[1];
  const dz = pos[2] - target[2];
  const r = Math.hypot(dx, dy, dz);
  return { azimuth: Math.atan2(dx, dz), polar: Math.acos(dy / r) };
}

const EPS = 1e-6;

describe('CameraSlot (flyTo/follow arbitration)', () => {
  const fakeTl = () => ({ kill: vi.fn() });

  it('acquiring kills the previous owner (flyTo vs follow exclusivity)', () => {
    const slot = new CameraSlot();
    const a = fakeTl();
    const b = fakeTl();
    slot.acquire(a);
    slot.acquire(b);
    expect(a.kill).toHaveBeenCalledOnce();
    expect(b.kill).not.toHaveBeenCalled();
  });

  it('user grab kills the active scripted move', () => {
    const slot = new CameraSlot();
    const a = fakeTl();
    slot.acquire(a);
    slot.killActive();
    expect(a.kill).toHaveBeenCalledOnce();
    // Idempotent: nothing left to kill.
    slot.killActive();
    expect(a.kill).toHaveBeenCalledOnce();
  });

  it('release only clears the slot for the current owner', () => {
    const slot = new CameraSlot();
    const a = fakeTl();
    const b = fakeTl();
    slot.acquire(a);
    slot.acquire(b);
    slot.release(a); // stale release from the killed timeline's onComplete
    slot.killActive();
    expect(b.kill).toHaveBeenCalledOnce(); // b was still owner
  });
});

describe('createFollowAim (FR-011 disposal safety)', () => {
  it('eases the aim toward a moving target', () => {
    const target = new THREE.Object3D();
    target.position.set(10, 0, 0);
    target.updateMatrixWorld();
    const aim = new THREE.Vector3(0, 0, 0);
    const update = createFollowAim(() => target, aim, 0.5);
    update();
    expect(aim.x).toBeCloseTo(5);
    update();
    expect(aim.x).toBeCloseTo(7.5);
  });

  it('freezes at the last known position when the target is disposed', () => {
    const target = new THREE.Object3D();
    target.position.set(8, 0, 0);
    target.updateMatrixWorld();
    let alive = true;
    const aim = new THREE.Vector3(0, 0, 0);
    const update = createFollowAim(() => (alive ? target : null), aim, 0.5);
    update(); // 4
    alive = false; // pulse delivered/disposed mid-follow
    update(); // keeps easing toward last known (8), no throw
    update();
    expect(aim.x).toBeCloseTo(7);
  });

  it('starts from a null target without error (never-spawned pulse)', () => {
    const aim = new THREE.Vector3(1, 2, 3);
    const update = createFollowAim(() => null, aim, 0.5);
    update();
    // Aim eases toward origin (the Vector3 default) rather than throwing.
    expect(aim.x).toBeCloseTo(0.5);
  });
});

describe('TIMING.follow default', () => {
  it('exists and is a sane positive duration', () => {
    expect(TIMING.follow).toBeGreaterThan(0);
    expect(TIMING.follow).toBeLessThan(30);
  });
});

describe('VANTAGES lie within VIEW_ARC', () => {
  for (const [name, v] of Object.entries(VANTAGES)) {
    it(`${name} is inside the arc`, () => {
      const { azimuth, polar } = anglesOf(v.pos, v.target);
      expect(azimuth).toBeGreaterThanOrEqual(VIEW_ARC.minAzimuth - EPS);
      expect(azimuth).toBeLessThanOrEqual(VIEW_ARC.maxAzimuth + EPS);
      expect(polar).toBeGreaterThanOrEqual(VIEW_ARC.minPolar - EPS);
      expect(polar).toBeLessThanOrEqual(VIEW_ARC.maxPolar + EPS);
    });
  }
});
