import { beforeEach, describe, expect, it } from 'vitest';
import gsap from 'gsap';
import { CHAPTERS } from '../../src/story/chapters';
import type { SceneVerbs } from '../../src/scene';
import { CycleLedger } from '../../src/scene/telemetry/ledger';
import { AccessTracker, type TrackedVerbs } from '../../src/scene/telemetry/tracker';
import { locationOf } from '../../src/scene/locations';
import { applyOutcome, emptyScoreboard, fire, type FreePlayOutcome, type Op, type Target } from '../../src/story/freeplay';

/** A real gsap timeline of a fixed length: enough for the tracker to hang its callbacks and meter on. */
const span = (seconds: number): gsap.core.Timeline => {
  const tl = gsap.timeline();
  tl.to({}, { duration: seconds });
  return tl;
};

/** Stand-in for Scene: every contract verb returns a real timeline of a plausible length. */
function recorder(): SceneVerbs {
  let nextPulse = 1;
  return {
    flyTo: () => span(1),
    reveal: () => span(0.6),
    flash: () => span(0.5),
    workerWork: () => span(1),
    drawer: () => span(1),
    dispenseTicket: () => span(1),
    showCard: () => span(1),
    splitCard: () => span(1),
    spawnPulse: () => ({ id: nextPulse++, tl: span(0.35) }),
    carry: () => span(3),
    courierTrip: () => span(3),
    deliver: () => span(1),
    setMood: () => span(1),
  };
}

let ledger: CycleLedger;
let verbs: SceneVerbs;

beforeEach(() => {
  ledger = new CycleLedger();
  const raw = recorder();
  // Exactly the wiring Scene uses: the tracker wraps the six tracked verbs, the rest pass through.
  verbs = { ...raw, ...new AccessTracker(ledger).wrap(raw as TrackedVerbs) };
});

/** Build a step's timeline and play it to its end. */
function playStep(chapter: number, step: number): void {
  const tl = CHAPTERS[chapter - 1].steps[step].cue(verbs);
  tl.pause();
  tl.progress(1);
}

const now = () => ledger.snapshot();

describe('AccessTracker — chapter 5 (happy path: L1 hit)', () => {
  it('shows the L1 hit, then the 4-cycle trip, then the Worker computing', () => {
    playStep(5, 0);
    expect(now().current!.probes).toEqual([{ level: 'l1d', result: 'hit' }]); // the second flash is a duplicate
    expect(now().current!.served).toBeNull();
    expect(now().idleCycles).toBe(0);

    playStep(5, 1);
    const j = now().current!;
    expect(j).toMatchObject({ served: 'l1d', cycles: 4, done: true, kind: 'load' });
    expect(now().idleCycles).toBe(4);
    expect(now().workingCycles).toBe(1);

    playStep(5, 2); // drawer, mood, idle: nothing costs cycles
    expect(now().idleCycles).toBe(4);
    expect(now().workingCycles).toBe(1);
  });
});

describe('AccessTracker — chapter 6 (miss cascade to RAM)', () => {
  it('lists L1 then L2 as misses once, serves RAM, and ends at exactly 200', () => {
    playStep(6, 0);
    playStep(6, 1);
    expect(now().current!.probes).toEqual([
      { level: 'l1d', result: 'miss' },
      { level: 'l2', result: 'miss' }, // flashed twice, listed once
    ]);

    playStep(6, 2);
    expect(now().current).toMatchObject({ served: 'ram', cycles: 200, done: true });
    expect(now().idleCycles).toBe(200);
    expect(now().workingCycles).toBe(0);

    playStep(6, 3); // foot-tap only
    expect(now().idleCycles).toBe(200);
  });

  it('grows the meter during the ride, never backwards, and ends exactly on the latency', () => {
    playStep(6, 0);
    playStep(6, 1);
    const tl = CHAPTERS[5].steps[2].cue(verbs);
    tl.pause();

    const readings: number[] = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      tl.time((tl.duration() * i) / steps);
      readings.push(now().idleCycles);
    }

    for (let i = 1; i < readings.length; i++) expect(readings[i]).toBeGreaterThanOrEqual(readings[i - 1]);
    expect(readings.some((r) => r > 0 && r < 200)).toBe(true);
    expect(readings.at(-1)).toBe(200);
  });

  it('is still counting mid-ride, and a chapter jump leaves nothing behind', () => {
    playStep(6, 0);
    playStep(6, 1);
    const tl = CHAPTERS[5].steps[2].cue(verbs);
    tl.pause();
    tl.time(tl.duration() * 0.6);

    const mid = now();
    expect(mid.current!.served).toBe('ram');
    expect(mid.current!.done).toBe(false);
    expect(mid.idleCycles).toBeGreaterThan(0);
    expect(mid.idleCycles).toBeLessThan(200);

    // The story engine kills the timeline and main.ts resets telemetry.
    tl.kill();
    ledger.reset();
    expect(now()).toEqual({ current: null, idleCycles: 0, workingCycles: 0, elapsedCycles: 0 });
  });
});

