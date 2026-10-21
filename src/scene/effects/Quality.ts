import type { QualityTier, ViewState } from '../view/viewState';
import { createQualityWatchdog } from './Neon';

/** What each tier switches on. Pure data so it is unit-testable without a renderer. */
export interface TierSettings {
  bloom: boolean;
  shadows: boolean;
  env: boolean;
  /** Multiplier on trail length: 1 = full, 0 = no trails. */
  trailDetail: number;
}

const TIERS: Record<QualityTier, TierSettings> = {
  high: { bloom: true, shadows: true, env: true, trailDetail: 1 },
  medium: { bloom: false, shadows: false, env: true, trailDetail: 0.5 },
  low: { bloom: false, shadows: false, env: false, trailDetail: 0.25 },
};

export function tierSettings(tier: QualityTier): TierSettings {
  return TIERS[tier];
}

/** The renderer-side switches the manager drives. Scene provides the real implementation. */
export interface QualityEffects {
  setBloom(on: boolean): void;
  setShadows(on: boolean): void;
  setEnv(on: boolean): void;
  setTrailDetail(detail: number): void;
  setMaterialTier(tier: QualityTier): void;
}

/**
 * Three-tier quality manager (research D3). The fps watchdog keeps its original tested
 * contract (trips once); after each trip we step down one tier and arm a fresh watchdog.
 * Manual and automatic changes both flow through `ViewState`, so the UI sees one source.
 */
export class Quality {
  private watchdog: (fps: number) => boolean;

  constructor(
    private view: ViewState,
    private effects: QualityEffects,
    private makeWatchdog: () => (fps: number) => boolean = () => createQualityWatchdog(),
  ) {
    this.watchdog = this.makeWatchdog();
    this.apply(view.get().quality);
    let last = view.get().quality;
    view.subscribe((v) => {
      if (v.quality !== last) {
        last = v.quality;
        this.apply(v.quality);
      }
    });
  }

  get tier(): QualityTier {
    return this.view.get().quality;
  }

  /** Feed rolling-average fps samples (one per ~60 frames). */
  feedFps(fps: number): void {
    if (!this.watchdog(fps)) return;
    if (this.view.stepDownQuality()) this.watchdog = this.makeWatchdog();
  }

  private apply(tier: QualityTier): void {
    const s = tierSettings(tier);
    this.effects.setBloom(s.bloom);
    this.effects.setShadows(s.shadows);
    this.effects.setEnv(s.env);
    this.effects.setTrailDetail(s.trailDetail);
    this.effects.setMaterialTier(tier);
  }
}
