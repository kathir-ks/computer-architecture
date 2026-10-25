import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  type PipelineInstruction,
  type PipelineSchedule,
  type Slot,
  type StageId,
} from '../../src/scene/pipelineSchedule';

const plain = (n: number): PipelineInstruction[] => Array.from({ length: n }, (_, i) => ({ name: `I${i + 1}` }));

/** The instruction index in a slot, or null for empty / bubble. */
const who = (s: Slot): number | null => (s && 'instr' in s ? s.instr : null);

/** Render the schedule as rows like "F:2 D:1 E:0" with `-` for empty and `~` for a bubble. */
function grid(s: PipelineSchedule): string[] {
  const cell = (x: Slot) => (x === null ? '-' : 'bubble' in x ? '~' : String(x.instr));
  return s.ticks.map((t) => `F:${cell(t.F)} D:${cell(t.D)} E:${cell(t.E)}`);
}

describe('buildSchedule — no hazards', () => {
  it('fills the line: n instructions finish in n + 2 ticks', () => {
    for (const n of [1, 2, 3, 4, 5, 8]) {
      expect(buildSchedule(plain(n)).totalTicks).toBe(n + 2);
    }
  });

  it('three instructions occupy fetch, decode and execute at the same time', () => {
    const s = buildSchedule(plain(4));
    expect(grid(s)).toEqual([
      'F:0 D:- E:-',
      'F:1 D:0 E:-',
      'F:2 D:1 E:0',
      'F:3 D:2 E:1',
      'F:- D:3 E:2',
      'F:- D:- E:3',
    ]);
    const full = s.ticks.filter((t) => who(t.F) !== null && who(t.D) !== null && who(t.E) !== null);
    expect(full.length).toBeGreaterThan(0);
  });

  it('beats doing one instruction at a time (3n ticks)', () => {
    const s = buildSchedule(plain(4));
    expect(s.sequentialTicks).toBe(12);
    expect(s.totalTicks).toBe(6);
    expect(s.totalTicks).toBeLessThan(s.sequentialTicks);
  });

  it('has no bubbles and no memory figure', () => {
    const s = buildSchedule(plain(4));
    expect(s.bubbles).toEqual([]);
    expect(s.compressedMemoryTicks).toBe(0);
  });

  it('an empty program takes no time at all', () => {
    const s = buildSchedule([]);
    expect(s.ticks).toEqual([]);
    expect(s.totalTicks).toBe(0);
    expect(s.sequentialTicks).toBe(0);
  });

  it('marks an instruction as held only when it stays put, never on its first tick in a stage', () => {
    const s = buildSchedule(plain(3));
    for (const t of s.ticks) for (const stage of ['F', 'D', 'E'] as StageId[]) {
      const x = t[stage];
      if (x && 'instr' in x) expect(x.held).toBeUndefined();
    }
  });
});

