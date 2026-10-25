import * as THREE from 'three';
import gsap from 'gsap';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { World } from './World';
import type { HighlightId, LocationId } from './locations';
import { TIMING } from './timing';
import type { Materials } from './materials';
import {
  archiveProps,
  instanced,
  shelfProps,
  storeroomProps,
  warehouseProps,
  type RoomProps,
  type Slot,
} from './props';
import { seeded } from './rand';
import { Feedback } from './effects/Feedback';
import { Xray } from './effects/Xray';
import { FLOOR_ROLES } from './floorRoles';
import type { QualityTier } from './view/viewState';

// ---- shared world geometry constants ----
export const FLOOR_H = 3;
export const FLOORS = 10;
export const BLD_W = 14; // x
export const BLD_D = 9; // z (front face +z is open — the cutaway)
export const LIFT_X = -BLD_W / 2 + 1.6;
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
      return new THREE.Vector3(LIFT_X, floorCenterY(1), 0);
    case 'pipeline':
      return new THREE.Vector3(0.1, floorBaseY(10) + 1.3, 1.35);
  }
}

const COL = {
  neon: 0x00e5ff,
  /** Each room has its own hue so rooms read apart without labels. */
  l1i: 0x2fb8d8, // cyan — same hue as instruction pulses
  l1d: 0xe0509c, // magenta — same hue as data pulses
  l2: 0xe0a030, // amber storeroom
  ram: 0x4d86e0, // blue archive
  disk: 0x8a70e0, // purple warehouse — matches the courier van
  warehouseBody: 0x6d5fb0,
};

interface Room {
  group: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  light: THREE.PointLight;
  label: CSS2DObject;
  labelEl: HTMLDivElement;
  /** Where hit/miss glyphs float (world space). */
  anchor: THREE.Vector3;
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
  private feedback: Feedback;
  /** The cross-section: decoration registered below fades, blueprint outlines and floor-role labels appear. */
  readonly xray = new Xray();

  constructor(
    private world: World,
    private m: Materials,
  ) {
    this.feedback = new Feedback(this.group);
    this.buildGround();
    this.buildTower();
    this.buildRoom('l1i', 'L1i · instruction shelf', new THREE.Vector3(-2.8, 0, -0.5), 9, COL.l1i, 4.6, 5, (y, c) =>
      shelfProps(this.m, 'instruction', c.x, -2.6, y, COL.l1i),
    );
    this.buildRoom('l1d', 'L1d · data shelf', new THREE.Vector3(3.2, 0, -0.5), 9, COL.l1d, 4.6, 5, (y, c) =>
      shelfProps(this.m, 'data', c.x, -2.6, y, COL.l1d),
    );
    this.buildRoom('l2', 'L2 · storeroom', new THREE.Vector3(0.5, 0, -0.5), 8, COL.l2, 9, 6, (y, c) =>
      storeroomProps(this.m, c.x, -2.7, y, 9, COL.l2),
    );
    this.buildRoom('ram', 'RAM · archive', new THREE.Vector3(0.5, 0, 0), 4, COL.ram, 12, 7, (y, c) =>
      archiveProps(this.m, c.x, -3.0, y, 12, COL.ram),
    );
    this.buildWarehouse();
    this.enableShadows();
    world.scene.add(this.group);
    this.wireClicks();
  }

  private enableShadows(): void {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.Material;
      if (mat.transparent) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }

