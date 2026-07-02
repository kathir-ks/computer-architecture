import { describe, expect, it } from 'vitest';
import { markerIds, parseMarkers } from '../../src/story/markers';

describe('parseMarkers', () => {
  it('passes plain text through untouched', () => {
    const p = parseMarkers('No markers here.');
    expect(p.plainText).toBe('No markers here.');
    expect(p.spans).toEqual([]);
  });

  it('extracts a single marker with correct offsets', () => {
    const p = parseMarkers('Check the [[l1d:L1 data cache]] first.');
    expect(p.plainText).toBe('Check the L1 data cache first.');
    expect(p.spans).toEqual([{ start: 10, end: 23, id: 'l1d' }]);
    expect(p.plainText.slice(10, 23)).toBe('L1 data cache');
  });

  it('extracts multiple markers in order', () => {
    const p = parseMarkers('[[l1d:L1]] misses, then [[l2:L2]] misses, then [[ram:RAM]].');
    expect(p.plainText).toBe('L1 misses, then L2 misses, then RAM.');
    expect(p.spans.map((s) => s.id)).toEqual(['l1d', 'l2', 'ram']);
    for (const s of p.spans) {
      expect(p.plainText.slice(s.start, s.end)).toMatch(/^(L1|L2|RAM)$/);
    }
  });

  it('trims whitespace in ids', () => {
    const p = parseMarkers('[[ ram :the archive]]');
    expect(p.spans[0].id).toBe('ram');
  });

  it('throws on unclosed markers', () => {
    expect(() => parseMarkers('broken [[l1d:L1 data')).toThrow(/Malformed/);
    expect(() => parseMarkers('stray ]] closer')).toThrow(/Malformed/);
  });

  it('throws on empty ids', () => {
    expect(() => parseMarkers('[[  :label]]')).toThrow(/Empty marker id/);
  });

  it('markerIds returns all ids', () => {
    expect(markerIds('[[worker:the Worker]] uses [[registers:drawers]]')).toEqual([
      'worker',
      'registers',
    ]);
  });
});
