import * as THREE from 'three';
import gsap from 'gsap';
import { TIMING } from '../timing';
import { reducedMotion } from '../motion';
import type { QualityTier } from '../view/viewState';

const HIT = 0x2affb0;
const MISS = 0xff4060;

const STROKE = new THREE.BoxGeometry(1, 0.15, 0.05);
const RING = new THREE.RingGeometry(0.52, 0.64, 48);

/** A tick: short stroke down-left, long stroke up-right. Round things mean "found it". */
function checkGlyph(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const short = new THREE.Mesh(STROKE, mat);
  short.scale.x = 0.38;
  short.rotation.z = -Math.PI / 4;
  short.position.set(-0.2, -0.08, 0);
  const long = new THREE.Mesh(STROKE, mat);
  long.scale.x = 0.78;
  long.rotation.z = Math.PI / 4;
  long.position.set(0.13, 0.06, 0);
  g.add(short, long);
  return g;
}

/** A cross: two diagonal strokes. Sharp things mean "not here". */
function crossGlyph(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  for (const r of [Math.PI / 4, -Math.PI / 4]) {
    const s = new THREE.Mesh(STROKE, mat);
    s.scale.x = 0.9;
    s.rotation.z = r;
    g.add(s);
  }
  return g;
}

/**
 * Cache hit / miss feedback that differs in SHAPE and MOTION, not only colour:
 *  hit  — an expanding ring and a tick that pops in
 *  miss — a cross and a brief sideways shudder of the room
 * Reduced motion: no ring, no shudder, no overshoot — the glyph simply appears and fades (never strobes).
 * Quality `low` drops the ring too.
 */
export class Feedback {
  private tier: QualityTier = 'high';

  constructor(private parent: THREE.Object3D) {}

  setTier(tier: QualityTier): void {
    this.tier = tier;
  }

  /** `at` is where the glyph floats (world space); `shake` is the object that shudders on a miss. */
  play(kind: 'hit' | 'miss', at: THREE.Vector3, shake?: THREE.Object3D): gsap.core.Timeline {
    const tl = gsap.timeline();
    const reduced = reducedMotion();
    const dur = Math.min(kind === 'hit' ? TIMING.hitBurst : TIMING.missShudder, TIMING.beat);
    const color = kind === 'hit' ? HIT : MISS;

    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      depthTest: false, // always readable, even over shelves
      toneMapped: false,
    });
    const root = new THREE.Group();
    root.position.copy(at);
    root.renderOrder = 20;
    const glyph = kind === 'hit' ? checkGlyph(mat) : crossGlyph(mat);
    glyph.traverse((o) => (o.renderOrder = 20));
    glyph.scale.setScalar(reduced ? 1 : 0.01);
    root.add(glyph);

    let ring: THREE.Mesh | null = null;
    if (kind === 'hit' && !reduced && this.tier !== 'low') {
      ring = new THREE.Mesh(RING, mat);
      ring.renderOrder = 20;
      ring.scale.setScalar(0.4);
      root.add(ring);
    }

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      root.removeFromParent();
      mat.dispose();
    };

    tl.call(() => this.parent.add(root), undefined, 0);
    if (!reduced) tl.to(glyph.scale, { x: 1, y: 1, z: 1, duration: 0.22, ease: 'back.out(2.6)' }, 0);
    if (ring) tl.to(ring.scale, { x: 2.4, y: 2.4, z: 2.4, duration: dur, ease: 'power2.out' }, 0);
    if (kind === 'miss' && shake && !reduced) {
      // Even number of passes so the room ends exactly where it began.
      tl.to(shake.position, { x: '+=0.12', duration: 0.05, repeat: 7, yoyo: true, ease: 'none' }, 0);
    }
    tl.to(mat, { opacity: 0, duration: 0.25, ease: 'power1.in' }, Math.max(dur - 0.25, 0));
    tl.call(cleanup, undefined, dur);
    tl.eventCallback('onInterrupt', cleanup);
    return tl;
  }
}
