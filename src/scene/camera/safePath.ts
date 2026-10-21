import * as THREE from 'three';

/** Axis-aligned footprint of the tower in the ground plane, plus its roof height. */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
}

/** Does the open segment a→b cross the INTERIOR of the rectangle? (Liang–Barsky in the xz plane.) */
function segmentHitsRect(ax: number, az: number, bx: number, bz: number, r: Rect): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0; // parallel: inside only if on the inner side
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  const eps = 1e-9;
  const hit =
    clip(-dx, ax - r.minX - eps) &&
    clip(dx, r.maxX - ax - eps) &&
    clip(-dz, az - r.minZ - eps) &&
    clip(dz, r.maxZ - az - eps);
  return hit && t1 - t0 > 1e-6;
}

function inside(x: number, z: number, r: Rect): boolean {
  return x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
}

function dist2d(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * Waypoints from `from` to `to` that never cut through the tower. If the straight line is clear
 * (or both ends are above the roof) it is returned as is; otherwise the camera swings round the
 * corners of the tower footprint expanded by `margin`, taking the shorter way.
 */
export function safePath(from: THREE.Vector3, to: THREE.Vector3, tower: Rect, margin: number): THREE.Vector3[] {
  const R: Rect = {
    minX: tower.minX - margin,
    maxX: tower.maxX + margin,
    minZ: tower.minZ - margin,
    maxZ: tower.maxZ + margin,
    topY: tower.topY + margin,
  };
  const direct = [from.clone(), to.clone()];
  if (Math.min(from.y, to.y) > R.topY) return direct;
  if (inside(from.x, from.z, R) || inside(to.x, to.z, R)) return direct;
  if (!segmentHitsRect(from.x, from.z, to.x, to.z, R)) return direct;

  const corners: Array<[number, number]> = [
    [R.minX, R.minZ],
    [R.maxX, R.minZ],
    [R.maxX, R.maxZ],
    [R.minX, R.maxZ],
  ];
  const a: [number, number] = [from.x, from.z];
  const b: [number, number] = [to.x, to.z];
  const clear = (p: [number, number], q: [number, number]) => !segmentHitsRect(p[0], p[1], q[0], q[1], R);

  let best: Array<[number, number]> | null = null;
  let bestLen = Infinity;
  const consider = (via: Array<[number, number]>) => {
    const pts = [a, ...via, b];
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      if (!clear(pts[i], pts[i + 1])) return;
      len += dist2d(pts[i], pts[i + 1]);
    }
    if (len < bestLen) {
      bestLen = len;
      best = via;
    }
  };
  for (let i = 0; i < 4; i++) {
    consider([corners[i]]);
    consider([corners[i], corners[(i + 1) % 4]]);
    consider([corners[i], corners[(i + 3) % 4]]);
  }
  if (!best) return direct;

  const xz = [a, ...(best as Array<[number, number]>), b];
  const cum = [0];
  for (let i = 1; i < xz.length; i++) cum.push(cum[i - 1] + dist2d(xz[i - 1], xz[i]));
  const total = cum[cum.length - 1] || 1;
  return xz.map(([x, z], i) => new THREE.Vector3(x, from.y + (to.y - from.y) * (cum[i] / total), z));
}

/** A smooth curve through the waypoints (a straight line for two points). */
export function makeCurve(points: THREE.Vector3[]): THREE.Curve<THREE.Vector3> {
  if (points.length === 2) return new THREE.LineCurve3(points[0], points[1]);
  return new THREE.CatmullRomCurve3(points, false, 'centripetal');
}
