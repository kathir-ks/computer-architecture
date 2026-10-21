import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Feedback } from '../../src/scene/effects/Feedback';
import { setMotionProvider } from '../../src/scene/motion';
import { TIMING } from '../../src/scene/timing';

afterEach(() => setMotionProvider(null));

function setup() {
  const parent = new THREE.Group();
  const room = new THREE.Group();
  const fb = new Feedback(parent);
  return { parent, room, fb, at: new THREE.Vector3(1, 2, 3) };
}

/** Child parts of the glyph root currently in the scene: tick/cross strokes (+ the ring when present). */
const partsOf = (parent: THREE.Object3D) => parent.children.map((root) => root.children.length);

describe('hit / miss feedback', () => {
  it('never outlasts a flash beat, so chapter sequencing is unchanged', () => {
    const { fb, at, room } = setup();
    expect(fb.play('hit', at).duration()).toBeLessThanOrEqual(TIMING.beat);
    expect(fb.play('miss', at, room).duration()).toBeLessThanOrEqual(TIMING.beat);
  });

  it('adds its glyph when played and removes everything when finished', () => {
    const { fb, parent, at } = setup();
    const tl = fb.play('hit', at);
    tl.pause();
    tl.time(0.1);
    expect(parent.children).toHaveLength(1);
    tl.progress(1);
    expect(parent.children).toHaveLength(0);
  });

  it('cleans up when killed mid-way (chapter jump)', () => {
    const { fb, parent, at } = setup();
    const tl = fb.play('miss', at);
    tl.pause();
    tl.time(0.1);
    expect(parent.children).toHaveLength(1);
    tl.kill();
    expect(parent.children).toHaveLength(0);
  });

  it('a hit is a tick inside a ring; a miss is a cross — different shapes, not just colours', () => {
    const { fb, parent, at } = setup();
    const hit = fb.play('hit', at);
    hit.pause();
    hit.time(0.1);
    const hitParts = partsOf(parent)[0];
    hit.progress(1);

    const miss = fb.play('miss', at);
    miss.pause();
    miss.time(0.1);
    const missParts = partsOf(parent)[0];
    miss.progress(1);

    // hit root holds the tick group and a ring; miss root holds only the cross group
    expect(hitParts).toBe(2);
    expect(missParts).toBe(1);
  });

  it('a miss shudders the room sideways and puts it back exactly', () => {
    const { fb, at, room } = setup();
    const tl = fb.play('miss', at, room);
    tl.pause();
    tl.time(0.075);
    expect(Math.abs(room.position.x)).toBeGreaterThan(0);
    tl.progress(1);
    expect(room.position.x).toBe(0);
  });

  it('a hit never moves the room', () => {
    const { fb, at, room } = setup();
    const tl = fb.play('hit', at, room);
    tl.pause();
    tl.time(0.075);
    expect(room.position.x).toBe(0);
  });

  it('low quality drops the ring but keeps the tick', () => {
    const { fb, parent, at } = setup();
    fb.setTier('low');
    const tl = fb.play('hit', at);
    tl.pause();
    tl.time(0.1);
    expect(partsOf(parent)[0]).toBe(1);
    tl.progress(1);
  });

  it('reduced motion: no ring, no shudder, no pop-in — the glyph just appears and fades', () => {
    setMotionProvider(() => true);
    const { fb, parent, at, room } = setup();

    const hit = fb.play('hit', at);
    hit.pause();
    hit.time(0.05);
    expect(partsOf(parent)[0]).toBe(1);
    const glyph = parent.children[0].children[0];
    expect(glyph.scale.x).toBe(1); // already full size, no overshoot
    hit.progress(1);

    const miss = fb.play('miss', at, room);
    miss.pause();
    miss.time(0.075);
    expect(room.position.x).toBe(0);
    miss.progress(1);
  });
});
