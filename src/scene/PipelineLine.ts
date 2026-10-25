import * as THREE from 'three';
import gsap from 'gsap';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { floorBaseY, LIFT_X } from './Building';
import { locationOf } from './locations';
import { reducedMotion, scaleDuration } from './motion';
import { TIMING } from './timing';
import type { Materials } from './materials';
import type { PipelineTick, PipelineSchedule, Slot, StageId } from './pipelineSchedule';

const Y0 = floorBaseY(10);
/** Fetch by the lift, Decode in the middle, Execute in front of the Worker's desk. */
const STATION_X: Record<StageId, number> = { F: -3.0, D: 0.1, E: 3.2 };
const STAGES: readonly StageId[] = ['F', 'D', 'E'];
const STAGE_LABEL: Record<StageId, string> = { F: 'Fetch', D: 'Decode', E: 'Execute' };
const STAGE_COLOR: Record<StageId, number> = { F: 0x2fb8d8, D: 0xe0a030, E: 0x2affb0 };
const BELT_Z = 1.35;
const CARD_Y = Y0 + 1.06;
const ENTRY_X = -4.45;
const WAIT_COLOR = 0xffb040;
const BUBBLE_COLOR = 0xff4060;
/** One card per instruction; chapters use a handful. */
export const MAX_PIPELINE_CARDS = 8;
const MAX_BUBBLES = 4;
const CARD_COLORS = [0x2fb8d8, 0xe0509c, 0xe0a030, 0x4d86e0, 0x8a70e0, 0x2affb0, 0xff8a5c, 0xa8c8ff];

interface Clerk {
  group: THREE.Group;
  arm: THREE.Group;
  rest: number;
  stage: StageId;
}

interface Card {
  mesh: THREE.Mesh;
  body: THREE.MeshStandardMaterial;
  face: THREE.MeshBasicMaterial;
  canvas: HTMLCanvasElement | null;
  texture: THREE.CanvasTexture | null;
}

function makeClerk(m: Materials, shirt: number, stage: StageId): Clerk {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd6b3, roughness: 0.6 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b3350, roughness: 0.8 });
  const shirtMat = m.tint(shirt, 0.18);
  const ink = new THREE.MeshBasicMaterial({ color: 0x14161f });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.8, 0.28), pants);
  legs.position.y = 0.4;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.62, 0.3), shirtMat);
  torso.position.y = 1.11;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skin);
  head.position.y = 1.62;
  group.add(legs, torso, head);
  for (const ex of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), ink);
    eye.position.set(ex, 1.66, 0.18);
    group.add(eye);
  }

  let arm = new THREE.Group();
  for (const sx of [-0.34, 0.34]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx, 1.38, 0);
    shoulder.rotation.x = -0.5;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.14), shirtMat);
    upper.position.y = -0.26;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), skin);
    hand.position.y = -0.55;
    shoulder.add(upper, hand);
    group.add(shoulder);
    if (sx > 0) arm = shoulder;
  }
  return { group, arm, rest: -0.5, stage };
}

function makeCard(m: Materials, index: number): Card {
  const color = CARD_COLORS[index % CARD_COLORS.length];
  const body = m.tint(color, 0.3);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.44), body);

  let canvas: HTMLCanvasElement | null = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 108;
  const g = canvas.getContext('2d');
  let texture: THREE.CanvasTexture | null = null;
  if (g) texture = new THREE.CanvasTexture(canvas);
  else canvas = null; // no 2D context (tests, odd browsers): the card is just a coloured slab
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;

  const face = new THREE.MeshBasicMaterial({ map: texture ?? null, toneMapped: false, color: texture ? 0xffffff : color });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38), face);
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.0215;
  mesh.add(top);
  mesh.visible = false;
  return { mesh, body, face, canvas, texture };
}

function drawFace(card: Card, name: string, color: number): void {
  const { canvas, texture } = card;
  const g = canvas?.getContext('2d');
  if (!canvas || !g || !texture) return;
  const hex = `#${color.toString(16).padStart(6, '0')}`;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = hex;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.fillRect(0, 0, canvas.width, 22);
  g.strokeStyle = 'rgba(10,14,26,0.55)';
  g.lineWidth = 4;
  g.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  g.fillStyle = '#0a0e1a';
  g.font = 'bold 30px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name.toUpperCase(), canvas.width / 2, canvas.height * 0.62, canvas.width - 16);
  texture.needsUpdate = true;
}

