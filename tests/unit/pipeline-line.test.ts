import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PipelineLine, MAX_PIPELINE_CARDS } from '../../src/scene/PipelineLine';
import { Materials } from '../../src/scene/materials';
import { buildSchedule } from '../../src/scene/pipelineSchedule';
import { locationOf } from '../../src/scene/locations';
import { setMotionProvider } from '../../src/scene/motion';
import { TIMING } from '../../src/scene/timing';
import { PIPELINE_PROGRAMS } from '../../src/story/chapters/ch9-pipelining';

// jsdom has no 2D canvas; the line copes (cards are plain slabs), but keep the test output quiet.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(() => setMotionProvider(null));

const X = { F: -3.0, D: 0.1, E: 3.2 } as const;

interface Peek {
  cards: Array<{ mesh: THREE.Mesh }>;
  bubbles: THREE.Mesh[];
  boardEls: { pipe: HTMLElement; seq: HTMLElement; status: HTMLElement };
  clerks: Array<{ group: THREE.Group }>;
}

let line: PipelineLine;
let peek: Peek;
beforeEach(() => {
  line = new PipelineLine(new THREE.Scene(), new Materials());
  peek = line as unknown as Peek;
});

/** Play a timeline to a moment and leave it there. */
const at = (tl: gsap.core.Timeline, seconds: number) => {
  tl.pause();
  tl.time(seconds);
  return tl;
};

/** Seconds into a run that is safely inside tick `k` (index from 0), after its slides have finished. */
const inTick = (k: number) => (k + 1) * TIMING.pipelineTick - 0.05;

const visibleCards = () => peek.cards.filter((c) => c.mesh.visible);
const xOfCard = (i: number) => peek.cards[i].mesh.position.x;

describe('PipelineLine — presence', () => {
  it('starts folded away', () => {
    expect(line.group.visible).toBe(false);
    expect(line.isSetUp).toBe(false);
  });

  it('setup brings in the belt and the clerks, and setting up twice changes nothing', () => {
    line.setup().progress(1);
    expect(line.group.visible).toBe(true);
    expect(line.isSetUp).toBe(true);
    const clerk = peek.clerks[0].group.position.clone();

    line.setup().progress(1);
    expect(line.isSetUp).toBe(true);
    expect(peek.clerks[0].group.position.equals(clerk)).toBe(true);
  });

  it('the clerks walk in from the lift to their stations', () => {
    const tl = line.setup();
    tl.pause();
    tl.time(0);
    const start = peek.clerks[0].group.position.x;
    tl.progress(1);
    expect(start).toBeLessThan(X.F); // started over by the lift
    expect(peek.clerks[0].group.position.x).toBeCloseTo(X.F);
    expect(peek.clerks[1].group.position.x).toBeCloseTo(X.D);
  });

  it('teardown folds it all away, and doing it twice is harmless', () => {
    line.setup().progress(1);
    line.teardown().progress(1);
    expect(line.group.visible).toBe(false);
    expect(line.isSetUp).toBe(false);
    line.teardown().progress(1);
    expect(line.group.visible).toBe(false);
  });

  it('setup is quicker under reduced motion', () => {
    const normal = line.setup().duration();
    setMotionProvider(() => true);
    expect(line.setup().duration()).toBeLessThan(normal);
  });
});

describe('PipelineLine — running a schedule', () => {
  const fill = () => buildSchedule(PIPELINE_PROGRAMS.fill);

  it('lasts exactly one tick length per scheduled tick', () => {
    const s = fill();
    expect(line.run(s).duration()).toBeCloseTo(s.totalTicks * TIMING.pipelineTick);
  });

  it('fast-forward plays each tick at its shorter length', () => {
    const s = fill();
    expect(line.run(s, { fastForward: true }).duration()).toBeCloseTo(
      s.totalTicks * TIMING.pipelineTick * TIMING.pipelineFastShare,
    );
  });

  it('puts the line up by itself if it is not set up yet', () => {
    line.run(fill()).progress(1);
    expect(line.isSetUp).toBe(true);
  });

  it('builds the timeline without touching the scene (verbs are built up front, played later)', () => {
    line.run(fill());
    expect(line.group.visible).toBe(false);
    expect(visibleCards()).toHaveLength(0);
  });

  it('shows three cards in three stations at the same time once the line is full', () => {
    const tl = at(line.run(fill()), inTick(2));
    expect(visibleCards()).toHaveLength(3);
    expect(xOfCard(0)).toBeCloseTo(X.E);
    expect(xOfCard(1)).toBeCloseTo(X.D);
    expect(xOfCard(2)).toBeCloseTo(X.F);
    tl.kill();
  });

  it('the board compares the pipelined tick count with doing one card at a time', () => {
    const s = fill();
    const tl = at(line.run(s), inTick(2));
    expect(peek.boardEls.seq.textContent).toBe(`${s.sequentialTicks} ticks`);
    expect(peek.boardEls.pipe.textContent).toBe(`3 / ${s.totalTicks} ticks`);
    expect(peek.boardEls.status.textContent).toMatch(/all busy at once/);
    tl.kill();
  });

  it('at the end every card has been absorbed and the board states the result', () => {
    const s = fill();
    line.run(s).progress(1);
    expect(visibleCards()).toHaveLength(0);
    expect(peek.boardEls.pipe.textContent).toBe(`${s.totalTicks} / ${s.totalTicks} ticks`);
    expect(peek.boardEls.status.textContent).toContain(`${s.totalTicks} ticks`);
    expect(peek.boardEls.status.textContent).toContain(`${s.sequentialTicks}`);
  });

  it('refuses a program with more cards than the line has room for', () => {
    const big = buildSchedule(Array.from({ length: MAX_PIPELINE_CARDS + 1 }, (_, i) => ({ name: `I${i}` })));
    expect(() => line.run(big)).toThrow(RangeError);
  });
});

