import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Environment } from '../../src/scene/Environment';

/**
 * Environment must stay inert set dressing (FR-013 / data-model
 * EnvironmentSet): one frame callback, zero interactivity, bounded prop
 * counts, and every prop clear of the road corridor the courier drives.
 */
describe('Environment bookkeeping', () => {
  function build() {
    const scene = new THREE.Scene();
    const callbacks: Array<(dt: number) => void> = [];
    const env = new Environment(scene, (cb) => callbacks.push(cb));
    return { scene, callbacks, env };
  }

  it('registers exactly one frame callback and no click surface', () => {
    const { callbacks, env } = build();
    expect(callbacks).toHaveLength(1);
    // No clickable API at all — the raycaster can never see these props.
    expect((env as unknown as Record<string, unknown>).clickTargets).toBeUndefined();
  });

  it('adds its group to the scene with prop counts in the data-model ranges', () => {
    const { scene, env } = build();
    expect(scene.children).toContain(env.group);
    expect(env.counts.buildings).toBeGreaterThanOrEqual(5);
    expect(env.counts.buildings).toBeLessThanOrEqual(7);
    expect(env.counts.trees).toBeGreaterThanOrEqual(8);
    expect(env.counts.trees).toBeLessThanOrEqual(12);
    expect(env.counts.streetlights).toBeGreaterThanOrEqual(4);
    expect(env.counts.streetlights).toBeLessThanOrEqual(6);
    expect(env.counts.clouds).toBeGreaterThanOrEqual(4);
    expect(env.counts.clouds).toBeLessThanOrEqual(6);
    // Merged geometry keeps added draw calls tiny: 5 static meshes + clouds.
    expect(env.group.children.length).toBeLessThanOrEqual(5 + env.counts.clouds);
  });

  it('drifts clouds on the frame callback without moving anything else', () => {
    const { callbacks, env } = build();
    const before = env.group.children.map((c) => c.position.x);
    callbacks[0](1); // one second
    const after = env.group.children.map((c) => c.position.x);
    const moved = after.filter((x, i) => x !== before[i]);
    expect(moved).toHaveLength(env.counts.clouds);
  });

  it('wraps clouds instead of drifting them to infinity', () => {
    const { callbacks, env } = build();
    for (let i = 0; i < 600; i++) callbacks[0](1); // 10 minutes of drift
    for (const c of env.group.children) {
      expect(Math.abs(c.position.x)).toBeLessThanOrEqual(75);
    }
  });
});
