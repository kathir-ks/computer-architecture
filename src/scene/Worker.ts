import * as THREE from 'three';
import gsap from 'gsap';
import { floorBaseY } from './Building';
import { TIMING } from './timing';

export type WorkKind = 'compute' | 'read-card' | 'idle' | 'foot-tap';
export type RegisterName = 'r1' | 'r2';

/**
 * The Worker: a low-poly character at a desk on floor 10 with register drawers,
 * a program-counter ticket dispenser and an instruction card.
 */
export class Worker {
  readonly group = new THREE.Group();
  private head: THREE.Mesh;
  private torso: THREE.Mesh;
  private foot: THREE.Mesh;
  private drawers: Record<RegisterName, THREE.Mesh>;
  private ticket: THREE.Mesh;
  private card: THREE.Mesh;
  private cardHalves: [THREE.Mesh, THREE.Mesh];
  private deskMat: THREE.MeshStandardMaterial;
  readonly clickTargets: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    const y = floorBaseY(10);

    // Desk
    this.deskMat = new THREE.MeshStandardMaterial({
      color: 0x7a5a3a,
      emissive: 0x7a5a3a,
      emissiveIntensity: 0.08,
    });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 1.6), this.deskMat);
    desk.position.set(3.2, y + 1.0, 0);
    this.group.add(desk);
    this.clickTargets.push(desk);

    for (const leg of [-1.5, 1.5]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), this.deskMat);
      l.position.set(3.2 + leg, y + 0.5, 0.6);
      this.group.add(l);
      const l2 = l.clone();
      l2.position.z = -0.6;
      this.group.add(l2);
    }

    // Register drawers (front of desk)
    const drawerMat = new THREE.MeshStandardMaterial({
      color: 0x2affb0,
      emissive: 0x2affb0,
      emissiveIntensity: 0.25,
    });
    const mkDrawer = (x: number) => {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.34, 0.5), drawerMat.clone());
      d.position.set(x, y + 0.78, 0.62);
      this.group.add(d);
      this.clickTargets.push(d);
      return d;
    };
    this.drawers = { r1: mkDrawer(2.6), r2: mkDrawer(3.8) };

    // Character (behind the desk, facing +z)
    const skin = new THREE.MeshStandardMaterial({ color: 0xffd6b3 });
    const shirt = new THREE.MeshStandardMaterial({
      color: 0x5e8bff,
      emissive: 0x5e8bff,
      emissiveIntensity: 0.18,
    });
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), shirt);
    this.torso.position.set(3.2, y + 1.15, -1.1);
    this.group.add(this.torso);
    this.clickTargets.push(this.torso);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16), skin);
    this.head.position.set(3.2, y + 2.0, -1.1);
    this.group.add(this.head);
    this.clickTargets.push(this.head);

    this.foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.55), skin);
    this.foot.position.set(3.55, y + 0.08, -0.85);
    this.group.add(this.foot);

    // Program-counter ticket dispenser
    const pcMat = new THREE.MeshStandardMaterial({
      color: 0xffd75e,
      emissive: 0xffd75e,
      emissiveIntensity: 0.3,
    });
    const dispenser = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.55), pcMat);
    dispenser.position.set(4.4, y + 1.42, 1.4);
    this.group.add(dispenser);
    this.clickTargets.push(dispenser);

    this.ticket = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.02, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 }),
    );
    this.ticket.position.set(4.4, y + 1.78, 1.4);
    this.ticket.visible = false;
    this.group.add(this.ticket);

    // Instruction card (appears during fetch/decode)
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
      const m = new THREE.Mesh(
        halfGeo,
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, side: THREE.DoubleSide }),
      );
      m.visible = false;
      this.group.add(m);
      return m;
    };
    this.cardHalves = [mkHalf(0xffd75e), mkHalf(0xff2ea6)];

    scene.add(this.group);
  }

  private drawerMats(): THREE.MeshStandardMaterial[] {
    return [this.drawers.r1.material, this.drawers.r2.material] as THREE.MeshStandardMaterial[];
  }

  setGlow(on: boolean): void {
    (this.torso.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.9 : 0.18;
    for (const m of this.drawerMats()) m.emissiveIntensity = on ? 0.9 : 0.25;
  }

  // ---- verbs ----

  playWork(kind: WorkKind): gsap.core.Timeline {
    const tl = gsap.timeline();
    switch (kind) {
      case 'compute':
        tl.to(this.head.position, { y: '-=0.12', duration: 0.18, repeat: 5, yoyo: true });
        tl.to(
          this.torso.rotation,
          { z: 0.08, duration: 0.18, repeat: 5, yoyo: true },
          0,
        );
        break;
      case 'read-card':
        tl.to(this.card.position, { y: '+=0.45', z: '-=0.5', duration: TIMING.beat });
        tl.to(this.head.rotation, { x: 0.35, duration: TIMING.beat }, 0);
        tl.to(this.head.rotation, { x: 0, duration: 0.4 }, '+=0.6');
        break;
      case 'idle':
        tl.to(this.torso.position, { y: '+=0.05', duration: 1.2, repeat: 1, yoyo: true });
        break;
      case 'foot-tap':
        tl.to(this.foot.rotation, { x: -0.5, duration: 0.16, repeat: 7, yoyo: true });
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