describe('PipelineLine — hazards and stalls', () => {
  it('a dependency shows one bubble in Execute, says why, and then recovers', () => {
    const s = buildSchedule(PIPELINE_PROGRAMS.hazard);
    const tick = s.bubbles[0].tick; // 1-based
    const tl = line.run(s);
    at(tl, inTick(tick - 1));

    const shown = peek.bubbles.filter((b) => b.visible);
    expect(shown).toHaveLength(1);
    expect(shown[0].position.x).toBeCloseTo(X.E);
    expect(peek.boardEls.status.textContent).toMatch(/^Bubble/);
    expect(peek.boardEls.status.textContent).toMatch(/card ahead/);

    at(tl, inTick(tick)); // the next tick: the bubble has gone
    expect(peek.bubbles.filter((b) => b.visible)).toHaveLength(0);
    tl.kill();
  });

  it('the stalled cards hold their place while the bubble passes', () => {
    const s = buildSchedule(PIPELINE_PROGRAMS.hazard);
    const bubbleTick = s.bubbles[0].tick;
    const tl = line.run(s);
    at(tl, inTick(bubbleTick - 2));
    const before = [xOfCard(1), xOfCard(2)];
    at(tl, inTick(bubbleTick - 1));
    // card 1 (the consumer) is still in Decode and card 2 still in Fetch
    expect(xOfCard(1)).toBeCloseTo(before[0]);
    expect(xOfCard(2)).toBeCloseTo(before[1]);
    expect(xOfCard(1)).toBeCloseTo(X.D);
    tl.kill();
  });

  it('a long memory wait holds the whole line and quotes the real figure from locations.ts', () => {
    const s = buildSchedule(PIPELINE_PROGRAMS.memory);
    const tl = line.run(s);
    // the second tick the memory card has been in Execute (it is held)
    const heldTick = s.ticks.findIndex((t) => t.E && 'instr' in t.E && t.E.instr === 1 && t.E.held);
    at(tl, inTick(heldTick));
    expect(peek.boardEls.status.textContent).toContain(String(locationOf('ram').latencyCycles));
    expect(peek.boardEls.status.textContent).toContain(`${s.compressedMemoryTicks} ticks`);
    expect(xOfCard(1)).toBeCloseTo(X.E); // stuck in Execute
    expect(xOfCard(2)).toBeCloseTo(X.D); // everyone behind it is held
    expect(xOfCard(3)).toBeCloseTo(X.F);
    tl.kill();
  });
});

describe('PipelineLine — interrupted', () => {
  it('a chapter jump mid-run (timeline killed) leaves nothing behind once the line is torn down', () => {
    const tl = at(line.run(buildSchedule(PIPELINE_PROGRAMS.hazard)), inTick(3));
    expect(visibleCards().length).toBeGreaterThan(0);
    tl.kill();

    line.teardown().progress(1);
    expect(line.group.visible).toBe(false);
    expect(visibleCards()).toHaveLength(0);
    expect(peek.bubbles.filter((b) => b.visible)).toHaveLength(0);
    expect(peek.boardEls.status.textContent).toBe('');
  });

  it('a second run starts clean even if the first never finished', () => {
    at(line.run(buildSchedule(PIPELINE_PROGRAMS.hazard)), inTick(4)).kill();
    const tl = at(line.run(buildSchedule(PIPELINE_PROGRAMS.fill)), 0.01);
    expect(peek.bubbles.filter((b) => b.visible)).toHaveLength(0);
    expect(visibleCards().length).toBeLessThanOrEqual(1);
    tl.kill();
  });

  it('hover glow works while the line is folded away and survives a run', () => {
    line.setGlow(true);
    line.run(buildSchedule(PIPELINE_PROGRAMS.fill)).progress(1);
    line.setGlow(false);
    expect(line.group.visible).toBe(true);
  });
});
