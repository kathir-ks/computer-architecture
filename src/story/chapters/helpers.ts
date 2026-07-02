import gsap from 'gsap';
import type { SceneVerbs } from '../../scene';
import type { LocationId } from '../../scene/locations';
import { CHAPTER_TITLES, NARRATION } from '../script';
import type { Chapter, Step } from '../types';

export type Cue = (verbs: SceneVerbs) => gsap.core.Timeline;

/** Zip a chapter's narration (from script.ts) with its cues; lengths must match. */
export function makeChapter(
  id: number,
  cues: Array<{ cue: Cue; timing?: LocationId[] }>,
): Chapter {
  const narration = NARRATION[id - 1];
  if (!narration) throw new Error(`No narration for chapter ${id}`);
  if (narration.length !== cues.length) {
    throw new Error(
      `Chapter ${id}: ${narration.length} narration paragraphs but ${cues.length} cues`,
    );
  }
  const steps: Step[] = narration.map((text, i) => ({
    narration: text,
    cue: cues[i].cue,
    timing: cues[i].timing,
  }));
  return { id, title: CHAPTER_TITLES[id - 1], steps };
}

/** A parent timeline that plays child timelines in sequence (or in parallel with pos). */
export function seq(...parts: gsap.core.Timeline[]): gsap.core.Timeline {
  const tl = gsap.timeline();
  for (const p of parts) tl.add(p);
  return tl;
}

/** Play all parts at the same time. */
export function together(...parts: gsap.core.Timeline[]): gsap.core.Timeline {
  const tl = gsap.timeline();
  for (const p of parts) tl.add(p, 0);
  return tl;
}