describe('AccessTracker — chapter 7 (the disk trip)', () => {
  it('ignores the focus flash, then costs the full 4,000,000 on the courier trip', () => {
    playStep(7, 0);
    expect(now().current).toBeNull(); // 'focus' is not a probe

    playStep(7, 1);
    expect(now().current).toMatchObject({ served: 'disk', cycles: 4_000_000, done: true });
    expect(now().idleCycles).toBe(4_000_000);
  });

  it('then shows the next access hitting L1 and L1i without adding any wait', () => {
    playStep(7, 0);
    playStep(7, 1);
    playStep(7, 2);
    expect(now().current!.probes).toEqual([
      { level: 'l1d', result: 'hit' },
      { level: 'l1i', result: 'hit' },
    ]);
    expect(now().current!.served).toBeNull();
    expect(now().idleCycles).toBe(4_000_000);
  });
});

describe('AccessTracker — what it must not do', () => {
  it('never touches the ledger while a cue is only being built', () => {
    const before = now();
    const tl = CHAPTERS[5].steps[2].cue(verbs); // built, never played
    expect(now()).toEqual(before);
    tl.kill();
  });

  it('ignores every verb of chapters that make no access (1, 2, 4, 8)', () => {
    for (const ch of [1, 2, 4, 8]) {
      for (let s = 0; s < CHAPTERS[ch - 1].steps.length; s++) playStep(ch, s);
    }
    // Chapters 1, 2, 4 and 8 only do idle/compute/read-card work and 'focus' flashes.
    expect(now().current).toBeNull();
    expect(now().idleCycles).toBe(0);
  });

  it('chapter 3 (fetch) counts the instruction trip from L1i and the card reading', () => {
    for (let s = 0; s < CHAPTERS[2].steps.length; s++) playStep(3, s);
    expect(now().current).toMatchObject({ served: 'l1i', cycles: 4, done: true });
    expect(now().workingCycles).toBeGreaterThanOrEqual(1);
  });
});

/** Mirrors the journey wireFreePlay builds in main.ts, verb for verb. */
function freePlayJourney(v: SceneVerbs, outcome: FreePlayOutcome): gsap.core.Timeline {
  const tl = gsap.timeline();
  const ladder = ['l1d', 'l2', 'ram', 'disk'] as const;
  const depth = ladder.indexOf(outcome.resolved);
  for (let i = 0; i < depth; i++) tl.add(v.flash(ladder[i], 'miss'));
  tl.add(v.flash(outcome.resolved, outcome.hit ? 'hit' : 'focus'));

  if (outcome.op === 'STORE') {
    const pulse = v.spawnPulse('registers', 'data');
    tl.add(pulse.tl);
    if (outcome.resolved === 'disk') {
      tl.add(v.courierTrip(pulse.id, { fastForward: true }));
      tl.add(v.deliver(pulse.id, 'disk'));
    } else {
      tl.add(v.carry(pulse.id, 'registers', outcome.resolved));
      tl.add(v.deliver(pulse.id, outcome.resolved));
    }
  } else {
    const pulse = v.spawnPulse(outcome.resolved, 'data');
    tl.add(pulse.tl);
    if (outcome.resolved === 'disk') tl.add(v.courierTrip(pulse.id, { fastForward: true }));
    else tl.add(v.carry(pulse.id, outcome.resolved, 'registers'));
    tl.add(v.deliver(pulse.id, 'worker'));
    tl.add(v.workerWork(outcome.op === 'ADD' ? 'compute' : 'idle'));
  }
  return tl;
}

function playFreePlay(op: Op, resolved: FreePlayOutcome['resolved']): void {
  const outcome: FreePlayOutcome = {
    op,
    resolved,
    cycles: locationOf(resolved).latencyCycles,
    hit: resolved === 'l1d',
  };
  const tl = freePlayJourney(verbs, outcome);
  tl.pause();
  tl.progress(1);
}

