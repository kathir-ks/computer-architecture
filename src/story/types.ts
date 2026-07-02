import type { SceneVerbs } from '../scene';
import type { LocationId } from '../scene/locations';

/** One narration paragraph paired with one animation cue. */
export interface Step {
  narration: string;
  /** Pure builder — MUST only call SceneVerbs (enforced by the cue-integrity test). */
  cue: (verbs: SceneVerbs) => gsap.core.Timeline;
  /** Locations to show in the panel's latency comparison bar during this step. */
  timing?: LocationId[];
}

export interface Chapter {
  id: number; // 1-based
  title: string;
  steps: Step[];
}

export type StoryStatus = 'playing' | 'paused' | 'waiting';
export type StoryMode = 'story' | 'freeplay';