const slotOf = (tick: PipelineTick, i: number): StageId | null => {
  for (const s of STAGES) {
    const x: Slot = tick[s];
    if (x && 'instr' in x && x.instr === i) return s;
  }
  return null;
};

/**
 * The assembly line on floor 10 (research D13): a belt in front of the Worker's desk with three stations, two
 * clerks who do the first two jobs, and cards that travel from station to station.
 *
 * It plays a `PipelineSchedule` and nothing more — it never decides what a hazard is. Everything it animates
 * lives in the timelines it returns, so it pauses, fast-forwards and dies with the story's own timelines;
 * `setup` / `teardown` / `run` are idempotent (the line's presence is one number, tweened to 1 or 0).
 */
export class PipelineLine {
  readonly group = new THREE.Group();
  private furniture = new THREE.Group();
  private clerks: Clerk[] = [];
  private pads = {} as Record<StageId, THREE.MeshStandardMaterial>;
  private beltGlow: THREE.MeshStandardMaterial;
  private cards: Card[] = [];
  private bubbles: THREE.Mesh[] = [];
  private tags: CSS2DObject[] = [];
  private boardObj: CSS2DObject;
  private boardEls: { pipe: HTMLElement; seq: HTMLElement; status: HTMLElement };
  /** 0 = folded away, 1 = fully set up. The only state that persists between verbs. */
  private shown = { v: 0 };
  private glowing = false;
  private light: THREE.PointLight;

