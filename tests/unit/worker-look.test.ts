import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyDrag, clampLook, DEFAULT_LOOK, lookDirection, LOOK_LIMITS } from '../../src/scene/camera/workerLook';
import { LIFT_X, anchorFor } from '../../src/scene/Building';

describe('clampLook', () => {
  it('leaves a look inside the limits alone', () => {
    expect(clampLook({ yaw: 0.2, pitch: -0.1 })).toEqual({ yaw: 0.2, pitch: -0.1 });
  });

  it('clamps each axis to its limit', () => {
    expect(clampLook({ yaw: 9, pitch: 9 })).toEqual({ yaw: LOOK_LIMITS.yawMax, pitch: LOOK_LIMITS.pitchMax });
    expect(clampLook({ yaw: -9, pitch: -9 })).toEqual({ yaw: LOOK_LIMITS.yawMin, pitch: LOOK_LIMITS.pitchMin });
  });

  it('never returns NaN, even for NaN or infinite input', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const l = clampLook({ yaw: bad, pitch: bad });
      expect(Number.isFinite(l.yaw)).toBe(true);
      expect(Number.isFinite(l.pitch)).toBe(true);
    }
  });

  it('the default gaze is inside the limits', () => {
    expect(clampLook(DEFAULT_LOOK)).toEqual(DEFAULT_LOOK);
  });
});

describe('applyDrag', () => {
  it('drag right turns the view left (grab-the-world)', () => {
    expect(applyDrag({ yaw: 0, pitch: 0 }, 100, 0).yaw).toBeLessThan(0);
  });

  it('drag down looks up, drag up looks down', () => {
    expect(applyDrag({ yaw: 0, pitch: 0 }, 0, 50).pitch).toBeGreaterThan(0);
    expect(applyDrag({ yaw: 0, pitch: 0 }, 0, -50).pitch).toBeLessThan(0);
  });

  it('accumulates over several drags and respects sensitivity', () => {
    let l = { yaw: 0, pitch: 0 };
    l = applyDrag(l, -50, 0, 0.01);
    l = applyDrag(l, -50, 0, 0.01);
    expect(l.yaw).toBeCloseTo(1.0);
  });

  it('stops at the limits however far the pointer travels', () => {
    const far = applyDrag({ yaw: 0, pitch: 0 }, -1e6, -1e6);
    expect(far.yaw).toBe(LOOK_LIMITS.yawMax);
    expect(far.pitch).toBe(LOOK_LIMITS.pitchMin);
    const farOther = applyDrag({ yaw: 0, pitch: 0 }, 1e6, 1e6);
    expect(farOther.yaw).toBe(LOOK_LIMITS.yawMin);
    expect(farOther.pitch).toBe(LOOK_LIMITS.pitchMax);
  });

  it('ignores NaN deltas', () => {
    expect(applyDrag({ yaw: 0.3, pitch: 0.1 }, NaN, NaN)).toEqual({ yaw: 0.3, pitch: 0.1 });
  });
});

describe('lookDirection', () => {
  it('straight ahead faces +z (the open front)', () => {
    const d = lookDirection({ yaw: 0, pitch: 0 });
    expect(d.z).toBeCloseTo(1);
    expect(d.x).toBeCloseTo(0);
  });

  it('is always a unit vector', () => {
    for (const yaw of [-1, 0, 0.7, 1.7]) {
      for (const pitch of [-0.6, 0, 0.4]) expect(lookDirection({ yaw, pitch }).length()).toBeCloseTo(1);
    }
  });

  it('positive yaw turns toward the lift (-x), and the limit can see it', () => {
    expect(lookDirection({ yaw: 0.5, pitch: 0 }).x).toBeLessThan(0);
    // Eye roughly at the Worker's head; the lift shaft is at LIFT_X, the desk anchor in front.
    const eye = new THREE.Vector3(3.2, anchorFor('worker').y + 1, -0.95);
    const toLift = new THREE.Vector3(LIFT_X - eye.x, 0, 0 - eye.z).normalize();
    const atMax = lookDirection({ yaw: LOOK_LIMITS.yawMax, pitch: 0 });
    const angle = Math.acos(THREE.MathUtils.clamp(atMax.dot(toLift), -1, 1));
    // At the right-hand limit the lift is within the ~41° half field of view of the default camera.
    expect(angle).toBeLessThan((41 * Math.PI) / 180);
  });

  it('the limits never turn the view toward the closed back wall', () => {
    const left = lookDirection({ yaw: LOOK_LIMITS.yawMin, pitch: 0 });
    const right = lookDirection({ yaw: LOOK_LIMITS.yawMax, pitch: 0 });
    // The seated Worker sits near the back wall facing the front: no extreme yaw may point back (-z) hard.
    expect(left.z).toBeGreaterThan(0);
    expect(right.z).toBeGreaterThan(-0.2);
  });
});
