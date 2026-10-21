import * as THREE from 'three';
import gsap from 'gsap';
import { floorBaseY } from './Building';
import { TIMING } from './timing';
import type { Materials } from './materials';
import { reducedMotion } from './motion';

export type WorkKind = 'compute' | 'read-card' | 'idle' | 'foot-tap';
export type RegisterName = 'r1' | 'r2';

interface Arm {
  shoulder: THREE.Group;
  elbow: THREE.Group;
}

/** Rest pose: hands on the desk. Rotations about x (negative = swing forward, +z). */
const SHOULDER_REST = -0.7;
const ELBOW_REST = -0.5;

/**
 * The Worker: an articulated character seated at a desk on floor 10, with register drawers,
 * a program-counter ticket dispenser and an instruction card. Four readable body states:
 * compute (typing), read-card (leans in), idle (breathing), foot-tap (impatient waiting).
 */
export class Worker {
  readonly group = new THREE.Group();
  private root = new THREE.Group();
  private torsoPivot = new THREE.Group();
  private headPivot = new THREE.Group();
  private head: THREE.Mesh;
  private torso: THREE.Mesh;
  private shirtMat: THREE.MeshStandardMaterial;
  private arms: { l: Arm; r: Arm };
  private footPivot = new THREE.Group();
  private drawers: Record<RegisterName, THREE.Mesh>;
  private ticket: THREE.Mesh;
  private card: THREE.Mesh;
  private cardHalves: [THREE.Mesh, THREE.Mesh];
  readonly clickTargets: THREE.Mesh[] = [];
  private firstPerson = false;