describe('AccessTracker — free play', () => {
  it('LOAD from RAM: L1 and L2 miss, RAM serves, the wait is 200', () => {
    playFreePlay('LOAD', 'ram');
    expect(now().current).toMatchObject({
      kind: 'load',
      served: 'ram',
      cycles: 200,
      done: true,
      probes: [
        { level: 'l1d', result: 'miss' },
        { level: 'l2', result: 'miss' },
      ],
    });
  });

  it('LOAD that hits L1d probes it as a hit and waits 4', () => {
    playFreePlay('LOAD', 'l1d');
    expect(now().current).toMatchObject({
      served: 'l1d',
      cycles: 4,
      probes: [{ level: 'l1d', result: 'hit' }],
    });
  });

  it('STORE goes outward: the direction is recorded and the target level is charged', () => {
    playFreePlay('STORE', 'l2');
    expect(now().current).toMatchObject({ kind: 'store', served: 'l2', cycles: 12, done: true });
  });

  it('STORE to disk and LOAD from disk both ride the courier, told apart by where the pulse began', () => {
    playFreePlay('STORE', 'disk');
    expect(now().current).toMatchObject({ kind: 'store', served: 'disk', cycles: 4_000_000, done: true });
    playFreePlay('LOAD', 'disk');
    expect(now().current).toMatchObject({ kind: 'load', served: 'disk', cycles: 4_000_000, done: true });
  });

  it('ADD counts its compute after the wait; LOAD leaves the Worker idle', () => {
    playFreePlay('ADD', 'l2');
    expect(now().workingCycles).toBe(1);
    playFreePlay('LOAD', 'l2');
    expect(now().workingCycles).toBe(1);
    expect(now().idleCycles).toBe(24);
  });

  it('reports the same total wait as the scoreboard for the same fired sequence', () => {
    let seed = 11;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const ops: Op[] = ['LOAD', 'ADD', 'STORE'];
    const targets: Target[] = ['random', 'l1d', 'random', 'l2', 'ram', 'random', 'disk'];

    let board = emptyScoreboard();
    for (let i = 0; i < 24; i++) {
      const outcome = fire(ops[i % 3], targets[i % targets.length], rng);
      board = applyOutcome(board, outcome);
      const tl = freePlayJourney(verbs, outcome);
      tl.pause();
      tl.progress(1);

      // Each journey's final meter value is exactly what the scoreboard charged for that fire.
      const last = ledger.history.at(-1)!;
      expect(last.cycles, `fire ${i} (${outcome.op} ${outcome.resolved})`).toBe(outcome.cycles);
      expect(last.served).toBe(outcome.resolved);
      expect(last.kind).toBe(outcome.op === 'STORE' ? 'store' : 'load');
      // Running total stays in step as the run goes on, not only at the end.
      expect(now().idleCycles).toBe(board.totalCycles);
    }
    expect(board.fired).toBe(24);
    expect(ledger.history).toHaveLength(24);
  });

  it('the hit/miss verdict the ladder shows agrees with the scoreboard for every fire', () => {
    const outcomes: FreePlayOutcome[] = (['l1d', 'l2', 'ram', 'disk'] as const).map((resolved) => ({
      op: 'LOAD',
      resolved,
      cycles: locationOf(resolved).latencyCycles,
      hit: resolved === 'l1d',
    }));
    for (const outcome of outcomes) {
      const tl = freePlayJourney(verbs, outcome);
      tl.pause();
      tl.progress(1);
      const probes = ledger.history.at(-1)!.probes;
      // Everything closer than the answer missed; only an L1d answer is a hit.
      expect(probes.filter((p) => p.result === 'miss').length).toBe(['l1d', 'l2', 'ram', 'disk'].indexOf(outcome.resolved));
      expect(probes.some((p) => p.result === 'hit')).toBe(outcome.hit);
    }
  });
});

describe('AccessTracker — robustness', () => {
  it('a trip that was never delivered does not corrupt the next journey', () => {
    const tl = verbs.carry(verbs.spawnPulse('ram', 'data').id, 'ram', 'registers');
    tl.pause();
    tl.progress(1); // no deliver
    expect(now().current).toMatchObject({ served: 'ram', done: false });

    playFreePlay('LOAD', 'l1d');
    expect(now().current).toMatchObject({ served: 'l1d', cycles: 4, done: true });
    expect(ledger.history.map((j) => j.served)).toEqual(['ram', 'l1d']);
  });

  it('a carry between two memory levels is not a core trip and is ignored', () => {
    const tl = verbs.carry(verbs.spawnPulse('l2', 'data').id, 'l2', 'ram');
    tl.pause();
    tl.progress(1);
    expect(now().current).toBeNull();
  });
});
