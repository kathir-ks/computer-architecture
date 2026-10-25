/**
 * The pipeline as data. A pure, renderer-free simulation of a three-stage line (Fetch, Decode, Execute):
 * the story hands `buildSchedule` a few instructions, the scene plays the result. The scene never infers
 * a hazard and the story never touches a mesh — everything the line shows is in this object.
 *
 * Rules, tick by tick:
 *  - one instruction per stage per tick, and program order is never broken;
 *  - an instruction advances when the next stage is free;
 *  - an instruction reads its operands while it is in Decode, so a consumer may only leave Decode once the
 *    instruction that produces its `needs` has FINISHED Execute in an earlier tick. Until then it waits in
 *    Decode, a bubble goes into Execute, and everything behind it holds its place;
 *  - `execTicks > 1` (a memory access) keeps the instruction in Execute that many ticks and holds the
 *    whole line behind it.
 */

export interface PipelineInstruction {
  name: string;
  /** A value this instruction reads; must be `produces` of an EARLIER instruction to matter. */
  needs?: string;
  produces?: string;
  /** Ticks spent in Execute (default 1). More than 1 stands in for a long memory wait. */
  execTicks?: number;
}

export type StageId = 'F' | 'D' | 'E';

/** An instruction in a stage this tick (`held`: it was already there last tick), a bubble, or nothing. */
export type Slot = { instr: number; held?: true } | { bubble: true } | null;

export interface PipelineTick {
  F: Slot;
  D: Slot;
  E: Slot;
}

export interface Bubble {
  /** 1-based tick in which the empty slot appears. */
  tick: number;
  stage: 'D' | 'E';
  /** `memory` when the producer being waited on was a long memory access, `dependency` otherwise. */
  reason: 'dependency' | 'memory';
}

export interface PipelineSchedule {
  /** The input, with `execTicks` filled in. Instruction indices in `ticks` refer to this list. */
  instructions: ReadonlyArray<Required<Pick<PipelineInstruction, 'name' | 'execTicks'>> & PipelineInstruction>;
  ticks: PipelineTick[];
  /** Ticks to finish everything on the line. */
  totalTicks: number;
  /** Ticks if each instruction ran start to finish before the next began. */
  sequentialTicks: number;
  bubbles: Bubble[];
  /** The longest `execTicks` above 1 — the on-screen stand-in for a long memory wait (0 if there is none). */
  compressedMemoryTicks: number;
}

const BUBBLE = Symbol('bubble');
type Occupant = number | typeof BUBBLE | null;

const MAX_TICKS = 10_000;

export function buildSchedule(input: readonly PipelineInstruction[]): PipelineSchedule {
  const instrs = input.map((i, index) => {
    const execTicks = i.execTicks ?? 1;
    if (!Number.isInteger(execTicks) || execTicks < 1) {
      throw new RangeError(`instruction ${index} ("${i.name}"): execTicks must be a whole number of at least 1`);
    }
    return { ...i, execTicks };
  });
  const n = instrs.length;

  // The latest EARLIER instruction that produces what each instruction needs (null: nothing to wait for).
  const producer: Array<number | null> = instrs.map((ins, c) => {
    if (!ins.needs) return null;
    for (let p = c - 1; p >= 0; p--) if (instrs[p].produces === ins.needs) return p;
    return null;
  });

  const sequentialTicks = instrs.reduce((sum, i) => sum + 3 + (i.execTicks - 1), 0);
  const compressedMemoryTicks = Math.max(0, ...instrs.map((i) => (i.execTicks > 1 ? i.execTicks : 0)));

  const ticks: PipelineTick[] = [];
  const bubbles: Bubble[] = [];
  // Tick in which each instruction finished Execute (0 = not yet).
  const doneAt: number[] = new Array<number>(n).fill(0);

  let F: Occupant = n > 0 ? 0 : null;
  let D: Occupant = null;
  let E: Occupant = null;
  let eLeft = 0;
  let fetched = n > 0 ? 1 : 0;
  let prev: { F: Occupant; D: Occupant; E: Occupant } = { F: null, D: null, E: null };

  const slot = (now: Occupant, before: Occupant): Slot => {
    if (now === BUBBLE) return { bubble: true };
    if (now === null) return null;
    return now === before ? { instr: now, held: true } : { instr: now };
  };

  for (let t = 1; n > 0; t++) {
    if (t > MAX_TICKS) throw new Error('pipeline schedule did not finish');

    ticks.push({ F: slot(F, prev.F), D: slot(D, prev.D), E: slot(E, prev.E) });
    prev = { F, D, E };

    // ---- Execute: a long access keeps its place; anything else leaves and its result is written back ----
    let nE: Occupant = null;
    let nELeft = 0;
    let eFree = true;
    if (typeof E === 'number') {
      if (eLeft > 1) {
        nE = E;
        nELeft = eLeft - 1;
        eFree = false;
      } else {
        doneAt[E] = t;
      }
    }

    // ---- Decode: needs its producer finished in an EARLIER tick, and a free Execute stage ----
    let nD: Occupant = null;
    if (typeof D === 'number') {
      const p = producer[D];
      const ready = p === null || (doneAt[p] > 0 && doneAt[p] < t);
      if (ready && eFree) {
        nE = D;
        nELeft = instrs[D].execTicks;
      } else {
        nD = D; // waits (either on its operand or because Execute is busy)
        if (!ready && eFree) {
          nE = BUBBLE;
          bubbles.push({ tick: t + 1, stage: 'E', reason: p !== null && instrs[p].execTicks > 1 ? 'memory' : 'dependency' });
        }
      }
    }

    // ---- Fetch: moves into Decode if it is free, otherwise holds; then the next card is fetched ----
    let nF: Occupant = null;
    if (typeof F === 'number') {
      if (nD === null) nD = F;
      else nF = F;
    }
    if (nF === null && fetched < n) nF = fetched++;

    F = nF;
    D = nD;
    E = nE;
    eLeft = nELeft;

    if (F === null && D === null && typeof E !== 'number') break; // everything has left the line
  }

  return {
    instructions: instrs,
    ticks,
    totalTicks: ticks.length,
    sequentialTicks,
    bubbles,
    compressedMemoryTicks,
  };
}
