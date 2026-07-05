import * as THREE from 'three';
import gsap from 'gsap';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { World } from './World';
import type { HighlightId, LocationId } from './locations';
import { TIMING } from './timing';

// ---- shared world geometry constants ----
export const FLOOR_H = 3;
export const FLOORS = 10;
export const BLD_W = 14; // x
export const BLD_D = 9; // z (front face +z is open — the cutaway)
export const LIFT_X = -BLD_W / 2 + 1.6;
// Lift rides in a glass tube on the open (+z) face so every carry is visible
// for the whole trip from anywhere in the viewing arc (FR-003).
export const LIFT_Z = BLD_D / 2 - 0.6;
export const WAREHOUSE_POS = new THREE.Vector3(-26, 0, 8);

export function floorBaseY(floor: number): number {
  return (floor - 1) * FLOOR_H;
}
export function floorCenterY(floor: number): number {
  return floorBaseY(floor) + FLOOR_H / 2;
}

/** Where pulses spawn/arrive for each location (world space). */
export function anchorFor(id: HighlightId): THREE.Vector3 {
  switch (id) {
    case 'registers':
    case 'worker':
      return new THREE.Vector3(3.2, floorBaseY(10) + 1.1, 0);
    case 'pc':
      return new THREE.Vector3(4.4, floorBaseY(10) + 1.3, 1.4);
    case 'l1i':
      return new THREE.Vector3(-2.8, floorCenterY(9), -1.5);
    case 'l1d':
      return new THREE.Vector3(3.2, floorCenterY(9), -1.5);
    case 'l2':
      return new THREE.Vector3(0.5, floorCenterY(8), -1);
    case 'ram':
      return new THREE.Vector3(0.5, floorCenterY(4), 0);
    case 'disk':
    case 'courier':
      return WAREHOUSE_POS.clone().add(new THREE.Vector3(0, 1.6, 0));
    case 'lift':
      return new THREE.Vector3(LIFT_X, floorCenterY(1), LIFT_Z);
  }
}

/**
 * Single source of the scene's color coding (data-model FloorPalette).
 * Functional floor groups get distinct hues; structure stays neutral;
 * signals must remain pairwise distinguishable against room surfaces.
 */
export const PALETTE = {
  desk: 0x1a2138, // floor 10 dressing
  l1: 0x3b4c78, // floor 9 shelves
  l2: 0x3b4c78, // floor 8 storeroom
  ram: 0x35558a, // floor 4 archive
  emptyFloor: 0x131a2e, // floors 1-3, 5-7
  warehouse: 0x2e2a45,
  structure: {
    slab: 0x2a3350,
    wall: 0x1a2138,
    ground: 0x0e1424,
    road: 0x181f33,
  },
  sky: 0x0a0e1a, // World background + fog
  accent: 0x00e5ff, // edge lines, focus glow
  signals: {
    hit: 0x2affb0,
    miss: 0xff4060,
    focus: 0x00e5ff,
  },
};

interface Room {
  group: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  light: THREE.PointLight;
  label: CSS2DObject;
  labelEl: HTMLDivElement;
}

/**
 * The cutaway tower, warehouse, labels and highlightable rooms.
 * Exposes `reveal` / `flash` verbs and steady `setGlow` for the Highlighter.
 */
export class Building {
  readonly group = new THREE.Group();
  private rooms = new Map<HighlightId, Room>();
  private clickCbs = new Set<(id: HighlightId) => void>();
  private clickableMeshes: THREE.Mesh[] = [];
  private meshToId = new Map<THREE.Object3D, HighlightId>();
  private raycaster = new THREE.Raycaster();

  constructor(private world: World) {
    this.buildGround();
    this.buildTower();
    this.buildRoom('l1i', 'L1i · instruction shelf', new THREE.Vector3(-2.8, 0, -0.5), 9, this.shelfProps());
    this.buildRoom('l1d', 'L1d · data shelf', new THREE.Vector3(3.2, 0, -0.5), 9, this.shelfProps());
    this.buildRoom('l2', 'L2 · storeroom', new THREE.Vector3(0.5, 0, -0.5), 8, {
      w: 9,
      d: 6,
      color: PALETTE.l2,
      crates: 8,
    });
    this.buildRoom('ram', 'RAM · archive', new THREE.Vector3(0.5, 0, 0), 4, {
      w: 12,
      d: 7,
      color: PALETTE.ram,
      crates: 16,
    });
    this.buildWarehouse();
    world.scene.add(this.group);
    this.wireClicks();
  }

  private shelfProps() {
    return { w: 4.6, d: 5, color: PALETTE.l1, crates: 5 };
  }

  private buildGround(): void {
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(70, 70, 0.4, 48),
      new THREE.MeshStandardMaterial({ color: PALETTE.structure.ground }),
    );
    ground.position.y = -0.2;
    this.group.add(ground);

