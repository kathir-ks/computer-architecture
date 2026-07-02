import { describe, expect, it } from 'vitest';
import { StoryEngine, type HashAdapter } from '../../src/story/StoryEngine';
import type { Chapter } from '../../src/story/types';
import type { SceneVerbs } from '../../src/scene';

/** Minimal fake GSAP timeline: completes only when told to. */
class FakeTimeline {
  onComplete: (() => void) | null = null;
  paused = false;
  killed = false;
  eventCallback(_name: string, cb: () => void): this {
    this.onComplete = cb;
    return this;
  }
  progress(_v: number): this {
    this.onComplete?.();
    return this;
  }
  pause(): this {
    this.paused = true;
    return this;
  }
  resume(): this {
    this.paused = false;
    return this;
  }
  kill(): void {
    this.killed = true;
  }
}

function makeChapters(counts: number[]): { chapters: Chapter[]; timelines: FakeTimeline[] } {
  const timelines: FakeTimeline[] = [];
  const chapters = counts.map((stepCount, ci) => ({
    id: ci + 1,
    title: `Chapter ${ci + 1}`,
    steps: Array.from({ length: stepCount }, () => ({
      narration: 'text',
      cue: () => {
        const tl = new FakeTimeline();
        timelines.push(tl);
        return tl as unknown as gsap.core.Timeline;
      },
    })),
  }));
  return { chapters, timelines };
}

function makeHash(initial = ''): HashAdapter & { value: string; fire: () => void } {
  let cb: (() => void) | null = null;
  return {
    value: initial,
    get() {
      return this.value;
    },
    set(h: string) {
      this.value = h;
    },
    onChange(c) {
      cb = c;
    },
    fire() {
      cb?.();
    },
  };
}

const verbs = {} as SceneVerbs;

describe('StoryEngine', () => {
  it('plays steps then chapters in order', () => {
    const { chapters, timelines } = makeChapters([2, 1]);
    const hash = makeHash();
    const engine = new StoryEngine(chapters, verbs, hash);
    const seen: string[] = [];
    engine.onStep((e) => seen.push(`${e.chapterIndex}.${e.stepIndex}`));

    engine.next();
    expect(engine.state.status).toBe('playing');
    timelines[0].onComplete!();
    expect(engine.state.status).toBe('waiting');
    engine.next();
    timelines[1].onComplete!();
    engine.next(); // crosses into chapter 2
    expect(seen).toEqual(['0.0', '0.1', '1.0']);
    expect(hash.value).toBe('#chapter-2');
  });

  it('mash-Next fast-forwards instead of overlapping timelines', () => {
    const { chapters, timelines } = makeChapters([2]);
    const engine = new StoryEngine(chapters, verbs, makeHash());
    engine.next();
    expect(timelines).toHaveLength(1);
    engine.next(); // playing → fast-forward, does NOT start step 2
    expect(engine.state.status).toBe('waiting');
    expect(timelines).toHaveLength(1);
    engine.next(); // now starts step 2
    expect(timelines).toHaveLength(2);
  });

  it('pause freezes and resume continues', () => {
    const { chapters, timelines } = makeChapters([1]);
    const engine = new StoryEngine(chapters, verbs, makeHash());
    engine.next();
    engine.pause();
    expect(engine.state.status).toBe('paused');
    expect(timelines[0].paused).toBe(true);
    engine.resume();
    expect(engine.state.status).toBe('playing');
    expect(timelines[0].paused).toBe(false);
  });

  it('visibility pause only auto-resumes what it auto-paused', () => {
    const { chapters } = makeChapters([2]);
    const engine = new StoryEngine(chapters, verbs, makeHash());
    engine.next();
    engine.handleVisibility(true);
    expect(engine.state.status).toBe('paused');
    engine.handleVisibility(false);
    expect(engine.state.status).toBe('playing');

    // Manually paused → tab flicker must NOT resume it.
    engine.pause();
    engine.handleVisibility(true);
    engine.handleVisibility(false);
    expect(engine.state.status).toBe('paused');
  });

  it('unlocks freeplay after the last step of the last chapter completes', () => {
    const { chapters, timelines } = makeChapters([1, 1]);
    const engine = new StoryEngine(chapters, verbs, makeHash());
    let unlocked = false;
    engine.onFreeplayUnlock(() => (unlocked = true));
    engine.next();
    timelines[0].onComplete!();
    engine.next();
    expect(unlocked).toBe(false);
    timelines[1].onComplete!();
    expect(unlocked).toBe(true);
    expect(engine.state.mode).toBe('freeplay');
  });

  it('reads a valid deep-link hash on construction', () => {
    const { chapters } = makeChapters([1, 1, 1]);
    const engine = new StoryEngine(chapters, verbs, makeHash('#chapter-3'));
    expect(engine.state.chapterIndex).toBe(2);
  });

  it('clamps invalid hashes to chapter 1', () => {
    const { chapters } = makeChapters([1, 1]);
    for (const bad of ['#chapter-99', '#chapter-0', '#nonsense', '#chapter-x']) {
      const engine = new StoryEngine(chapters, verbs, makeHash(bad));
      expect(engine.state.chapterIndex).toBe(0);
    }
  });

  it('ignores its own hash writes echoing back as hashchange events', () => {
    const { chapters } = makeChapters([3]);
    const hash = makeHash();
    const engine = new StoryEngine(chapters, verbs, hash);
    const seen: number[] = [];
    engine.onStep((e) => seen.push(e.stepIndex));
    engine.next(); // writes #chapter-1
    hash.fire(); // browser echoes our own write — must NOT reset the chapter
    expect(engine.state.stepIndex).toBe(1);
    expect(seen).toEqual([0]);
  });

  it('hashchange jumps chapters and kills the active timeline', () => {
    const { chapters, timelines } = makeChapters([2, 1]);
    const hash = makeHash();
    const engine = new StoryEngine(chapters, verbs, hash);
    engine.next();
    hash.value = '#chapter-2';
    hash.fire();
    expect(timelines[0].killed).toBe(true);
    expect(engine.state.chapterIndex).toBe(1);
    expect(engine.state.stepIndex).toBe(0);
    expect(engine.state.status).toBe('waiting');
  });
});
