import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { followStep, type FollowRig } from '../../src/scene/camera/follow';
import { SHOTS } from '../../src/scene/camera/shots';
import { anchorFor, LIFT_X, WAREHOUSE_POS, BLD_W, floorBaseY } from '../../src/scene/Building';
import { liftDuration, TIMING } from '../../src/scene/timing';

const FPS = 60;
const DT = 1 / FPS;
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t); // ease-in-out, peak speed ≈ 1.57× average

type Path = { duration: number; at(t: number): THREE.Vector3 };

function segment(a: THREE.Vector3, b: THREE.Vector3, duration: number) {
  return { duration, at: (t: number) => a.clone().lerp(b, ease(Math.min(1, t / duration))) };
}

function chain(...segs: Array<ReturnType<typeof segment>>): Path {
  const duration = segs.reduce((s, x) => s + x.duration, 0);
  return {
    duration,
    at(t) {
      let rest = Math.min(t, duration);
      for (const s of segs) {
        if (rest <= s.duration) return s.at(rest);
        rest -= s.duration;
      }
      return segs[segs.length - 1].at(segs[segs.length - 1].duration);
    },
  };
}

/** The lift carry path exactly as Lift.carry builds it: slide in, ride, slide out. */
function liftPath(fromFloor: number, toFloor: number, from: THREE.Vector3, to: THREE.Vector3): Path {
  const fromY = floorBaseY(fromFloor) + 1.05;
  const toY = floorBaseY(toFloor) + 1.05;
  const shaftA = new THREE.Vector3(LIFT_X, fromY, 0);
  const shaftB = new THREE.Vector3(LIFT_X, toY, 0);
  return chain(
    segment(from, shaftA, 0.5 + 0.45),
    segment(shaftA, shaftB, liftDuration(fromFloor, toFloor)),
    segment(shaftB, to, 0.45),
  );
}

function courierPath(total: number): Path {
  const home = new THREE.Vector3(-BLD_W / 2 - 2, 0.55, 8);
  const wh = WAREHOUSE_POS.clone().add(new THREE.Vector3(2, 0.55, 0));
  const leg = total / 2;
  return chain(segment(home, wh, leg), segment(wh, wh, 0.4), segment(wh, home, leg));
}

function makeRig(aspect: number, shot = SHOTS['building-front']): FollowRig {
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 300);
  camera.position.set(...shot.pos);
  const target = new THREE.Vector3(...shot.target);
  camera.lookAt(target);
  return { camera, target };
}

/** Run a subject along a path with the follow camera and return the worst case seen. */
function simulate(path: Path, rig: FollowRig) {
  const p = path.at(0);
  const v = new THREE.Vector3();
  const prev = rig.camera.position.clone();
  let worstNdc = 0;
  let worstStep = 0;
  let behind = 0;
  const ndc = new THREE.Vector3();
  for (let f = 1; f <= Math.ceil(path.duration * FPS); f++) {
    const next = path.at(f * DT);
    const raw = next.clone().sub(p).divideScalar(DT);
    v.lerp(raw, 0.3);
    p.copy(next);
    followStep(rig, p, v, DT);
    rig.camera.lookAt(rig.target);
    rig.camera.updateMatrixWorld();
    ndc.copy(p).project(rig.camera);
    worstNdc = Math.max(worstNdc, Math.abs(ndc.x), Math.abs(ndc.y));
    if (ndc.z >= 1) behind++;
    worstStep = Math.max(worstStep, rig.camera.position.distanceTo(prev));
    prev.copy(rig.camera.position);
  }
  return { worstNdc, worstStep, behind };
}

const registersAnchor = anchorFor('registers');

describe('follow camera keeps the traveller in frame (SC-003)', () => {
  for (const aspect of [16 / 9, 4 / 3, 1]) {
    describe(`aspect ${aspect.toFixed(2)}`, () => {
      it('RAM → registers lift ride', () => {
        const r = simulate(liftPath(4, 10, anchorFor('ram'), registersAnchor), makeRig(aspect));
        expect(r.worstNdc).toBeLessThanOrEqual(0.85);
        expect(r.behind).toBe(0);
        expect(r.worstStep).toBeLessThan(0.7);
      });

      it('L1 data → registers lift hop', () => {
        const r = simulate(liftPath(9, 10, anchorFor('l1d'), registersAnchor), makeRig(aspect, SHOTS['floor9-shelves']));
        expect(r.worstNdc).toBeLessThanOrEqual(0.85);
        expect(r.behind).toBe(0);
      });

      it('registers → RAM store (downward ride)', () => {
        const r = simulate(liftPath(10, 4, registersAnchor, anchorFor('ram')), makeRig(aspect, SHOTS['floor10-desk']));
        expect(r.worstNdc).toBeLessThanOrEqual(0.85);
        expect(r.behind).toBe(0);
      });

      it('courier van, fast-forwarded round trip', () => {
        const r = simulate(courierPath(TIMING.courierTripFast), makeRig(aspect, SHOTS.street));
        expect(r.worstNdc).toBeLessThanOrEqual(0.85);
        expect(r.behind).toBe(0);
        expect(r.worstStep).toBeLessThan(0.8);
      });

      it('courier van, full-length round trip', () => {
        const r = simulate(courierPath(TIMING.courierTrip), makeRig(aspect, SHOTS.warehouse));
        expect(r.worstNdc).toBeLessThanOrEqual(0.85);
        expect(r.behind).toBe(0);
      });
    });
  }

  it('does not jump when the subject stops (settles instead of snapping)', () => {
    const rig = makeRig(16 / 9);
    const p = anchorFor('ram').clone();
    const v = new THREE.Vector3(0, 6, 0);
    for (let i = 0; i < 60; i++) {
      p.add(v.clone().multiplyScalar(DT));
      followStep(rig, p, v, DT);
    }
    const before = rig.camera.position.clone();
    followStep(rig, p, new THREE.Vector3(), DT);
    expect(rig.camera.position.distanceTo(before)).toBeLessThan(0.5);
  });

  it('keeps the camera on the open side of the tower', () => {
    const rig = makeRig(16 / 9);
    rig.camera.position.set(-20, 14, -10); // user had orbited round the back
    rig.target.set(0, 14, 0);
    const p = new THREE.Vector3(0, 14, 0);
    for (let i = 0; i < 240; i++) followStep(rig, p, new THREE.Vector3(), DT);
    expect(rig.camera.position.z).toBeGreaterThan(0);
  });
});
