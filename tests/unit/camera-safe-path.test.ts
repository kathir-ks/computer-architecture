import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeCurve, safePath, type Rect } from '../../src/scene/camera/safePath';
import { SHOTS, type VantageId } from '../../src/scene/camera/shots';
import { BLD_D, BLD_W, FLOORS, FLOOR_H } from '../../src/scene/Building';

const TOWER: Rect = {
  minX: -BLD_W / 2,
  maxX: BLD_W / 2,
  minZ: -BLD_D / 2,
  maxZ: BLD_D / 2,
  topY: FLOORS * FLOOR_H,
};
const MARGIN = 2.5;

function insideTower(p: THREE.Vector3): boolean {
  return p.y < TOWER.topY && p.x > TOWER.minX && p.x < TOWER.maxX && p.z > TOWER.minZ && p.z < TOWER.maxZ;
}

function samples(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const curve = makeCurve(safePath(from, to, TOWER, MARGIN));
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= 200; i++) out.push(curve.getPointAt(i / 200));
  return out;
}

const vantagePos = (id: VantageId) => new THREE.Vector3(...SHOTS[id].pos);
const IDS = Object.keys(SHOTS) as VantageId[];

describe('safePath', () => {
  it('every named vantage sits outside the tower', () => {
    for (const id of IDS) expect(insideTower(vantagePos(id)), id).toBe(false);
  });

  it('paths between every pair of vantages never enter the tower', () => {
    for (const a of IDS) {
      for (const b of IDS) {
        for (const p of samples(vantagePos(a), vantagePos(b))) {
          expect(insideTower(p), `${a}→${b} at ${p.toArray()}`).toBe(false);
        }
      }
    }
  });

  it('swings round the tower from positions behind it (user has orbited round the back)', () => {
    const behind = [
      new THREE.Vector3(0, 15, -30),
      new THREE.Vector3(-22, 10, -12),
      new THREE.Vector3(25, 20, -8),
      new THREE.Vector3(30, 5, 0),
    ];
    for (const from of behind) {
      for (const id of IDS) {
        for (const p of samples(from, vantagePos(id))) {
          expect(insideTower(p), `${from.toArray()}→${id} at ${p.toArray()}`).toBe(false);
        }
      }
    }
  });

  it('a clear straight line stays a straight line', () => {
    const pts = safePath(vantagePos('street'), vantagePos('building-front'), TOWER, MARGIN);
    expect(pts).toHaveLength(2);
  });

  it('a blocked line gains waypoints', () => {
    const pts = safePath(new THREE.Vector3(0, 15, -30), vantagePos('floor10-desk'), TOWER, MARGIN);
    expect(pts.length).toBeGreaterThan(2);
  });

  it('paths start and end exactly at the requested positions', () => {
    const from = new THREE.Vector3(0, 15, -30);
    const to = vantagePos('street');
    const pts = safePath(from, to, TOWER, MARGIN);
    expect(pts[0].distanceTo(from)).toBe(0);
    expect(pts[pts.length - 1].distanceTo(to)).toBe(0);
  });

  it('passes over the roof when both ends are above it', () => {
    const pts = safePath(new THREE.Vector3(-20, 50, -20), new THREE.Vector3(20, 50, 20), TOWER, MARGIN);
    expect(pts).toHaveLength(2);
  });
});
