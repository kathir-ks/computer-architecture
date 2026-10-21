import * as THREE from 'three';

/** Head orientation of the seated Worker. Yaw 0 = straight ahead; positive yaw turns toward the lift (the Worker's right). */
export interface Look {
  yaw: number;
  pitch: number;
}

const DEG = Math.PI / 180;

/**
 * Comfortable head-turn range. The lift shaft sits ~84° round to the right of straight ahead, so the right
 * limit reaches it; the left limit is shorter because nothing of interest is on that side. The range never
 * reaches the open front or the back wall, so inside-out geometry cannot appear.
 */
export const LOOK_LIMITS = {
  yawMin: -65 * DEG,
  yawMax: 100 * DEG,
  pitchMin: -35 * DEG,
  pitchMax: 25 * DEG,
} as const;

/** Where the gaze rests on entry: the desk, with the lift just coming into view on the right. */
export const DEFAULT_LOOK: Look = { yaw: 28 * DEG, pitch: -14 * DEG };

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

export function clampLook(look: Look): Look {
  return {
    yaw: THREE.MathUtils.clamp(finite(look.yaw), LOOK_LIMITS.yawMin, LOOK_LIMITS.yawMax),
    pitch: THREE.MathUtils.clamp(finite(look.pitch), LOOK_LIMITS.pitchMin, LOOK_LIMITS.pitchMax),
  };
}

/**
 * Pointer drag → new look. Dragging grabs the world: drag right and the view turns left.
 * `dx`/`dy` are pixel deltas; `sensitivity` is radians per pixel.
 */
export function applyDrag(look: Look, dx: number, dy: number, sensitivity = 0.0045): Look {
  return clampLook({
    yaw: look.yaw - finite(dx) * sensitivity,
    pitch: look.pitch + finite(dy) * sensitivity,
  });
}

/** Unit view direction for a look. Straight ahead is +z (the Worker faces the open front). */
export function lookDirection(look: Look, out = new THREE.Vector3()): THREE.Vector3 {
  const cp = Math.cos(look.pitch);
  return out.set(-Math.sin(look.yaw) * cp, Math.sin(look.pitch), Math.cos(look.yaw) * cp);
}