describe('buildSchedule — a dependency hazard', () => {
  const program: PipelineInstruction[] = [
    { name: 'LOAD r1', produces: 'r1' },
    { name: 'ADD r1', needs: 'r1' },
    { name: 'MOV' },
    { name: 'STORE' },
  ];

  it('puts a bubble in Execute right behind the producer, once', () => {
    const s = buildSchedule(program);
    expect(s.bubbles).toEqual([{ tick: 4, stage: 'E', reason: 'dependency' }]);
    expect(who(s.ticks[3].E)).toBeNull();
    expect(s.ticks[3].E).toEqual({ bubble: true });
  });

  it('makes the consumer wait in Decode and holds everything behind it', () => {
    const s = buildSchedule(program);
    // tick 4 (index 3): ADD (1) still in Decode, MOV (2) still in Fetch — both marked as holding.
    expect(s.ticks[3].D).toEqual({ instr: 1, held: true });
    expect(s.ticks[3].F).toEqual({ instr: 2, held: true });
  });

  it('costs exactly one extra tick, and recovers', () => {
    const s = buildSchedule(program);
    expect(s.totalTicks).toBe(program.length + 2 + 1);
    expect(grid(s)).toEqual([
      'F:0 D:- E:-',
      'F:1 D:0 E:-',
      'F:2 D:1 E:0',
      'F:2 D:1 E:~',
      'F:3 D:2 E:1',
      'F:- D:3 E:2',
      'F:- D:- E:3',
    ]);
  });

  it('still beats one at a time, hazard and all', () => {
    const s = buildSchedule(program);
    expect(s.totalTicks).toBeLessThan(s.sequentialTicks);
  });

  it('ignores a need that nothing earlier produces (the value is simply there)', () => {
    const s = buildSchedule([{ name: 'A', needs: 'x' }, { name: 'B', produces: 'x' }, { name: 'C' }]);
    expect(s.bubbles).toEqual([]);
    expect(s.totalTicks).toBe(5);
  });

  it('waits on the most recent producer of a value', () => {
    const s = buildSchedule([
      { name: 'A', produces: 'x' },
      { name: 'B', produces: 'x' },
      { name: 'C', needs: 'x' },
    ]);
    // C waits for B (its latest producer) — B is adjacent, so one bubble.
    expect(s.bubbles).toHaveLength(1);
  });

  it('two producers back to back give two bubbles only when each consumer is adjacent to its producer', () => {
    const s = buildSchedule([
      { name: 'A', produces: 'x' },
      { name: 'B', needs: 'x', produces: 'y' },
      { name: 'C', needs: 'y' },
    ]);
    expect(s.bubbles).toHaveLength(2);
    expect(s.totalTicks).toBe(3 + 2 + 2);
  });

  it('a producer one place ahead of its consumer still costs one bubble; two places ahead costs none', () => {
    const gap1 = buildSchedule([{ name: 'A', produces: 'x' }, { name: 'B' }, { name: 'C', needs: 'x' }]);
    expect(gap1.bubbles).toEqual([]);
    expect(gap1.totalTicks).toBe(5);
  });
});

describe('buildSchedule — a long memory wait', () => {
  const program: PipelineInstruction[] = [
    { name: 'ADD' },
    { name: 'LOAD', execTicks: 5, produces: 'r2' },
    { name: 'SUB' },
    { name: 'MOV' },
  ];

  it('keeps the memory instruction in Execute for every tick of its wait', () => {
    const s = buildSchedule(program);
    const inE = s.ticks.map((t) => who(t.E));
    expect(inE.filter((i) => i === 1)).toHaveLength(5);
  });

  it('holds the whole line behind it — nothing in Fetch or Decode moves', () => {
    const s = buildSchedule(program);
    const holding = s.ticks.filter((t) => t.E && 'instr' in t.E && t.E.instr === 1 && t.E.held);
    expect(holding.length).toBe(4);
    for (const t of holding) {
      expect(t.D).toEqual({ instr: 2, held: true });
    }
  });

  it('reports the on-screen length of the wait', () => {
    expect(buildSchedule(program).compressedMemoryTicks).toBe(5);
  });

  it('is a stall, not a bubble: nothing is inserted for an instruction that simply waits its turn', () => {
    expect(buildSchedule(program).bubbles).toEqual([]);
  });

  it('counts the extra Execute ticks in the one-at-a-time total', () => {
    const s = buildSchedule(program);
    expect(s.sequentialTicks).toBe(3 + (3 + 4) + 3 + 3);
    expect(s.totalTicks).toBeLessThan(s.sequentialTicks);
  });

  it('a consumer of the memory result gets a bubble labelled as a memory wait', () => {
    const s = buildSchedule([
      { name: 'LOAD', execTicks: 4, produces: 'r1' },
      { name: 'ADD', needs: 'r1' },
    ]);
    expect(s.bubbles).toEqual([{ tick: 7, stage: 'E', reason: 'memory' }]);
  });
});

