import * as THREE from 'three';
import type { Materials } from './materials';
import { seeded } from './rand';

/** Props for one room. `glow` are the materials `reveal`/`flash`/`setGlow` drive. */
export interface RoomProps {
  group: THREE.Group;
  glow: THREE.MeshStandardMaterial[];
  clickables: THREE.Mesh[];
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();

export interface Slot {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  ry?: number;
  color?: THREE.Color;
}

/** One draw call for many boxes. `y` is the box CENTRE. */
export function instanced(mat: THREE.Material, slots: Slot[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(BOX, mat, slots.length);
  slots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.scale.set(s.sx, s.sy, s.sz);
    dummy.rotation.set(0, s.ry ?? 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (s.color) mesh.setColorAt(i, s.color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function shade(base: number, rnd: () => number, spread = 0.25): THREE.Color {
  const c = new THREE.Color(base);
  const k = 1 - spread / 2 + rnd() * spread;
  return c.multiplyScalar(k);
}

/**
 * L1 shelf unit against the back wall. Instruction shelf holds upright cyan "cards/files",
 * data shelf holds magenta "blocks" — the same shapes and colours the pulses use.
 */
export function shelfProps(
  m: Materials,
  kind: 'instruction' | 'data',
  cx: number,
  cz: number,
  floorY: number,
  color: number,
): RoomProps {
  const group = new THREE.Group();
  const z = cz;
  const frame: Slot[] = [];
  for (const sx of [-2.05, 2.05]) frame.push({ x: cx + sx, y: floorY + 1.05, z, sx: 0.09, sy: 2.1, sz: 0.62 });
  for (const by of [0.08, 0.76, 1.44, 2.1]) frame.push({ x: cx, y: floorY + by, z, sx: 4.2, sy: 0.07, sz: 0.62 });
  const frameMesh = instanced(m.metal, frame);
  group.add(frameMesh);

  const rnd = seeded(kind === 'instruction' ? 101 : 202);
  const items: Slot[] = [];
  for (let row = 0; row < 3; row++) {
    const top = floorY + [0.08, 0.76, 1.44][row] + 0.035;
    for (let i = 0; i < 9; i++) {
      const x = cx - 1.7 + i * 0.425;
      if (rnd() < 0.12) continue; // a few gaps so it reads as used storage
      if (kind === 'instruction') {
        const h = 0.42 + rnd() * 0.2;
        items.push({ x, y: top + h / 2, z, sx: 0.2, sy: h, sz: 0.4, color: shade(color, rnd) });
      } else {
        const s = 0.3 + rnd() * 0.08;
        items.push({ x, y: top + s / 2, z, sx: s, sy: s, sz: s, ry: rnd() * 0.5, color: shade(color, rnd) });
      }
    }
  }
  const mat = m.tint(color, 0.1, { whiteBase: true });
  const itemMesh = instanced(mat, items);
  group.add(itemMesh);

  return { group, glow: [mat], clickables: [frameMesh, itemMesh] };
}

/** L2 storeroom: wooden crates stacked along the back wall plus two free-standing stacks. */
export function storeroomProps(
  m: Materials,
  cx: number,
  cz: number,
  floorY: number,
  w: number,
  color: number,
): RoomProps {
  const group = new THREE.Group();
  const rnd = seeded(303);
  const crates: Slot[] = [];
  const n = 8;
  const span = w - 1.6;
  for (let i = 0; i < n; i++) {
    const x = cx - span / 2 + (i * span) / (n - 1);
    const stack = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < stack; k++) {
      crates.push({
        x,
        y: floorY + 0.12 + 0.37 + k * 0.74,
        z: cz,
        sx: 0.8,
        sy: 0.72,
        sz: 0.8,
        ry: (rnd() - 0.5) * 0.12,
        color: shade(color, rnd, 0.35),
      });
    }
  }
  for (const sx of [-w / 2 + 0.9, w / 2 - 0.9]) {
    for (let k = 0; k < 2; k++) {
      crates.push({ x: cx + sx, y: floorY + 0.12 + 0.37 + k * 0.74, z: cz + 2.1, sx: 0.8, sy: 0.72, sz: 0.8, color: shade(color, rnd, 0.35) });
    }
  }
  const mat = m.tint(color, 0.1, { whiteBase: true });
  const crateMesh = instanced(mat, crates);
  group.add(crateMesh);

  // Metal bands on every crate read as strapping.
  const bands = crates.map((c) => ({ ...c, sx: c.sx + 0.04, sy: 0.08, sz: c.sz + 0.04, color: undefined }));
  const bandMesh = instanced(m.darkMetal, bands);
  group.add(bandMesh);

  return { group, glow: [mat], clickables: [crateMesh, bandMesh] };
}

/** RAM archive: a long row of tall filing cabinets with bright drawer fronts. */
export function archiveProps(
  m: Materials,
  cx: number,
  cz: number,
  floorY: number,
  w: number,
  color: number,
): RoomProps {
  const group = new THREE.Group();
  const rnd = seeded(404);
  const n = 10;
  const span = w - 1.4;
  const cabinets: Slot[] = [];
  const drawers: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const x = cx - span / 2 + (i * span) / (n - 1);
    const h = 2.0 + rnd() * 0.5;
    cabinets.push({ x, y: floorY + 0.1 + h / 2, z: cz, sx: 0.88, sy: h, sz: 0.85, color: shade(color, rnd, 0.2) });
    const rows = Math.floor(h / 0.5);
    for (let r = 0; r < rows; r++) {
      drawers.push({ x, y: floorY + 0.35 + r * 0.5, z: cz + 0.435, sx: 0.7, sy: 0.34, sz: 0.04, color: shade(0xbfe0ff, rnd, 0.3) });
    }
  }
  const cabMat = m.tint(color, 0.1, { whiteBase: true });
  const cabMesh = instanced(cabMat, cabinets);
  group.add(cabMesh);

  const drawerMat = m.tint(0x7fb6ff, 0.45, { whiteBase: true });
  const drawerMesh = instanced(drawerMat, drawers);
  group.add(drawerMesh);

  // Yellow aisle tape on the floor.
  const tape: Slot[] = [];
  for (let i = 0; i < 12; i++) tape.push({ x: cx - span / 2 - 0.4 + i * (span / 11 + 0.04), y: floorY + 0.14, z: cz + 2.6, sx: 0.5, sy: 0.02, sz: 0.1 });
  const tapeMesh = instanced(m.emitter(0xffd75e, 0.9), tape);
  tapeMesh.castShadow = false;
  group.add(tapeMesh);

  return { group, glow: [cabMat, drawerMat], clickables: [cabMesh, drawerMesh] };
}

/** Warehouse: roller doors on the front face, pallets of boxes, wall lamps. `pos` = building centre on the ground. */
export function warehouseProps(m: Materials, pos: THREE.Vector3, color: number): RoomProps {
  const group = new THREE.Group();
  const frontZ = pos.z + 3.5;

  const doorSlots: Slot[] = [];
  for (const dx of [-2.8, 0, 2.8]) {
    for (let s = 0; s < 8; s++) {
      doorSlots.push({ x: pos.x + dx, y: 0.3 + s * 0.36, z: frontZ + 0.04, sx: 2.1, sy: 0.3, sz: 0.06 });
    }
  }
  const doorMesh = instanced(m.metal, doorSlots);
  group.add(doorMesh);

  const rnd = seeded(505);
  const boxes: Slot[] = [];
  for (const px of [-3.6, -0.6, 2.2]) {
    boxes.push({ x: pos.x + px, y: 0.08, z: frontZ + 1.3, sx: 1.3, sy: 0.16, sz: 1.3 }); // pallet
    const stack = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < stack; k++) {
      boxes.push({
        x: pos.x + px + (rnd() - 0.5) * 0.15,
        y: 0.16 + 0.3 + k * 0.6,
        z: frontZ + 1.3,
        sx: 1.0,
        sy: 0.58,
        sz: 1.0,
        ry: (rnd() - 0.5) * 0.3,
        color: shade(color, rnd, 0.35),
      });
    }
  }
  const mat = m.tint(color, 0.1, { whiteBase: true });
  const boxMesh = instanced(mat, boxes);
  group.add(boxMesh);

  const lamps: Slot[] = [];
  for (const dx of [-4.2, 4.2]) lamps.push({ x: pos.x + dx, y: 3.9, z: frontZ + 0.2, sx: 0.5, sy: 0.14, sz: 0.3 });
  const lampMesh = instanced(m.emitter(0xffe3a0, 1.8), lamps);
  lampMesh.castShadow = false;
  group.add(lampMesh);

  return { group, glow: [mat], clickables: [doorMesh, boxMesh] };
}
