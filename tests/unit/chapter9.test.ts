import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../../src/story/chapters';
import ch9, { PIPELINE_PROGRAMS } from '../../src/story/chapters/ch9-pipelining';
import { CHAPTER_TITLES, NARRATION } from '../../src/story/script';
import { markerIds } from '../../src/story/markers';
import { buildSchedule } from '../../src/scene/pipelineSchedule';
import { ALL_HIGHLIGHT_IDS, locationOf } from '../../src/scene/locations';
import { TIMING } from '../../src/scene/timing';

describe('chapter 9 — pipelining', () => {
  it('is the ninth and last chapter, with a title and five steps', () => {
    expect(CHAPTERS).toHaveLength(9);
    expect(CHAPTERS.at(-1)).toBe(ch9);
    expect(ch9.id).toBe(9);
    expect(ch9.title).toMatch(/Pipelining/);
    expect(CHAPTER_TITLES).toHaveLength(9);
    expect(ch9.steps).toHaveLength(5);
    expect(NARRATION[8]).toHaveLength(5);
  });

  it('keeps its narration in the one narration source and links terms to real scene ids', () => {
    const ids = NARRATION[8].flatMap((p) => markerIds(p));
    expect(ids).toEqual(expect.arrayContaining(['pipeline', 'registers', 'l1d', 'ram']));
    for (const id of ids) expect(ALL_HIGHLIGHT_IDS).toContain(id);
  });

  it('the numbers the narration quotes are the numbers the schedule produces', () => {
    const fill = buildSchedule(PIPELINE_PROGRAMS.fill);
    // "the line finishes four cards in six ticks — one at a time would take twelve"
    expect(PIPELINE_PROGRAMS.fill).toHaveLength(4);
    expect(fill.totalTicks).toBe(6);
    expect(fill.sequentialTicks).toBe(12);
    expect(NARRATION[8][2]).toMatch(/four cards in six ticks/);
    expect(NARRATION[8][2]).toMatch(/twelve/);
  });

  it('the hazard program really produces one dependency bubble, and the memory program a long hold', () => {
    const hazard = buildSchedule(PIPELINE_PROGRAMS.hazard);
    expect(hazard.bubbles).toEqual([{ tick: 4, stage: 'E', reason: 'dependency' }]);
    const memory = buildSchedule(PIPELINE_PROGRAMS.memory);
    expect(memory.compressedMemoryTicks).toBe(TIMING.pipelineStallShown);
    expect(memory.totalTicks).toBeLessThan(memory.sequentialTicks);
  });

  it('the narration quotes the real RAM figure', () => {
    expect(NARRATION[8][4]).toContain(String(locationOf('ram').latencyCycles));
  });

  it('shows the latency bar on the memory step so the stall ties back to the caches', () => {
    expect(ch9.steps[4].timing).toEqual(['registers', 'l1d', 'ram']);
  });

  it('adds no verbs beyond the contract (cue-integrity also checks this against a stub)', () => {
    const used = new Set<string>();
    const proxy = new Proxy({}, {
      get(_t, prop: string) {
        used.add(prop);
        return prop === 'spawnPulse' ? () => ({ id: 1, tl: gsapStub() }) : () => gsapStub();
      },
    });
    for (const step of ch9.steps) step.cue(proxy as never).kill();
    expect([...used].sort()).toEqual(
      ['flyTo', 'pipelineRun', 'pipelineSetup', 'workerWork'].sort(),
    );
  });
});

import gsap from 'gsap';
const gsapStub = () => gsap.timeline({ paused: true });
