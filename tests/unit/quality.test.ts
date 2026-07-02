import { describe, expect, it } from 'vitest';
import { createQualityWatchdog } from '../../src/scene/effects/Neon';

describe('quality watchdog', () => {
  it('trips after sustained low fps', () => {
    const check = createQualityWatchdog({ threshold: 30, windowSize: 3 });
    expect(check(25)).toBe(false);
    expect(check(24)).toBe(false);
    expect(check(22)).toBe(true); // third consecutive low sample
  });

  it('a good sample resets the streak', () => {
    const check = createQualityWatchdog({ threshold: 30, windowSize: 3 });
    check(25);
    check(24);
    expect(check(60)).toBe(false); // reset
    check(20);
    check(20);
    expect(check(20)).toBe(true);
  });

  it('never trips on healthy fps', () => {
    const check = createQualityWatchdog();
    for (let i = 0; i < 100; i++) expect(check(60)).toBe(false);
  });

  it('trips at most once', () => {
    const check = createQualityWatchdog({ windowSize: 1 });
    expect(check(10)).toBe(true);
    expect(check(10)).toBe(false);
    expect(check(10)).toBe(false);
  });
});
