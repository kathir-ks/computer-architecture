import { describe, expect, it } from 'vitest';
import { VANTAGES } from '../../src/scene/index';
import { VIEW_ARC } from '../../src/scene/World';

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
