import { locationOf, WORK_CYCLES, type LocationId, type WorkCycleKind } from '../locations';
import type { PulseId, PulseTint } from '../effects/Pulse';
import type { WorkKind } from '../Worker';
import type { AccessKind, CycleLedger } from './ledger';

/** The verbs that carry information about a data access. Everything else the story calls is irrelevant here. */
export interface TrackedVerbs {
  flash(id: LocationId, kind: 'hit' | 'miss' | 'focus'): gsap.core.Timeline;
  workerWork(kind: WorkKind): gsap.core.Timeline;
  spawnPulse(at: LocationId, tint: PulseTint): { id: PulseId; tl: gsap.core.Timeline };
  carry(pulse: PulseId, from: LocationId, to: LocationId): gsap.core.Timeline;
  courierTrip(pulse: PulseId, opts?: { fastForward?: boolean }): gsap.core.Timeline;
  deliver(pulse: PulseId, to: LocationId | 'worker'): gsap.core.Timeline;
}

/**
 * Derives the cycle ledger from the verbs chapters already call (research D11), so no chapter needs editing.
 *
 *   flash hit/miss      → probe   ('focus' is ignored: chapter 8 uses it as a tour)
 *   carry / courierTrip → serve   + a meter that ramps over the verb's own duration
 *   deliver             → complete
 *   workerWork          → work    (compute / read-card only)
 *
 * Every ledger effect is attached to the verb's own timeline, never fired at call time. Cues build all their
 * timelines up front and play them later, and a timeline pauses, fast-forwards (`progress(1)`) and dies on
 * a chapter jump — the ledger inherits all of that. A killed timeline never reaches its end, which is why
 * `main.ts` calls `resetTelemetry()` on a jump.
 */
export class AccessTracker {
  constructor(private readonly ledger: CycleLedger) {}

  wrap(raw: TrackedVerbs): TrackedVerbs {
    const ledger = this.ledger;
    /** Where each pulse was born — the only way to tell a STORE trip from a LOAD trip for the courier. */
    const origin = new Map<PulseId, LocationId>();

    /** Open a journey unless one is already collecting probes (open and not yet served). */
    const ensureJourney = (kind: AccessKind): void => {
      if (!ledger.isOpen || ledger.snapshot().current?.served) ledger.beginAccess(kind);
    };

    const startTrip = (level: LocationId, kind: AccessKind): void => {
      ensureJourney(kind);
      ledger.serve(level, kind);
    };

    /** Grow the wait from 0 to the serving level's latency across the whole verb, by tween deltas. */
    const ramp = (tl: gsap.core.Timeline, level: LocationId): void => {
      const total = locationOf(level).latencyCycles;
      const length = tl.duration();
      if (total <= 0 || length <= 0) return;
      const meter = { v: 0 };
      let last = 0;
      tl.to(
        meter,
        {
          v: total,
          duration: length,
          ease: 'none',
          onUpdate: () => {
            ledger.advance(meter.v - last);
            last = meter.v;
          },
        },
        0,
      );
    };

    return {
      flash: (id, kind) => {
        const tl = raw.flash(id, kind);
        if (kind !== 'focus') {
          tl.call(
            () => {
              ensureJourney('load');
              ledger.probe(id, kind);
            },
            undefined,
            0,
          );
        }
        return tl;
      },

      workerWork: (kind) => {
        const tl = raw.workerWork(kind);
        if (kind in WORK_CYCLES) tl.call(() => ledger.work(kind as WorkCycleKind), undefined, 0);
        return tl;
      },

      spawnPulse: (at, tint) => {
        const spawned = raw.spawnPulse(at, tint);
        origin.set(spawned.id, at);
        return spawned;
      },

      carry: (pulse, from, to) => {
        const tl = raw.carry(pulse, from, to);
        let level: LocationId;
        let kind: AccessKind;
        if (to === 'registers' && from !== 'registers') {
          level = from;
          kind = 'load';
        } else if (from === 'registers' && to !== 'registers') {
          level = to;
          kind = 'store';
        } else {
          return tl; // not a trip between the core and a memory level
        }
        tl.call(() => startTrip(level, kind), undefined, 0);
        ramp(tl, level);
        return tl;
      },

      courierTrip: (pulse, opts) => {
        const tl = raw.courierTrip(pulse, opts);
        const kind: AccessKind = origin.get(pulse) === 'registers' ? 'store' : 'load';
        tl.call(() => startTrip('disk', kind), undefined, 0);
        ramp(tl, 'disk');
        return tl;
      },

      deliver: (pulse, to) => {
        const tl = raw.deliver(pulse, to);
        origin.delete(pulse);
        tl.call(() => ledger.complete());
        return tl;
      },
    };
  }
}
