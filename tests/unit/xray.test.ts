import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import gsap from 'gsap';
import { Xray, XRAY_FADED_OPACITY, type LabelLike } from '../../src/scene/effects/Xray';
import { setMotionProvider } from '../../src/scene/motion';
import { TIMING } from '../../src/scene/timing';

afterEach(() => setMotionProvider(null));

const wall = () => new THREE.MeshStandardMaterial({ color: 0x5f6d94 });
const outline = () => new THREE.LineBasicMaterial({ color: 0x00e5ff });
const label = (): LabelLike => ({ visible: true, element: document.createElement('div') });

describe('Xray — the registry', () => {
  it('leaves decoration exactly as built until X-ray is switched on', () => {
    const x = new Xray();
    const w = wall();
    x.fade(w);
    expect(w.opacity).toBe(1);
    expect(w.transparent).toBe(false);
    expect(w.depthWrite).toBe(true);
  });

  it('fades decoration to the X-ray opacity, and stops it hiding what is behind it', () => {
    const x = new Xray();
    const w = wall();
    x.fade(w);
    x.set(true, { instant: true });
    expect(w.opacity).toBeCloseTo(XRAY_FADED_OPACITY);
    expect(w.transparent).toBe(true);
    expect(w.depthWrite).toBe(false);
  });

  it('comes back exactly as it was — no residual transparency', () => {
    const x = new Xray();
    const w = wall();
    x.fade(w);
    x.set(true, { instant: true });
    x.set(false, { instant: true });
    expect(w.opacity).toBe(1);
    expect(w.transparent).toBe(false);
    expect(w.depthWrite).toBe(true);
  });

  it('never makes something more opaque than it already was', () => {
    const x = new Xray();
    const ghost = wall();
    ghost.transparent = true;
    ghost.opacity = 0.05;
    x.fade(ghost);
    x.set(true, { instant: true });
    expect(ghost.opacity).toBeCloseTo(0.05);
    x.set(false, { instant: true });
    expect(ghost.opacity).toBe(0.05);
    expect(ghost.transparent).toBe(true); // it was transparent to begin with
  });

  it('shows blueprint outlines and floor labels only while X-ray is on', () => {
    const x = new Xray();
    const line = outline();
    const tag = label();
    x.reveal(line, 0.5);
    x.label(tag);

    expect(line.visible).toBe(false);
    expect(tag.visible).toBe(false);

    x.set(true, { instant: true });
    expect(line.visible).toBe(true);
    expect(line.opacity).toBeCloseTo(0.5);
    expect(tag.visible).toBe(true);
    expect(tag.element.style.opacity).toBe('1');

    x.set(false, { instant: true });
    expect(line.visible).toBe(false);
    expect(tag.visible).toBe(false);
  });

  it('reports whether it is on', () => {
    const x = new Xray();
    expect(x.active).toBe(false);
    x.set(true, { instant: true });
    expect(x.active).toBe(true);
    expect(x.progress).toBe(1);
  });
});

describe('Xray — fading', () => {
  it('moves through the in-between values and lands exactly on the target', () => {
    const x = new Xray();
    const w = wall();
    x.fade(w);
    x.set(true);

    const tween = gsap.getTweensOf(x['amount'])[0];
    expect(tween).toBeTruthy();
    tween.pause();
    tween.progress(0.5);
    expect(w.opacity).toBeGreaterThan(XRAY_FADED_OPACITY);
    expect(w.opacity).toBeLessThan(1);
    expect(w.transparent).toBe(true);

    tween.progress(1);
    expect(w.opacity).toBeCloseTo(XRAY_FADED_OPACITY);
  });

  it('reversing mid-fade continues from where it got to instead of jumping', () => {
    const x = new Xray();
    const w = wall();
    x.fade(w);
    x.set(true);
    const first = gsap.getTweensOf(x['amount'])[0];
    first.pause();
    first.progress(0.5);
    const midOpacity = w.opacity;
    const midProgress = x.progress;

    x.set(false);
    expect(x.progress).toBe(midProgress); // no jump on reversal
    expect(w.opacity).toBe(midOpacity);

    const back = gsap.getTweensOf(x['amount'])[0];
    back.pause();
    back.progress(1);
    expect(w.opacity).toBe(1);
    expect(w.transparent).toBe(false);
  });

  it('setting the same state twice does not restart anything', () => {
    const x = new Xray();
    x.set(true, { instant: true });
    const before = x.progress;
    x.set(true);
    expect(x.progress).toBe(before);
    expect(gsap.getTweensOf(x['amount'])).toHaveLength(0);
  });

  it('asking for the state it is already heading to leaves the running fade alone', () => {
    const x = new Xray();
    x.fade(wall());
    x.set(true);
    const running = gsap.getTweensOf(x['amount'])[0];
    running.pause();
    running.progress(0.4);
    const at = x.progress;

    x.set(true); // e.g. the learner changed quality mid-fade
    expect(gsap.getTweensOf(x['amount'])[0]).toBe(running);
    expect(x.progress).toBe(at);
    running.progress(1);
  });

  it('is quicker under reduced motion', () => {
    setMotionProvider(() => true);
    const x = new Xray();
    x.fade(wall());
    x.set(true);
    const tween = gsap.getTweensOf(x['amount'])[0];
    expect(tween.duration()).toBeLessThan(TIMING.xrayFade);
    tween.progress(1);
  });

  it('touches nothing but its own value: a story timeline keeps its place', () => {
    const story = gsap.timeline({ paused: true });
    const marker = { v: 0 };
    story.to(marker, { v: 10, duration: 4, ease: 'none' });
    story.time(1);
    expect(marker.v).toBeCloseTo(2.5);

    const x = new Xray();
    x.fade(wall());
    x.set(true);
    x.set(false);
    x.set(true, { instant: true });

    expect(story.time()).toBe(1);
    expect(story.paused()).toBe(true);
    expect(marker.v).toBeCloseTo(2.5);
    story.kill();
  });
});