  constructor(scene: THREE.Scene, m: Materials) {
    const y = floorBaseY(10);

    // ---- desk ----
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 1.6), m.wood);
    desk.position.set(3.2, y + 1.0, 0);
    this.group.add(desk);
    this.clickTargets.push(desk);

    for (const lx of [-1.5, 1.5]) {
      for (const lz of [0.6, -0.6]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), m.darkMetal);
        leg.position.set(3.2 + lx, y + 0.5, lz);
        this.group.add(leg);
      }
    }

    // Keyboard, desk lamp and a warm light so the desk reads as the busiest spot.
    const keyboard = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.34), m.darkMetal);
    keyboard.position.set(3.2, y + 1.12, -0.35);
    this.group.add(keyboard);
    const keys = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.04), m.emitter(0x40e0ff, 1.2));
    keys.position.set(3.2, y + 1.15, -0.3);
    this.group.add(keys);

    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 16), m.darkMetal);
    lampBase.position.set(1.9, y + 1.12, -0.4);
    const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), m.metal);
    lampArm.position.set(1.9, y + 1.45, -0.4);
    const lampMat = m.emitter(0xffe3a0, 1.6);
    lampMat.side = THREE.DoubleSide;
    const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.2, 16, 1, true), lampMat);
    lampHead.position.set(2.0, y + 1.8, -0.4);
    lampHead.rotation.z = -0.5;
    this.group.add(lampBase, lampArm, lampHead);

    // In-tray on the lift side of the desk: where delivered cards and values land.
    const trayMat = m.tint(0x2affb0, 0.35);
    const trayBase = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.46), trayMat);
    trayBase.position.set(2.3, y + 1.13, 0.15);
    this.group.add(trayBase);
    for (const [tx, tz, sx, sz] of [
      [2.3, 0.38, 0.62, 0.04],
      [2.3, -0.08, 0.62, 0.04],
      [1.99, 0.15, 0.04, 0.46],
      [2.61, 0.15, 0.04, 0.46],
    ]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.1, sz), trayMat);
      rim.position.set(tx, y + 1.17, tz);
      this.group.add(rim);
    }
    const trayLabel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.06), m.emitter(0x2affb0, 1.6));
    trayLabel.position.set(2.3, y + 1.16, 0.3);
    this.group.add(trayLabel);

    const deskLight = new THREE.PointLight(0xffe0b0, 2.2, 9);
    deskLight.position.set(3.2, y + 2.7, 0.9);
    this.group.add(deskLight);

    // ---- register drawers (front of desk) ----
    const mkDrawer = (x: number) => {
      const mat = m.tint(0x2affb0, 0.25);
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.34, 0.5), mat);
      d.position.set(x, y + 0.78, 0.62);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.04), m.metal);
      handle.position.set(0, 0, 0.27);
      d.add(handle);
      this.group.add(d);
      this.clickTargets.push(d);
      return d;
    };
    this.drawers = { r1: mkDrawer(2.6), r2: mkDrawer(3.8) };

    // ---- character (behind the desk, facing +z) ----
    this.root.position.set(3.2, y, -1.1);
    this.group.add(this.root);

    const skin = new THREE.MeshStandardMaterial({ color: 0xffd6b3, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x35261c, roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2b3350, roughness: 0.8 });
    const ink = new THREE.MeshBasicMaterial({ color: 0x14161f });
    this.shirtMat = m.tint(0x5e8bff, 0.18);

    // chair
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.85), m.darkMetal);
    seat.position.set(0, 0.52, -0.05);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.9, 0.1), m.darkMetal);
    back.position.set(0, 1.0, -0.52);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), m.metal);
    post.position.set(0, 0.25, -0.05);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 5), m.metal);
    base.position.set(0, 0.03, -0.05);
    this.root.add(seat, back, post, base);

    // hips + legs
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.5), pants);
    pelvis.position.set(0, 0.72, 0);
    this.root.add(pelvis);
    for (const sx of [-0.2, 0.2]) {
      const hip = new THREE.Group();
      hip.position.set(sx, 0.72, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.6), pants);
      thigh.position.set(0, 0, 0.3);
      const knee = new THREE.Group();
      knee.position.set(0, 0, 0.6);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), pants);
      shin.position.set(0, -0.3, 0);
      const ankle = new THREE.Group();
      ankle.position.set(0, -0.6, 0);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.42), m.rubber);
      foot.position.set(0, -0.04, 0.1);
      ankle.add(foot);
      knee.add(shin, ankle);
      hip.add(thigh, knee);
      this.root.add(hip);
      if (sx > 0) this.footPivot = ankle;
    }

    // torso (pivot at the hips so the whole upper body can lean)
    this.torsoPivot.position.set(0, 0.8, 0);
    this.root.add(this.torsoPivot);
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.9, 0.46), this.shirtMat);
    this.torso.position.set(0, 0.45, 0);
    this.torsoPivot.add(this.torso);
    this.clickTargets.push(this.torso);

    // head (pivot at the neck)
    this.headPivot.position.set(0, 0.95, 0);
    this.torsoPivot.add(this.headPivot);
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 16), skin);
    this.head.position.set(0, 0.3, 0);
    this.headPivot.add(this.head);
    this.clickTargets.push(this.head);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.335, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.set(0, 0.33, -0.02);
    hair.rotation.x = -0.25;
    this.headPivot.add(hair);

    const eyeGeo = new THREE.SphereGeometry(0.045, 10, 10);
    for (const ex of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(eyeGeo, ink);
      eye.position.set(ex, 0.34, 0.275);
      this.headPivot.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.03), hairMat);
      brow.position.set(ex, 0.42, 0.28);
      this.headPivot.add(brow);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), skin);
    nose.position.set(0, 0.29, 0.31);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 0.02), ink);
    mouth.position.set(0, 0.19, 0.29);
    this.headPivot.add(nose, mouth);

    // arms
    const makeArm = (sx: number): Arm => {
      const shoulder = new THREE.Group();
      shoulder.position.set(sx, 0.8, 0);
      shoulder.rotation.x = SHOULDER_REST;
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), this.shirtMat);
      upper.position.set(0, -0.25, 0);
      const elbow = new THREE.Group();
      elbow.position.set(0, -0.5, 0);
      elbow.rotation.x = ELBOW_REST;
      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.46, 0.17), skin);
      fore.position.set(0, -0.23, 0);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), skin);
      hand.position.set(0, -0.5, 0);
      elbow.add(fore, hand);
      shoulder.add(upper, elbow);
      this.torsoPivot.add(shoulder);
      return { shoulder, elbow };
    };
    this.arms = { l: makeArm(-0.52), r: makeArm(0.52) };

    // ---- program-counter ticket dispenser ----
    const pcMat = m.tint(0xffd75e, 0.3);
    const dispenser = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.55), pcMat);
    dispenser.position.set(4.4, y + 1.42, 1.4);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.04), ink);
    slot.position.set(0, 0.2, 0.28);
    dispenser.add(slot);
    this.group.add(dispenser);
    this.clickTargets.push(dispenser);

    this.ticket = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.02, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 }),
    );
    this.ticket.position.set(4.4, y + 1.78, 1.4);
    this.ticket.visible = false;
    this.group.add(this.ticket);

    // ---- instruction card (appears during fetch/decode) ----
    const cardMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
    });
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), cardMat);
    this.card.position.set(3.2, y + 1.45, 0.2);
    this.card.rotation.x = -0.5;
    this.card.visible = false;
    this.group.add(this.card);

    const halfGeo = new THREE.PlaneGeometry(0.42, 0.6);
    const mkHalf = (c: number) => {
      const mesh = new THREE.Mesh(
        halfGeo,
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, side: THREE.DoubleSide }),
      );
      mesh.visible = false;
      this.group.add(mesh);
      return mesh;
    };
    this.cardHalves = [mkHalf(0xffd75e), mkHalf(0xff2ea6)];

    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    scene.add(this.group);
  }

  private drawerMats(): THREE.MeshStandardMaterial[] {
    return [this.drawers.r1.material, this.drawers.r2.material] as THREE.MeshStandardMaterial[];
  }

  /** First-person view hides the head (and the face and hair with it) so the camera never sits inside it. */
  setFirstPerson(on: boolean): void {
    this.firstPerson = on;
    this.headPivot.visible = !on;
  }

  get isFirstPerson(): boolean {
    return this.firstPerson;
  }

  /** World position of the Worker's eyes, just in front of where the head sits. */
  eyePosition(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(3.2, floorBaseY(10) + 2.08, -0.9);
  }

  setGlow(on: boolean): void {
    this.shirtMat.emissiveIntensity = on ? 0.9 : 0.18;
    for (const m of this.drawerMats()) m.emissiveIntensity = on ? 0.9 : 0.25;
  }

  // ---- verbs ----

  playWork(kind: WorkKind): gsap.core.Timeline {
    const tl = gsap.timeline();
    const { l, r } = this.arms;
    switch (kind) {
      case 'compute': {
        // Typing: hands alternate, head and shoulders bob (~1.1 s, same as v1).
        const beat = 0.09;
        const reps = 11;
        tl.to(r.shoulder.rotation, { x: SHOULDER_REST + 0.16, duration: beat, repeat: reps, yoyo: true }, 0);
        tl.to(l.shoulder.rotation, { x: SHOULDER_REST + 0.16, duration: beat, repeat: reps, yoyo: true }, beat);
        tl.to(this.headPivot.position, { y: '-=0.05', duration: beat * 2, repeat: reps / 2 - 0.5, yoyo: true }, 0);
        tl.to(this.torsoPivot.rotation, { x: 0.06, duration: 0.2, repeat: 5, yoyo: true }, 0);
        break;
      }
      case 'read-card':
        tl.to(this.card.position, { y: '+=0.45', z: '-=0.5', duration: TIMING.beat });
        tl.to(this.headPivot.rotation, { x: 0.4, duration: TIMING.beat }, 0);
        tl.to(this.torsoPivot.rotation, { x: 0.2, duration: TIMING.beat }, 0);
        tl.to(this.headPivot.rotation, { x: 0, duration: 0.4 }, '+=0.6');
        tl.to(this.torsoPivot.rotation, { x: 0, duration: 0.4 }, '<');
        break;
      case 'idle': {
        // A decorative loop: same length either way (story timing), but barely moves under reduced motion.
        const k = reducedMotion() ? 0.2 : 1;
        tl.to(this.torso.scale, { y: 1 + 0.04 * k, duration: 1.2, repeat: 1, yoyo: true, ease: 'sine.inOut' }, 0);
        tl.to(this.headPivot.rotation, { x: 0.06 * k, duration: 1.2, repeat: 1, yoyo: true, ease: 'sine.inOut' }, 0);
        break;
      }
      case 'foot-tap':
        // Waiting: foot taps, fingers drum, and the Worker glances toward the lift.
        tl.to(this.footPivot.rotation, { x: -0.5, duration: 0.16, repeat: 7, yoyo: true }, 0);
        tl.to(l.elbow.rotation, { x: ELBOW_REST - 0.18, duration: 0.14, repeat: 7, yoyo: true }, 0);
        tl.to(this.headPivot.rotation, { y: -0.7, duration: 0.3, ease: 'power2.out' }, 0);
        tl.to(this.headPivot.rotation, { y: 0, duration: 0.3, ease: 'power2.inOut' }, 0.98);
        break;
    }
    return tl;
  }

  drawer(action: 'put' | 'take', register: RegisterName): gsap.core.Timeline {
    const d = this.drawers[register];
    const tl = gsap.timeline();
    tl.to(d.position, { z: '+=0.4', duration: 0.3 });
    tl.to(d.material as THREE.MeshStandardMaterial, {
      emissiveIntensity: action === 'put' ? 1.4 : 0.1,
      duration: 0.25,
    });
    tl.to(d.material as THREE.MeshStandardMaterial, { emissiveIntensity: 0.25, duration: 0.25 });
    tl.to(d.position, { z: '-=0.4', duration: 0.3 });
    return tl;
  }

  dispenseTicket(): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.call(() => {
      this.ticket.visible = true;
      this.ticket.position.y = floorBaseY(10) + 1.78;
    });
    tl.to(this.ticket.position, { y: '+=0.5', duration: 0.4, ease: 'back.out(2)' });
    tl.to(this.ticket.position, { y: '-=0.2', duration: 0.3 });
    tl.to(this.ticket, { visible: false, duration: 0 }, '+=0.8');
    return tl;
  }

  showCard(): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.call(() => {
      this.card.visible = true;
      this.card.scale.setScalar(0.01);
    });
    tl.to(this.card.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(1.6)' });
    return tl;
  }

  splitCard(): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.call(() => {
      const p = this.card.position;
      for (const [i, half] of this.cardHalves.entries()) {
        half.visible = true;
        half.position.copy(p);
        half.rotation.copy(this.card.rotation);
        half.position.x += i === 0 ? -0.05 : 0.05;
      }
      this.card.visible = false;
    });
    tl.to(this.cardHalves[0].position, { x: '-=0.8', y: '+=0.25', duration: TIMING.beat });
    tl.to(this.cardHalves[1].position, { x: '+=0.8', y: '+=0.25', duration: TIMING.beat }, '<');
    tl.to(
      [this.cardHalves[0].rotation, this.cardHalves[1].rotation],
      { z: 0.15, duration: TIMING.beat },
      '<',
    );
    // Fade halves away after a readable pause.
    for (const half of this.cardHalves) {
      const m = half.material as THREE.MeshStandardMaterial;
      tl.call(() => (m.transparent = true), undefined, '+=1.2');
      tl.to(m, { opacity: 0, duration: 0.5 });
      tl.call(() => {
        half.visible = false;
        m.opacity = 1;
        m.transparent = false;
      });
    }
    return tl;
  }

  hideCard(): void {
    this.card.visible = false;
  }
}