  constructor(scene: THREE.Scene, m: Materials) {
    this.group.add(this.furniture);
    this.furniture.position.y = Y0;

    // ---- belt ----
    const belt = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.06, 0.4), m.darkMetal);
    belt.position.set(-0.1, 0.95, BELT_Z);
    this.beltGlow = m.emitter(0x00e5ff, 0.7);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.02, 0.03), this.beltGlow);
    stripe.position.set(-0.1, 0.99, BELT_Z + 0.19);
    this.furniture.add(belt, stripe);

    // ---- three stations ----
    for (const s of STAGES) {
      const x = STATION_X[s];
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.5), m.darkMetal);
      pedestal.position.set(x, 0.45, BELT_Z);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.66), m.metal);
      slab.position.set(x, 0.94, BELT_Z);
      this.pads[s] = m.tint(STAGE_COLOR[s], 0.2);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.02, 0.5), this.pads[s]);
      pad.position.set(x, 1.0, BELT_Z);
      this.furniture.add(pedestal, slab, pad);

      const tagEl = document.createElement('div');
      tagEl.className = 'pipe-tag';
      tagEl.textContent = STAGE_LABEL[s];
      tagEl.style.borderColor = `#${STAGE_COLOR[s].toString(16).padStart(6, '0')}`;
      const tag = new CSS2DObject(tagEl);
      tag.position.set(x, Y0 + 1.5, BELT_Z + 0.1);
      this.group.add(tag);
      this.tags.push(tag);
    }

    // ---- two clerks: Fetch and Decode (the Worker keeps Execute) ----
    for (const [stage, shirt] of [['F', 0x2fb8d8], ['D', 0xe0a030]] as const) {
      const c = makeClerk(m, shirt, stage);
      c.group.position.set(STATION_X[stage], Y0, 0.5);
      this.group.add(c.group);
      this.clerks.push(c);
    }

    // ---- cards and bubble markers ----
    for (let i = 0; i < MAX_PIPELINE_CARDS; i++) {
      const c = makeCard(m, i);
      this.group.add(c.mesh);
      this.cards.push(c);
    }
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: BUBBLE_COLOR,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      toneMapped: false,
    });
    const bubbleEdge = new THREE.LineBasicMaterial({ color: BUBBLE_COLOR, toneMapped: false });
    const bubbleGeo = new THREE.BoxGeometry(0.66, 0.05, 0.44);
    for (let i = 0; i < MAX_BUBBLES; i++) {
      const b = new THREE.Mesh(bubbleGeo, bubbleMat);
      b.add(new THREE.LineSegments(new THREE.EdgesGeometry(bubbleGeo), bubbleEdge));
      b.visible = false;
      this.group.add(b);
      this.bubbles.push(b);
    }

    // ---- the board: one-at-a-time vs pipelined ----
    // CSS2D centres its element on the anchor; a zero-size holder with the board hanging up from its
    // bottom edge keeps the board above the station tags at any zoom.
    const boardEl = document.createElement('div');
    boardEl.className = 'pipe-board-anchor';
    boardEl.innerHTML =
      '<div class="pipe-board">' +
      '<div class="pipe-row"><span>Pipelined</span><b data-k="pipe">–</b></div>' +
      '<div class="pipe-row"><span>One at a time</span><b data-k="seq">–</b></div>' +
      '<div class="pipe-status" data-k="status"></div>' +
      '</div>';
    this.boardEls = {
      pipe: boardEl.querySelector('[data-k="pipe"]')!,
      seq: boardEl.querySelector('[data-k="seq"]')!,
      status: boardEl.querySelector('[data-k="status"]')!,
    };
    this.boardObj = new CSS2DObject(boardEl);
    this.boardObj.position.set(0.1, Y0 + 1.95, BELT_Z);
    this.group.add(this.boardObj);

    this.light = new THREE.PointLight(0xfff1d0, 0, 11);
    this.light.position.set(0.1, Y0 + 2.7, 2.6);
    scene.add(this.group, this.light);
    this.applyShown();
    this.resetRun();
  }

  /** True once the line is fully in place (it is half-way while the clerks are still walking). */
  get isSetUp(): boolean {
    return this.shown.v >= 1;
  }

  // ---- presence ----

  /** The clerks walk in from the lift and the belt rises. Idempotent: a second call tweens 1 → 1. */
  setup(): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.to(this.shown, {
      v: 1,
      duration: scaleDuration(TIMING.pipelineClerkWalk),
      ease: 'power2.inOut',
      onUpdate: () => this.applyShown(),
    });
    return tl;
  }

  /** The clerks walk back to the lift and everything folds away. Idempotent. */
  teardown(): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.to(this.shown, {
      v: 0,
      duration: scaleDuration(TIMING.pipelineClerkWalk),
      ease: 'power2.inOut',
      onUpdate: () => this.applyShown(),
    });
    tl.call(() => this.resetRun());
    return tl;
  }

  /** Steady hover glow for the highlighter (instant). */
  setGlow(on: boolean): void {
    this.glowing = on;
    this.beltGlow.emissiveIntensity = on ? 2.4 : 0.7;
    for (const s of STAGES) this.pads[s].emissiveIntensity = on ? 0.9 : 0.2;
    for (const t of this.tags) t.element.classList.toggle('glowing', on);
  }

  private applyShown(): void {
    const v = this.shown.v;
    this.group.visible = v > 0.001;
    this.light.intensity = 2.4 * v;
    this.furniture.scale.y = Math.max(v, 0.001);
    const lift = new THREE.Vector3(LIFT_X, Y0, 0.3);
    for (const c of this.clerks) {
      const to = new THREE.Vector3(STATION_X[c.stage], Y0, 0.5);
      c.group.position.lerpVectors(lift, to, v);
      c.group.scale.setScalar(Math.max(v, 0.01));
    }
    const o = String(Math.min(1, v * 1.4));
    this.boardObj.element.style.opacity = o;
    for (const t of this.tags) t.element.style.opacity = o;
  }

  // ---- running a schedule ----

  /**
   * Play a schedule through the line. If the line is not set up yet it appears at once (the story sets it
   * up explicitly first; this keeps `run` safe on its own, e.g. from the dev harness or a deep link).
   */
  run(schedule: PipelineSchedule, opts?: { fastForward?: boolean }): gsap.core.Timeline {
    if (schedule.instructions.length > MAX_PIPELINE_CARDS) {
      throw new RangeError(`the line has room for ${MAX_PIPELINE_CARDS} cards, got ${schedule.instructions.length}`);
    }
    const tick = TIMING.pipelineTick * (opts?.fastForward ? TIMING.pipelineFastShare : 1);
    const total = schedule.ticks.length;
    const tl = gsap.timeline();

    tl.call(() => {
      if (this.shown.v < 1) {
        this.shown.v = 1;
        this.applyShown();
      }
      this.beginRun(schedule);
    });
    tl.addLabel('go');
    schedule.ticks.forEach((_, k) => {
      tl.add(this.playTick(schedule, k, tick), `go+=${k * tick}`);
    });
    // The run lasts exactly `total` ticks, however the last slide ends.
    tl.set({}, {}, `go+=${total * tick}`);
    tl.call(() => this.finishRun(schedule), undefined, `go+=${total * tick}`);
    return tl;
  }

  private beginRun(schedule: PipelineSchedule): void {
    this.resetRun();
    schedule.instructions.forEach((ins, i) => {
      const card = this.cards[i];
      drawFace(card, ins.name, CARD_COLORS[i % CARD_COLORS.length]);
      card.mesh.position.set(ENTRY_X, CARD_Y, BELT_Z);
    });
    this.boardEls.seq.textContent = `${schedule.sequentialTicks} ticks`;
    this.boardEls.pipe.textContent = `0 / ${schedule.totalTicks} ticks`;
    this.boardEls.status.textContent = 'The line is empty — cards are about to enter.';
  }

  private finishRun(schedule: PipelineSchedule): void {
    this.hideBubbles();
    this.boardEls.pipe.textContent = `${schedule.totalTicks} / ${schedule.totalTicks} ticks`;
    this.boardEls.status.textContent = `Done in ${schedule.totalTicks} ticks — one at a time would have taken ${schedule.sequentialTicks}.`;
  }

  /** Everything on the line for one tick: cards slide, stations light, clerks nudge, the board updates. */
  private playTick(schedule: PipelineSchedule, k: number, tick: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    const now = schedule.ticks[k];
    const before = k > 0 ? schedule.ticks[k - 1] : null;
    const slide = tick * TIMING.pipelineSlideShare;
    const reduced = reducedMotion();

    // Board and bubbles are plain state changes at the start of the tick.
    tl.call(() => {
      this.hideBubbles();
      this.boardEls.pipe.textContent = `${k + 1} / ${schedule.totalTicks} ticks`;
      this.boardEls.status.textContent = this.statusFor(schedule, k);
    }, undefined, 0);

    // A bubble: an empty slot that has nothing to do this tick.
    for (const s of STAGES) {
      const slotNow = now[s];
      if (slotNow && 'bubble' in slotNow) {
        tl.call(() => this.showBubble(STATION_X[s]), undefined, 0);
      }
    }

    // Each card: enter, advance, wait, or leave.
    schedule.instructions.forEach((_, i) => {
      const card = this.cards[i];
      const at = slotOf(now, i);
      const was = before ? slotOf(before, i) : null;

      if (at && !was) {
        tl.call(() => {
          card.mesh.visible = true;
          card.mesh.scale.setScalar(1);
          card.mesh.position.set(ENTRY_X, CARD_Y, BELT_Z);
        }, undefined, 0);
        tl.to(card.mesh.position, { x: STATION_X[at], duration: slide, ease: 'power2.out' }, 0);
      } else if (at && was && at !== was) {
        tl.to(card.mesh.position, { x: STATION_X[at], duration: slide, ease: 'power2.inOut' }, 0);
      } else if (at && was && at === was) {
        // Held: the card waits where it is, glowing amber so the stall reads at a glance.
        tl.call(() => card.body.emissive.setHex(WAIT_COLOR), undefined, 0);
        tl.to(card.body, { emissiveIntensity: 0.9, duration: slide * 0.5, yoyo: true, repeat: 1 }, 0);
      } else if (!at && was) {
        // Finished: it hops up off the Execute station and is absorbed (the result is written back).
        tl.to(card.mesh.position, { y: CARD_Y + 0.35, duration: slide, ease: 'power2.out' }, 0);
        tl.to(card.mesh.scale, { x: 0.01, y: 0.01, z: 0.01, duration: slide }, 0);
        tl.call(() => {
          card.mesh.visible = false;
        }, undefined, slide);
      }
      if (at && (!was || at !== was)) {
        tl.call(() => card.body.emissive.setHex(CARD_COLORS[i % CARD_COLORS.length]), undefined, 0);
      }
    });

    // Cards normally leave at the start of the NEXT tick. The last tick has none, so whatever is still in
    // Execute is absorbed in its closing stretch — the run ends with an empty line.
    if (k === schedule.ticks.length - 1) {
      const leave = Math.max(tick - slide, 0);
      schedule.instructions.forEach((_, i) => {
        if (slotOf(now, i) !== 'E') return;
        const card = this.cards[i];
        tl.to(card.mesh.position, { y: CARD_Y + 0.35, duration: slide, ease: 'power2.out' }, leave);
        tl.to(card.mesh.scale, { x: 0.01, y: 0.01, z: 0.01, duration: slide }, leave);
        tl.call(() => {
          card.mesh.visible = false;
        }, undefined, leave + slide);
      });
    }

    // Stations light up while they hold a card; a bubble tints its station red.
    for (const s of STAGES) {
      const slotNow = now[s];
      const busy = !!slotNow && 'instr' in slotNow;
      const bubble = !!slotNow && 'bubble' in slotNow;
      const color = bubble ? BUBBLE_COLOR : STAGE_COLOR[s];
      tl.call(() => this.pads[s].emissive.setHex(color), undefined, 0);
      tl.to(this.pads[s], { emissiveIntensity: this.glowing ? 0.9 : bubble ? 0.8 : busy ? 0.85 : 0.2, duration: 0.2 }, 0);
    }

    // The clerks lean in when their station works on a card they have just been handed.
    if (!reduced) {
      for (const c of this.clerks) {
        const slotNow = now[c.stage];
        const fresh = !!slotNow && 'instr' in slotNow && !slotNow.held;
        if (fresh) {
          tl.to(c.arm.rotation, { x: c.rest - 0.55, duration: slide * 0.4, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0);
        }
      }
    }
    return tl;
  }

  /** What the board says about this tick, in plain words. All figures come from the schedule and locations.ts. */
  private statusFor(schedule: PipelineSchedule, k: number): string {
    const t = schedule.ticks[k];
    const bubble = schedule.bubbles.find((b) => b.tick === k + 1);
    if (bubble) {
      return bubble.reason === 'memory'
        ? 'Bubble: Execute has nothing to do — the next card is waiting for data from memory.'
        : 'Bubble: Execute has nothing to do — the next card is waiting for an answer from the card ahead.';
    }
    const e = t.E;
    if (e && 'instr' in e && e.held) {
      const ram = locationOf('ram').latencyCycles;
      return `Waiting on memory: the whole line holds. The real wait is about ${ram} cycles — shown here as ${schedule.compressedMemoryTicks} ticks.`;
    }
    const busy = STAGES.filter((s) => t[s] && 'instr' in (t[s] as object)).length;
    if (busy === 3) return 'Fetch, Decode and Execute are all busy at once.';
    if (k === 0) return 'The first card is being fetched.';
    return busy === 0 ? '' : 'The line is filling up.';
  }

  private showBubble(x: number): void {
    const b = this.bubbles.find((m) => !m.visible);
    if (!b) return;
    b.position.set(x, CARD_Y, BELT_Z);
    b.scale.setScalar(1);
    b.visible = true;
  }

  private hideBubbles(): void {
    for (const b of this.bubbles) b.visible = false;
  }

  private resetRun(): void {
    for (const c of this.cards) {
      c.mesh.visible = false;
      c.mesh.scale.setScalar(1);
      c.mesh.position.set(ENTRY_X, CARD_Y, BELT_Z);
      c.body.emissiveIntensity = 0.3;
    }
    this.hideBubbles();
    for (const s of STAGES) {
      this.pads[s].emissive.setHex(STAGE_COLOR[s]);
      this.pads[s].emissiveIntensity = this.glowing ? 0.9 : 0.2;
    }
    for (const c of this.clerks) c.arm.rotation.x = c.rest;
    this.boardEls.pipe.textContent = '–';
    this.boardEls.seq.textContent = '–';
    this.boardEls.status.textContent = '';
  }
}