  private buildGround(): void {
    const m = this.m;
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 0.4, 48), m.ground);
    ground.position.y = -0.2;
    ground.castShadow = false;
    this.group.add(ground);

    // Road from building to warehouse.
    const roadX = (WAREHOUSE_POS.x - BLD_W / 2) / 2 - BLD_W / 4;
    const road = new THREE.Mesh(new THREE.BoxGeometry(22, 0.05, 4), m.asphalt);
    road.position.set(roadX, 0.03, WAREHOUSE_POS.z);
    this.group.add(road);

    // Dashed centre line + lamp posts along the road (one draw call each).
    const dashes: Slot[] = [];
    for (let i = 0; i < 9; i++) dashes.push({ x: roadX - 9.5 + i * 2.4, y: 0.07, z: WAREHOUSE_POS.z, sx: 1.2, sy: 0.02, sz: 0.1 });
    this.group.add(instanced(m.emitter(0xdfe6ff, 0.5), dashes));

    const poles: Slot[] = [];
    const heads: Slot[] = [];
    for (let i = 0; i < 5; i++) {
      const x = roadX - 9 + i * 4.5;
      poles.push({ x, y: 1.7, z: WAREHOUSE_POS.z - 2.4, sx: 0.12, sy: 3.4, sz: 0.12 });
      heads.push({ x, y: 3.45, z: WAREHOUSE_POS.z - 2.15, sx: 0.55, sy: 0.1, sz: 0.34 });
    }
    this.group.add(instanced(m.darkMetal, poles));
    this.group.add(instanced(m.emitter(0xffe3a0, 1.8), heads));

    // Pavement in front of the tower.
    const pavement = new THREE.Mesh(new THREE.BoxGeometry(BLD_W + 6, 0.08, 3.4), m.concrete);
    pavement.position.set(0, 0.04, BLD_D / 2 + 2);
    this.group.add(pavement);
  }

  private buildTower(): void {
    const m = this.m;
    const H = FLOORS * FLOOR_H;

    const slabGeo = new THREE.BoxGeometry(BLD_W + 0.5, 0.25, BLD_D + 0.3);
    for (let f = 1; f <= FLOORS + 1; f++) {
      const slab = new THREE.Mesh(slabGeo, m.slab);
      slab.position.y = floorBaseY(f) - 0.125;
      this.group.add(slab);
    }

    // Neon trim along every slab's front edge.
    const trim: Slot[] = [];
    for (let f = 1; f <= FLOORS + 1; f++) {
      trim.push({ x: 0, y: floorBaseY(f) - 0.125, z: (BLD_D + 0.3) / 2, sx: BLD_W + 0.5, sy: 0.06, sz: 0.06 });
    }
    const trimMesh = instanced(m.emitter(COL.neon, 1.1), trim);
    trimMesh.castShadow = false;
    this.group.add(trimMesh);

    // Back and side walls with lit windows — front (+z) stays open for the cutaway.
    const backMat = m.windowWall(BLD_W, H);
    this.xray.fade(backMat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(BLD_W, H, 0.25), backMat);
    back.position.set(0, H / 2, -BLD_D / 2);
    this.group.add(back);

    for (const sx of [-BLD_W / 2, BLD_W / 2]) {
      const sideMat = m.windowWall(BLD_D, H);
      this.xray.fade(sideMat);
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.25, H, BLD_D), sideMat);
      side.position.set(sx, H / 2, 0);
      this.group.add(side);
    }

    // Ceiling light strips: bright on the working floors, dim elsewhere.
    const litFloors = new Set([10, 9, 8, 4]);
    const bright: Slot[] = [];
    const dim: Slot[] = [];
    for (let f = 1; f <= FLOORS; f++) {
      const strip: Slot = { x: 0, y: floorBaseY(f) + FLOOR_H - 0.18, z: -0.4, sx: BLD_W - 3, sy: 0.05, sz: 0.4 };
      (litFloors.has(f) ? bright : dim).push(strip);
    }
    const brightMesh = instanced(m.emitter(0xfff1d0, 1.3), bright);
    const dimMat = m.emitter(0x5a6a9a, 0.6);
    this.xray.fade(dimMat); // the strips on the spare floors are decoration
    const dimMesh = instanced(dimMat, dim);
    brightMesh.castShadow = dimMesh.castShadow = false;
    this.group.add(brightMesh, dimMesh);

    // Unused floors: racks of idle hardware with blinking-looking LEDs.
    // Its own copy: the shared dark metal is also the lift rails and the Worker's desk, which must not fade.
    const rackMat = m.darkMetal.clone();
    this.xray.fade(rackMat);
    // In X-ray the racks give way to a blueprint outline, so the spare floors still read as floors.
    const blueprintMat = new THREE.LineBasicMaterial({ color: 0x7fd8ff, transparent: true });
    this.xray.reveal(blueprintMat, 0.45);
    const rnd = seeded(606);
    const greens: Slot[] = [];
    const ambers: Slot[] = [];
    for (const f of [1, 2, 3, 5, 6, 7]) {
      const w = BLD_W - 4.5;
      const fillerGeo = new THREE.BoxGeometry(w, FLOOR_H - 1.2, BLD_D - 3);
      const filler = new THREE.Mesh(fillerGeo, rackMat);
      filler.position.set(0.8, floorCenterY(f), -0.6);
      this.group.add(filler);
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(fillerGeo), blueprintMat);
      frame.position.copy(filler.position);
      this.group.add(frame);
      const frontZ = -0.6 + (BLD_D - 3) / 2 + 0.03;
      for (let i = 0; i < 28; i++) {
        const led: Slot = {
          x: 0.8 - w / 2 + 0.5 + rnd() * (w - 1),
          y: floorBaseY(f) + 0.7 + rnd() * (FLOOR_H - 2.2),
          z: frontZ,
          sx: 0.09,
          sy: 0.09,
          sz: 0.04,
        };
        (rnd() < 0.7 ? greens : ambers).push(led);
      }
    }
    const ledGMat = m.emitter(0x40ff9a, 2);
    const ledAMat = m.emitter(0xffb040, 2);
    this.xray.fade(ledGMat);
    this.xray.fade(ledAMat);
    const ledG = instanced(ledGMat, greens);
    const ledA = instanced(ledAMat, ambers);
    ledG.castShadow = ledA.castShadow = false;
    this.group.add(ledG, ledA);

    // Neon edge outline of the tower.
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(BLD_W, H, BLD_D)),
      new THREE.LineBasicMaterial({ color: COL.neon, transparent: true, opacity: 0.8 }),
    );
    outline.position.y = H / 2;
    this.group.add(outline);

    // Roof: parapet, plant units and a beacon mast.
    const parapet: Slot[] = [
      { x: 0, y: H + 0.3, z: BLD_D / 2, sx: BLD_W + 0.5, sy: 0.5, sz: 0.15 },
      { x: 0, y: H + 0.3, z: -BLD_D / 2, sx: BLD_W + 0.5, sy: 0.5, sz: 0.15 },
      { x: -BLD_W / 2 - 0.1, y: H + 0.3, z: 0, sx: 0.15, sy: 0.5, sz: BLD_D },
      { x: BLD_W / 2 + 0.1, y: H + 0.3, z: 0, sx: 0.15, sy: 0.5, sz: BLD_D },
      { x: -3.5, y: H + 0.55, z: -2.4, sx: 2.2, sy: 1.0, sz: 1.6 },
      { x: 2.6, y: H + 0.45, z: -2.6, sx: 1.6, sy: 0.8, sz: 1.2 },
    ];
    this.group.add(instanced(m.metal, parapet));
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.2, 8), m.metal);
    mast.position.set(5, H + 1.6, -2.8);
    this.group.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), m.emitter(0xff4060, 2.4));
    beacon.position.set(5, H + 3.25, -2.8);
    this.group.add(beacon);

    // Floor-role labels: only visible in X-ray, outside the right wall so they never cover a room.
    for (const { floor, role } of FLOOR_ROLES) {
      // CSS2D centres its element on the anchor; a zero-width holder with the text hanging off its
      // right edge makes the label start at the wall and grow away from the building at any zoom.
      const el = document.createElement('div');
      el.className = 'floor-role-anchor';
      const text = document.createElement('span');
      text.className = 'floor-label floor-role';
      text.textContent = `${floor} · ${role}`;
      el.appendChild(text);
      const tag = new CSS2DObject(el);
      tag.position.set(BLD_W / 2 + 0.5, floorCenterY(floor), BLD_D / 2);
      this.group.add(tag);
      this.xray.label(tag);
    }

    // Rooftop sign.
    const signEl = document.createElement('div');
    signEl.className = 'floor-label';
    signEl.textContent = 'CPU CORE TOWER';
    const sign = new CSS2DObject(signEl);
    sign.position.set(0, H + 1.6, 0);
    this.group.add(sign);
  }

  private buildRoom(
    id: LocationId,
    labelText: string,
    center: THREE.Vector3,
    floor: number,
    color: number,
    w: number,
    d: number,
    makeProps: (floorY: number, center: THREE.Vector3) => RoomProps,
  ): void {
    const group = new THREE.Group();
    const floorY = floorBaseY(floor);

    // Room base glow plate.
    // Dimmed hue: the plate is a floor wash, the props carry the room's identity.
    const plateMat = this.m.tint(new THREE.Color(color).multiplyScalar(0.5).getHex(), 0.08);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), plateMat);
    plate.position.set(center.x, floorY + 0.06, center.z);
    group.add(plate);
    this.registerClickable(plate, id);

    const props = makeProps(floorY, center);
    group.add(props.group);
    for (const c of props.clickables) this.registerClickable(c, id);

    const light = new THREE.PointLight(color, 0, 10);
    light.position.set(center.x, floorY + 2.2, center.z);
    group.add(light);

    const labelEl = document.createElement('div');
    labelEl.className = 'floor-label';
    labelEl.textContent = labelText;
    labelEl.style.opacity = '0';
    labelEl.addEventListener('click', () => this.emitClick(id));
    const label = new CSS2DObject(labelEl);
    label.position.set(center.x, floorY + FLOOR_H - 0.4, BLD_D / 2 + 0.4);
    group.add(label);

    this.group.add(group);
    this.rooms.set(id, {
      group,
      mats: [plateMat, ...props.glow],
      light,
      label,
      labelEl,
      anchor: new THREE.Vector3(center.x, floorY + 1.7, BLD_D / 2 - 0.3),
    });
  }

  private buildWarehouse(): void {
    const m = this.m;
    const group = new THREE.Group();
    const bodyMat = m.tint(COL.warehouseBody, 0.1);
    const body = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 7), bodyMat);
    body.position.copy(WAREHOUSE_POS).add(new THREE.Vector3(0, 2.25, 0));
    group.add(body);
    this.registerClickable(body, 'disk');

    const roof = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 9.2, 3, 1), bodyMat);
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.copy(WAREHOUSE_POS).add(new THREE.Vector3(0, 5.2, 0));
    roof.scale.y = 0.55;
    group.add(roof);

    const props = warehouseProps(m, WAREHOUSE_POS, COL.disk);
    group.add(props.group);
    for (const c of props.clickables) this.registerClickable(c, 'disk');

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
    this.rooms.set('disk', {
      group,
      mats: [bodyMat, ...props.glow],
      light,
      label,
      labelEl,
      anchor: WAREHOUSE_POS.clone().add(new THREE.Vector3(0, 3.4, 4.2)),
    });
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
    const color = kind === 'hit' ? 0x2affb0 : kind === 'miss' ? 0xff4060 : 0x00e5ff;
    for (const m of room.mats) {
      const orig = m.emissive.getHex();
      tl.call(() => m.emissive.setHex(color), undefined, 0);
      tl.to(m, { emissiveIntensity: 1.2, duration: TIMING.beat / 2 }, 0);
      tl.to(m, { emissiveIntensity: 0.35, duration: TIMING.beat / 2 }, TIMING.beat / 2);
      tl.call(() => m.emissive.setHex(orig), undefined, TIMING.beat);
    }
    // Shape feedback runs alongside the colour pulse (focus is just a highlight, no verdict).
    if (kind !== 'focus') tl.add(this.feedback.play(kind, room.anchor, room.group), 0);
    return tl;
  }

  setQualityTier(tier: QualityTier): void {
    this.feedback.setTier(tier);
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
