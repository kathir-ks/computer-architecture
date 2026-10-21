import { describe, expect, it } from 'vitest';
import { parseViewParams } from '../../src/urlParams';

describe('parseViewParams', () => {
  it('defaults everything off for an empty query', () => {
    expect(parseViewParams('')).toEqual({
      cam: undefined,
      xray: false,
      worker: false,
      lowq: false,
      debug: false,
      dev: false,
      nowebgl: false,
    });
  });

  it('reads each camera mode', () => {
    expect(parseViewParams('?cam=free').cam).toBe('free');
    expect(parseViewParams('?cam=follow').cam).toBe('follow');
    expect(parseViewParams('?cam=cinematic').cam).toBe('cinematic');
  });

  it('ignores an invalid camera mode', () => {
    expect(parseViewParams('?cam=sideways').cam).toBeUndefined();
  });

  it('reads flag params', () => {
    const p = parseViewParams('?xray&lowq&debug&dev&nowebgl');
    expect(p).toMatchObject({ xray: true, lowq: true, debug: true, dev: true, nowebgl: true });
  });

  it('view=worker only for that exact value', () => {
    expect(parseViewParams('?view=worker').worker).toBe(true);
    expect(parseViewParams('?view=desk').worker).toBe(false);
  });

  it('combines params', () => {
    const p = parseViewParams('?cam=follow&xray&view=worker');
    expect(p).toMatchObject({ cam: 'follow', xray: true, worker: true });
  });
});
