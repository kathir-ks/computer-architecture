import { afterEach, describe, expect, it } from 'vitest';
import {
  onReducedMotionChange,
  reducedMotion,
  scaleDuration,
  setMotionProvider,
} from '../../src/scene/motion';

afterEach(() => setMotionProvider(null));

describe('motion preference', () => {
  it('leaves durations alone when motion is not reduced', () => {
    setMotionProvider(() => false);
    expect(reducedMotion()).toBe(false);
    expect(scaleDuration(2)).toBe(2);
  });

  it('shortens durations when motion is reduced', () => {
    setMotionProvider(() => true);
    expect(reducedMotion()).toBe(true);
    expect(scaleDuration(2)).toBeCloseTo(0.7);
    expect(scaleDuration(2)).toBeLessThan(2);
  });

  it('defaults to not reduced when matchMedia is unavailable', () => {
    setMotionProvider(null);
    expect(typeof reducedMotion()).toBe('boolean');
  });

  it('notifies subscribers when the preference changes, and unsubscribes cleanly', () => {
    const seen: boolean[] = [];
    const off = onReducedMotionChange((r) => seen.push(r));
    setMotionProvider(() => true);
    setMotionProvider(() => false);
    off();
    setMotionProvider(() => true);
    expect(seen).toEqual([true, false]);
  });
});
