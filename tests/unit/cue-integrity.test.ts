import { describe, expect, it } from 'vitest';
import gsap from 'gsap';
import { CHAPTERS } from '../../src/story/chapters';
import { markerIds } from '../../src/story/markers';
import { ALL_HIGHLIGHT_IDS, LOCATION_BY_ID } from '../../src/scene/locations';
import type { SceneVerbs } from '../../src/scene';

/** Verbs allowed by contracts/scene-verbs.md and scene-verbs-v2.md. Keep in sync with SceneVerbs. */
const CONTRACT_VERBS = [
  'flyTo',
  'reveal',
  'flash',
  'workerWork',
  'drawer',
  'dispenseTicket',
  'showCard',
  'splitCard',
  'spawnPulse',
  'carry',
  'courierTrip',
  'deliver',
  'setMood',
  // v2 (contracts/scene-verbs-v2.md)
  'pipelineSetup',
  'pipelineRun',
  'pipelineTeardown',
] as const;

/** Stub SceneVerbs: every contract verb returns an inert timeline; anything else is recorded. */
function makeStub(violations: string[]): SceneVerbs {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop: string) {
      if (!(CONTRACT_VERBS as readonly string[]).includes(prop)) {
        violations.push(prop);
        return () => gsap.timeline({ paused: true });
      }
      if (prop === 'spawnPulse') {
        return () => ({ id: 1, tl: gsap.timeline({ paused: true }) });
      }
      return () => gsap.timeline({ paused: true });
    },
  };
  return new Proxy({}, handler) as unknown as SceneVerbs;
}

describe('cue integrity (scene–story boundary)', () => {
  it('has exactly 9 chapters, ids 1..9, each with at least one step', () => {
    expect(CHAPTERS).toHaveLength(9);
    CHAPTERS.forEach((ch, i) => {
      expect(ch.id).toBe(i + 1);
      expect(ch.steps.length).toBeGreaterThanOrEqual(1);
      expect(ch.title).toBeTruthy();
    });
  });

  it('every step cue builds against the stub using only contract verbs', () => {
    for (const ch of CHAPTERS) {
      for (const [si, step] of ch.steps.entries()) {
        const violations: string[] = [];
        const tl = step.cue(makeStub(violations));
        expect(tl, `ch${ch.id} step${si} must return a timeline`).toBeTruthy();
        expect(violations, `ch${ch.id} step${si} called non-contract verbs`).toEqual([]);
        tl.kill();
      }
    }
  });

  it('every narration marker id exists in the highlight id table', () => {
    for (const ch of CHAPTERS) {
      for (const [si, step] of ch.steps.entries()) {
        for (const id of markerIds(step.narration)) {
          expect(
            ALL_HIGHLIGHT_IDS,
            `ch${ch.id} step${si}: unknown marker id "${id}"`,
          ).toContain(id);
        }
      }
    }
  });

  it('every timing entry is a real location', () => {
    for (const ch of CHAPTERS) {
      for (const step of ch.steps) {
        for (const id of step.timing ?? []) {
          expect(LOCATION_BY_ID.has(id), `bad timing id "${id}" in ch${ch.id}`).toBe(true);
        }
      }
    }
  });

  it('narration parses cleanly (no malformed markers anywhere)', () => {
    for (const ch of CHAPTERS) {
      for (const step of ch.steps) {
        expect(() => markerIds(step.narration)).not.toThrow();
      }
    }
  });
});