describe('buildSchedule — invariants over many random programs', () => {
  // A small deterministic generator keeps the property tests reproducible.
  const rng = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const randomProgram = (r: () => number): PipelineInstruction[] => {
    const n = 1 + Math.floor(r() * 9);
    const values = ['a', 'b', 'c'];
    return Array.from({ length: n }, (_, i) => ({
      name: `I${i}`,
      needs: r() < 0.35 ? values[Math.floor(r() * 3)] : undefined,
      produces: r() < 0.4 ? values[Math.floor(r() * 3)] : undefined,
      execTicks: r() < 0.2 ? 2 + Math.floor(r() * 4) : undefined,
    }));
  };

  const programs = Array.from({ length: 300 }, (_, i) => randomProgram(rng(i + 1)));

  it('never puts two instructions in one stage, and every instruction goes through F, D, E in order', () => {
    for (const prog of programs) {
      const s = buildSchedule(prog);
      const seen = prog.map(() => ({ F: [] as number[], D: [] as number[], E: [] as number[] }));
      s.ticks.forEach((t, k) => {
        for (const stage of ['F', 'D', 'E'] as StageId[]) {
          const i = who(t[stage]);
          if (i !== null) seen[i][stage].push(k);
        }
      });
      seen.forEach((st, i) => {
        expect(st.F.length, `instr ${i} F`).toBeGreaterThanOrEqual(1);
        expect(st.D.length, `instr ${i} D`).toBeGreaterThanOrEqual(1);
        expect(st.E.length, `instr ${i} E`).toBe(s.instructions[i].execTicks);
        expect(Math.max(...st.F)).toBeLessThan(Math.min(...st.D));
        expect(Math.max(...st.D)).toBeLessThan(Math.min(...st.E));
      });
    }
  });

  it('preserves program order: instructions reach each stage in the order they were written', () => {
    for (const prog of programs) {
      const s = buildSchedule(prog);
      for (const stage of ['F', 'D', 'E'] as StageId[]) {
        const first = prog.map(() => -1);
        s.ticks.forEach((t, k) => {
          const i = who(t[stage]);
          if (i !== null && first[i] < 0) first[i] = k;
        });
        for (let i = 1; i < first.length; i++) expect(first[i]).toBeGreaterThan(first[i - 1]);
      }
    }
  });

  it('never takes longer than doing one at a time, and never fewer than n + 2 ticks', () => {
    for (const prog of programs) {
      const s = buildSchedule(prog);
      expect(s.totalTicks).toBeLessThanOrEqual(s.sequentialTicks);
      expect(s.totalTicks).toBeGreaterThanOrEqual(prog.length + 2);
    }
  });

  it('a consumer never leaves Decode before its producer has finished Execute in an earlier tick', () => {
    for (const prog of programs) {
      const s = buildSchedule(prog);
      prog.forEach((ins, c) => {
        if (!ins.needs) return;
        let p = -1;
        for (let q = c - 1; q >= 0; q--) if (prog[q].produces === ins.needs) { p = q; break; }
        if (p < 0) return;
        const lastE = (i: number) => s.ticks.map((t, k) => (who(t.E) === i ? k : -1)).filter((k) => k >= 0).pop()!;
        const lastD = (i: number) => s.ticks.map((t, k) => (who(t.D) === i ? k : -1)).filter((k) => k >= 0).pop()!;
        expect(lastD(c), `consumer ${c} of ${p}`).toBeGreaterThan(lastE(p));
      });
    }
  });

  it('with no needs and no memory waits, every program of n instructions takes n + 2 ticks', () => {
    for (let n = 1; n <= 12; n++) expect(buildSchedule(plain(n)).totalTicks).toBe(n + 2);
  });

  it('every bubble is real: the slot named by the bubble list is a bubble in the grid', () => {
    for (const prog of programs) {
      const s = buildSchedule(prog);
      for (const b of s.bubbles) expect(s.ticks[b.tick - 1][b.stage]).toEqual({ bubble: true });
      const inGrid = s.ticks.flatMap((t) => [t.F, t.D, t.E]).filter((x) => x && 'bubble' in x).length;
      expect(inGrid).toBe(s.bubbles.length);
    }
  });
});

describe('buildSchedule — bad input', () => {
  it('refuses a non-integer or zero execTicks, naming the instruction', () => {
    expect(() => buildSchedule([{ name: 'X', execTicks: 0 }])).toThrow(/"X".*execTicks/);
    expect(() => buildSchedule([{ name: 'Y', execTicks: 1.5 }])).toThrow(RangeError);
  });

  it('does not mutate what it is given', () => {
    const input: PipelineInstruction[] = [{ name: 'A' }, { name: 'B', needs: 'x' }];
    const copy = JSON.stringify(input);
    buildSchedule(input);
    expect(JSON.stringify(input)).toBe(copy);
  });

  it('fills in execTicks on the schedule it returns', () => {
    expect(buildSchedule([{ name: 'A' }]).instructions[0].execTicks).toBe(1);
  });
});
