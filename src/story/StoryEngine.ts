import type { SceneVerbs } from '../scene';
import type { Chapter, StoryMode, StoryStatus } from './types';

export interface HashAdapter {
  get(): string;
  set(hash: string): void;
  onChange(cb: () => void): void;
}

const windowHash: HashAdapter = {
  get: () => window.location.hash,
  set: (h) => {
    if (window.location.hash !== h) window.location.hash = h;
  },
  onChange: (cb) => window.addEventListener('hashchange', cb),
};

export interface StepEvent {
  chapter: Chapter;
  chapterIndex: number; // 0-based
  stepIndex: number; // 0-based
  isChapterStart: boolean;
}

/**
 * Chapter/step state machine. One next() = one narration paragraph + one
 * timeline. Never overlaps timelines: next() during playback fast-forwards.
 */
export class StoryEngine {
  private chapterIndex = 0;
  /** Index of the NEXT step to play within the current chapter. */
  private stepIndex = 0;
  private status: StoryStatus = 'waiting';
  private mode: StoryMode = 'story';
  private activeTl: gsap.core.Timeline | null = null;
  private pausedByVisibility = false;

  private stepCbs = new Set<(e: StepEvent) => void>();
  private statusCbs = new Set<(s: StoryStatus) => void>();
  private freeplayCbs = new Set<() => void>();
  private jumpCbs = new Set<() => void>();
  private lastWrittenHash = '';

  constructor(
    private chapters: Chapter[],
    private verbs: SceneVerbs,
    private hash: HashAdapter = windowHash,
  ) {
    if (chapters.length === 0) throw new Error('StoryEngine needs at least one chapter');
    this.chapterIndex = this.parseHash(hash.get());
    this.lastWrittenHash = hash.get();
    hash.onChange(() => {
      const h = this.hash.get();
      if (h === this.lastWrittenHash) return; // our own write echoing back
      this.jumpToChapter(this.parseHash(h));
    });
  }

  // ---- public state ----

  get state(): { chapterIndex: number; stepIndex: number; status: StoryStatus; mode: StoryMode } {
    return {
      chapterIndex: this.chapterIndex,
      stepIndex: this.stepIndex,
      status: this.status,
      mode: this.mode,
    };
  }

  onStep(cb: (e: StepEvent) => void): void {
    this.stepCbs.add(cb);
  }

  onStatus(cb: (s: StoryStatus) => void): void {
    this.statusCbs.add(cb);
  }

  onFreeplayUnlock(cb: () => void): void {
    this.freeplayCbs.add(cb);
  }

  /** Fired after a chapter jump (hash navigation) — UI should reset and restart. */
  onJump(cb: () => void): void {
    this.jumpCbs.add(cb);
  }

  // ---- controls ----

  /**
   * Advance the story. While playing this fast-forwards the current step
   * instead (completing its timeline instantly) — timelines never overlap.
   */
  next(): void {
    if (this.mode === 'freeplay') return;
    if (this.status === 'playing' || this.status === 'paused') {
      this.activeTl?.progress(1); // fires onComplete → waiting
      return;
    }

    // Move past the end of a chapter before playing.
    if (this.stepIndex >= this.currentChapter.steps.length) {
      if (this.chapterIndex >= this.chapters.length - 1) {
        this.unlockFreeplay();
        return;
      }
      this.chapterIndex++;
      this.stepIndex = 0;
    }

    const chapter = this.currentChapter;
    const stepIndex = this.stepIndex;
    const step = chapter.steps[stepIndex];
    const isChapterStart = stepIndex === 0;
    if (isChapterStart) this.writeHash();

    this.stepIndex++;
    for (const cb of this.stepCbs) {
      cb({ chapter, chapterIndex: this.chapterIndex, stepIndex, isChapterStart });
    }

    const tl = step.cue(this.verbs);
    this.activeTl = tl;
    this.setStatus('playing');
    tl.eventCallback('onComplete', () => {
      if (this.activeTl === tl) this.activeTl = null;
      this.setStatus('waiting');
      // Finishing the very last step of the last chapter unlocks free play.
      if (
        this.chapterIndex === this.chapters.length - 1 &&
        this.stepIndex >= this.currentChapter.steps.length
      ) {
        this.unlockFreeplay();
      }
    });
  }

  pause(): void {
    if (this.status !== 'playing') return;
    this.activeTl?.pause();
    this.setStatus('paused');
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.activeTl?.resume();
    this.setStatus('playing');
  }

  /** Tab hidden → pause; visible → resume only what visibility paused (FR-015). */
  handleVisibility(hidden: boolean): void {
    if (hidden && this.status === 'playing') {
      this.pause();
      this.pausedByVisibility = true;
    } else if (!hidden && this.pausedByVisibility) {
      this.pausedByVisibility = false;
      this.resume();
    }
  }

  jumpToChapter(index: number): void {
    this.activeTl?.kill();
    this.activeTl = null;
    this.chapterIndex = Math.min(Math.max(index, 0), this.chapters.length - 1);
    this.stepIndex = 0;
    this.mode = 'story';
    this.setStatus('waiting');
    this.writeHash();
    for (const cb of this.jumpCbs) cb();
  }

  private writeHash(): void {
    const h = `#chapter-${this.chapterIndex + 1}`;
    this.lastWrittenHash = h;
    this.hash.set(h);
  }

  // ---- internals ----

  private get currentChapter(): Chapter {
    return this.chapters[this.chapterIndex];
  }

  private setStatus(s: StoryStatus): void {
    if (this.status === s) return;
    this.status = s;
    for (const cb of this.statusCbs) cb(s);
  }

  private unlockFreeplay(): void {
    if (this.mode === 'freeplay') return;
    this.mode = 'freeplay';
    for (const cb of this.freeplayCbs) cb();
  }

  /** "#chapter-6" → 5; anything invalid → 0 (chapter 1). */
  private parseHash(hash: string): number {
    const m = /^#chapter-(\d+)$/.exec(hash);
    if (!m) return 0;
    const n = Number(m[1]);
    if (!Number.isInteger(n) || n < 1 || n > this.chapters.length) return 0;
    return n - 1;
  }
}
