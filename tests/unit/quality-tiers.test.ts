import { describe, expect, it } from 'vitest';
import { Quality, tierSettings, type QualityEffects } from '../../src/scene/effects/Quality';
import { ViewState } from '../../src/scene/view/viewState';
import type { QualityTier } from '../../src/scene/view/viewState';

function recorder() {
  const log: string[] = [];
  const effects: QualityEffects = {
    setBloom: (on) => log.push(`bloom:${on}`),
    setShadows: (on) => log.push(`shadows:${on}`),
    setEnv: (on) => log.push(`env:${on}`),
    setTrailDetail: (d) => log.push(`trail:${d}`),
    setMaterialTier: (t: QualityTier) => log.push(`mat:${t}`),
  };
  return { log, effects };
}

describe('tier settings', () => {
  it('high has everything; bloom and shadows go first, env goes last', () => {
    expect(tierSettings('high')).toMatchObject({ bloom: true, shadows: true, env: true });
    expect(tierSettings('medium')).toMatchObject({ bloom: false, shadows: false, env: true });
    expect(tierSettings('low')).toMatchObject({ bloom: false, shadows: false, env: false });
  });

  it('trail detail only decreases down the tiers', () => {
    expect(tierSettings('high').trailDetail).toBeGreaterThan(tierSettings('medium').trailDetail);
    expect(tierSettings('medium').trailDetail).toBeGreaterThan(tierSettings('low').trailDetail);
  });
});

describe('Quality manager', () => {
  it('applies the starting tier immediately', () => {
    const { log, effects } = recorder();
    new Quality(new ViewState({ quality: 'low' }), effects);
    expect(log).toContain('bloom:false');
    expect(log).toContain('env:false');
    expect(log).toContain('mat:low');
  });

  it('steps down one tier per watchdog trip: high → medium → low, then stops', () => {
    const view = new ViewState();
    const { effects } = recorder();
    const q = new Quality(view, effects, () => {
      let trips = 0;
      return () => trips++ === 0; // trips once per fresh watchdog, on the first sample
    });
    q.feedFps(10);
    expect(view.get().quality).toBe('medium');
    q.feedFps(10);
    expect(view.get().quality).toBe('low');
    q.feedFps(10);
    expect(view.get().quality).toBe('low');
  });

  it('a healthy watchdog never steps down', () => {
    const view = new ViewState();
    const { effects } = recorder();
    const q = new Quality(view, effects, () => () => false);
    for (let i = 0; i < 50; i++) q.feedFps(60);
    expect(view.get().quality).toBe('high');
  });

  it('manual changes (including back up) re-apply the effects', () => {
    const view = new ViewState({ quality: 'low' });
    const { log, effects } = recorder();
    new Quality(view, effects);
    log.length = 0;
    view.setQuality('high');
    expect(log).toEqual(expect.arrayContaining(['bloom:true', 'shadows:true', 'env:true', 'mat:high']));
  });

  it('works with the real watchdog: three consecutive low samples step down once', () => {
    const view = new ViewState();
    const { effects } = recorder();
    const q = new Quality(view, effects);
    q.feedFps(20);
    q.feedFps(20);
    expect(view.get().quality).toBe('high');
    q.feedFps(20);
    expect(view.get().quality).toBe('medium');
  });
});
