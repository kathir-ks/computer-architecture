import * as THREE from 'three';
import { TIMING } from '../timing';

export interface FollowConfig {
  /** Base closing rate (1/s). Fast subjects raise it so the camera keeps up. */
  rate: number;
  /** Seconds of look-ahead along the subject's velocity. */
  lead: number;
  minDist: number;
  maxDist: number;
  /** The subject must project inside NDC ±margin; the camera is pulled onto it if not. */
  margin: number;
}

export const DEFAULT_FOLLOW: FollowConfig = {
  rate: TIMING.followRate,
  lead: 0.45,
  minDist: 10,
  maxDist: 24,
  margin: 0.78,
};

export interface FollowRig {
  camera: THREE.PerspectiveCamera;
  /** The orbit target the camera looks at. */
  target: THREE.Vector3;
}

/** Preferred viewing direction: in front of the open face, slightly right and above. */
const FRONT = new THREE.Vector3(0.28, 0.22, 1).normalize();
const MAX_LEAD = 2.5;
/** Speeds above this are short bursts (slides in and out of the shaft); the hard in-frame guarantee handles them. */
const MAX_RATE_SPEED = 8;

const _off = new THREE.Vector3();
const _lead = new THREE.Vector3();
const _want = new THREE.Vector3();
const _wantCam = new THREE.Vector3();
const _ndc = new THREE.Vector3();

/**
 * Advance a follow camera one frame towards framing `p` (the subject's world position, moving at `v`).
 * Smooth first; then a hard guarantee that `p` is inside the frame, so a fast van or a lift ride can
 * never outrun the camera.
 */
export function followStep(
  rig: FollowRig,
  p: THREE.Vector3,
  v: THREE.Vector3,
  dt: number,
  cfg: FollowConfig = DEFAULT_FOLLOW,
): void {
  const speed = Math.min(v.length(), MAX_RATE_SPEED);
  _lead.copy(v).multiplyScalar(cfg.lead);
  if (_lead.length() > MAX_LEAD) _lead.setLength(MAX_LEAD);
  _want.copy(p).add(_lead);

  // Keep the current viewing direction, but never drift round to the closed back of the tower.
  _off.copy(rig.camera.position).sub(rig.target);
  const dist = THREE.MathUtils.clamp(_off.length() || cfg.minDist, cfg.minDist + speed * 0.5, cfg.maxDist + speed);
  _off.normalize();
  if (_off.z < 0.45) _off.lerp(FRONT, Math.min(1, dt * 8)).normalize();
  _wantCam.copy(_want).addScaledVector(_off, dist);

  const k = 1 - Math.exp(-(cfg.rate + speed * 0.35) * dt);
  rig.target.lerp(_want, k);
  rig.camera.position.lerp(_wantCam, k);

  // Hard in-frame guarantee.
  for (let i = 0; i < 4; i++) {
    rig.camera.lookAt(rig.target);
    rig.camera.updateMatrixWorld();
    _ndc.copy(p).project(rig.camera);
    if (Math.abs(_ndc.x) <= cfg.margin && Math.abs(_ndc.y) <= cfg.margin && _ndc.z < 1) break;
    rig.target.lerp(p, 0.55);
  }
}
