import { describe, expect, it, vi } from 'vitest';
import { Highlighter, type HighlightTargets } from '../../src/sync/Highlighter';
import { ALL_HIGHLIGHT_IDS } from '../../src/scene/locations';
import { CHAPTERS } from '../../src/story/chapters';
import { markerIds } from '../../src/story/markers';

function makeTargets(): HighlightTargets & {
  glow3D: ReturnType<typeof vi.fn>;
  focusText: ReturnType<typeof vi.fn>;
  glowText: ReturnType<typeof vi.fn>;
} {
  return { glow3D: vi.fn(), focusText: vi.fn(), glowText: vi.fn() };
}

describe('Highlighter', () => {
  it('routes glow both to 3D and text for known ids', () => {
    const t = makeTargets();
    const h = new Highlighter(t);
    h.register('l1d');
    h.glow('l1d', true);
    expect(t.glow3D).toHaveBeenCalledWith('l1d', true);
    expect(t.glowText).toHaveBeenCalledWith('l1d', true);
    h.glow('l1d', false);
    expect(t.glow3D).toHaveBeenCalledWith('l1d', false);
  });

  it('routes focusText for known ids', () => {
    const t = makeTargets();
    const h = new Highlighter(t);
    h.register('ram');
    h.focusText('ram');
    expect(t.focusText).toHaveBeenCalledWith('ram');
  });

  it('unknown id: warns and no-ops in prod', () => {
    const t = makeTargets();
    const h = new Highlighter(t, false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.glow('nope', true);
    h.focusText('nope');
    expect(t.glow3D).not.toHaveBeenCalled();
    expect(t.focusText).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('unknown id: throws in dev mode', () => {
    const h = new Highlighter(makeTargets(), true);
    expect(() => h.glow('nope', true)).toThrow(/unknown id/);
  });

  it('registry covers every marker id used in the full script (T026 cross-check)', () => {
    const h = new Highlighter(makeTargets(), true);
    h.registerAll(ALL_HIGHLIGHT_IDS);
    for (const ch of CHAPTERS) {
      for (const step of ch.steps) {
        for (const id of markerIds(step.narration)) {
          expect(h.has(id), `marker "${id}" not registered`).toBe(true);
        }
      }
    }
  });
});