    // Road from building to warehouse.
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.05, 4),
      new THREE.MeshStandardMaterial({ color: PALETTE.structure.road }),
    );
    road.position.set((WAREHOUSE_POS.x - BLD_W / 2) / 2 - BLD_W / 4, 0.03, WAREHOUSE_POS.z);
    this.group.add(road);
  }

  private buildTower(): void {
    const slabGeo = new THREE.BoxGeometry(BLD_W, 0.25, BLD_D);
    const slabMat = new THREE.MeshStandardMaterial({ color: PALETTE.structure.slab });
    for (let f = 1; f <= FLOORS + 1; f++) {
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.y = floorBaseY(f) - 0.125;
      this.group.add(slab);
    }

    // Back wall and side walls — front (+z) stays open for the cutaway.
    const wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.structure.wall });
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(BLD_W, FLOORS * FLOOR_H, 0.25),
      wallMat,
    );
    back.position.set(0, (FLOORS * FLOOR_H) / 2, -BLD_D / 2);
    this.group.add(back);

    // Side walls cover only the back half — at arc-edge azimuths (±80°) a
    // full-depth side wall would occlude the room interiors (cutaway, FR-001).
    const sideGeo = new THREE.BoxGeometry(0.25, FLOORS * FLOOR_H, BLD_D / 2);
    for (const sx of [-BLD_W / 2, BLD_W / 2]) {
      const side = new THREE.Mesh(sideGeo, wallMat);
      side.position.set(sx, (FLOORS * FLOOR_H) / 2, -BLD_D / 4);
      this.group.add(side);
    }

    // Ordinary offices on the unused floors (1-3, 5-7) — open dollhouse rooms
    // instead of the old dark filler blocks. Set dressing only: not clickable,
    // not highlightable, deterministic layout varied by floor number.
    for (const f of [1, 2, 3, 5, 6, 7]) this.dressEmptyFloor(f);

    // Neon edge outline of the tower.
    const outlineGeo = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(BLD_W, FLOORS * FLOOR_H, BLD_D),
    );
    const outline = new THREE.LineSegments(
      outlineGeo,
      new THREE.LineBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.8 }),
    );
    outline.position.y = (FLOORS * FLOOR_H) / 2;
    this.group.add(outline);

    // Rooftop sign.
    const signEl = document.createElement('div');
    signEl.className = 'floor-label';
    signEl.textContent = 'CPU CORE TOWER';
    const sign = new CSS2DObject(signEl);
    sign.position.set(0, FLOORS * FLOOR_H + 1.6, 0);
    this.group.add(sign);
  }

  /** Simple office dressing for a non-teaching floor: desks, a cabinet, a plant. */
  private dressEmptyFloor(f: number): void {
    const y = floorBaseY(f);
    const deskMat = new THREE.MeshStandardMaterial({ color: PALETTE.emptyFloor, emissive: PALETTE.emptyFloor, emissiveIntensity: 0.08 });
    const mirror = f % 2 === 0 ? 1 : -1; // alternate layouts so floors don't clone

    // Two desks (top + legs suggested by a single slab on a block).
    for (const dx of [-3.4, 1.8]) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.1), deskMat);
      top.position.set(dx * mirror + 0.6, y + 0.85, -1.2);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 0.9), deskMat);
      base.position.set(dx * mirror + 0.6, y + 0.42, -1.2);
      this.group.add(top, base);
    }

    // Filing cabinet against the back wall.
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.7), deskMat);
    cabinet.position.set(4.6 * mirror, y + 0.9, -BLD_D / 2 + 0.7);
    this.group.add(cabinet);

    // Potted plant near the open face.
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.4, 8), deskMat);
    pot.position.set(-4.8 * mirror, y + 0.2, 1.6);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), deskMat);
    leaves.position.set(-4.8 * mirror, y + 0.9, 1.6);
    this.group.add(pot, leaves);
  }

  private buildRoom(
    id: LocationId,
    labelText: string,
    center: THREE.Vector3,
    floor: number,
    opts: { w: number; d: number; color: number; crates: number },
  ): void {
    const group = new THREE.Group();
    const mats: THREE.MeshStandardMaterial[] = [];

    // Room base glow plate.
    const plateMat = new THREE.MeshStandardMaterial({
      color: opts.color,
      emissive: opts.color,
      emissiveIntensity: 0.06,
    });
    mats.push(plateMat);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(opts.w, 0.12, opts.d), plateMat);
    plate.position.set(center.x, floorBaseY(floor) + 0.06, center.z);
    group.add(plate);
    this.registerClickable(plate, id);

    // Shelving / crates suggesting stored data.
    const crateMat = new THREE.MeshStandardMaterial({
      color: opts.color,
      emissive: opts.color,
      emissiveIntensity: 0.12,
    });
    mats.push(crateMat);
    const perRow = Math.ceil(opts.crates / 2);
    for (let i = 0; i < opts.crates; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.7), crateMat);
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      crate.position.set(
        center.x - opts.w / 2 + 0.9 + col * ((opts.w - 1.8) / Math.max(perRow - 1, 1)),
        floorBaseY(floor) + 0.67,
        center.z - opts.d / 2 + 1 + row * (opts.d - 2.2),
      );
      group.add(crate);
      this.registerClickable(crate, id);
    }

    const light = new THREE.PointLight(opts.color, 0, 10);
    light.position.set(center.x, floorBaseY(floor) + 2.2, center.z);
    group.add(light);

    const labelEl = document.createElement('div');
    labelEl.className = 'floor-label';
    labelEl.textContent = labelText;
    labelEl.style.opacity = '0';
    labelEl.addEventListener('click', () => this.emitClick(id));
    const label = new CSS2DObject(labelEl);
    label.position.set(center.x, floorBaseY(floor) + FLOOR_H - 0.4, BLD_D / 2 + 0.4);
    group.add(label);

    this.group.add(group);
    this.rooms.set(id, { group, mats, light, label, labelEl });
  }

  private buildWarehouse(): void {
    const group = new THREE.Group();
    const mats: THREE.MeshStandardMaterial[] = [];
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.warehouse,
      emissive: PALETTE.warehouse,
      emissiveIntensity: 0.15,
    });
    mats.push(mat);
    const body = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 7), mat);
    body.position.copy(WAREHOUSE_POS).add(new THREE.Vector3(0, 2.25, 0));
    group.add(body);
    this.registerClickable(body, 'disk');

    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.6, 9.2, 3, 1),
      mat,
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.copy(WAREHOUSE_POS).add(new THREE.Vector3(0, 5.2, 0));
    roof.scale.y = 0.55;
    group.add(roof);

    const light = new THREE.PointLight(0xffd75e, 0, 14);
    light.position.copy(WAREHOUSE_POS).add(new THREE.Vector3(0, 5, 3));
    group.add(light);

    const labelEl = document.createElement('div');
    labelEl.className = 'floor-label';
    labelEl.textContent = 'Disk · warehouse';
    labelEl.style.opacity = '0';
    labelEl.addEventListener('click', () => this.emitClick('disk'));
    const label = new CSS2DObject(labelEl);
    label.position.copy(WAREHOUSE_POS).add(new THREE.Vector3(0, 7.4, 0));
    group.add(label);

    this.group.add(group);
    this.rooms.set('disk', { group, mats, light, label, labelEl });
  }

  // ---- interactivity ----

  private registerClickable(mesh: THREE.Mesh, id: HighlightId): void {
    this.clickableMeshes.push(mesh);
    this.meshToId.set(mesh, id);
  }

  /** Allow other scene modules (Worker, Lift, Courier) to register their meshes. */
  addClickable(mesh: THREE.Mesh, id: HighlightId): void {
    this.registerClickable(mesh, id);
  }

  onElementClick(cb: (id: HighlightId) => void): void {
    this.clickCbs.add(cb);
  }

  private emitClick(id: HighlightId): void {
    for (const cb of this.clickCbs) cb(id);
  }

  private wireClicks(): void {
    const el = this.world.renderer.domElement;
    let downX = 0;
    let downY = 0;
    el.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });
    el.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return; // drag, not click
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(ndc, this.world.camera);
      const hits = this.raycaster.intersectObjects(this.clickableMeshes, false);
      const first = hits[0]?.object;
      const id = first && this.meshToId.get(first);
      if (id) this.emitClick(id);
    });
  }

  // ---- verbs ----

  /** Lights + label of a location turn on (chapter 1 tour). */
  reveal(id: LocationId): gsap.core.Timeline {
    const room = this.rooms.get(id);
    const tl = gsap.timeline();
    if (!room) return tl;
    tl.to(room.light, { intensity: id === 'disk' ? 2.2 : 3, duration: TIMING.beat }, 0);
    tl.to(room.labelEl.style, { opacity: 1, duration: TIMING.beat }, 0);
    for (const m of room.mats) {
      tl.to(m, { emissiveIntensity: 0.35, duration: TIMING.beat }, 0);
    }
    return tl;
  }

  /** Brief emissive pulse: hit (cyan-green), miss (red), focus (cyan). */
  flash(id: LocationId, kind: 'hit' | 'miss' | 'focus'): gsap.core.Timeline {
    const room = this.rooms.get(id);
    const tl = gsap.timeline();
    if (!room) return tl;
    const color = PALETTE.signals[kind];
    for (const m of room.mats) {
      const orig = m.emissive.getHex();
      tl.call(() => m.emissive.setHex(color), undefined, 0);
      tl.to(m, { emissiveIntensity: 1.2, duration: TIMING.beat / 2 }, 0);
      tl.to(m, { emissiveIntensity: 0.35, duration: TIMING.beat / 2 }, TIMING.beat / 2);
      tl.call(() => m.emissive.setHex(orig), undefined, TIMING.beat);
    }
    return tl;
  }

  /** Steady glow for hover highlighting (no timeline — instant on/off). */
  setGlow(id: HighlightId, on: boolean): void {
    const room = this.rooms.get(id);
    if (!room) return;
    for (const m of room.mats) m.emissiveIntensity = on ? 1.0 : 0.35;
    room.labelEl.classList.toggle('glowing', on);
  }

  /** The room label element (for Highlighter registration). */
  labelElement(id: HighlightId): HTMLElement | undefined {
    return this.rooms.get(id)?.labelEl;
  }
}
