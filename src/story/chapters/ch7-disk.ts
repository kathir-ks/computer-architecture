import { makeChapter, seq, together } from './helpers';

/** Chapter 7 — the disk trip: the courier van and the millions-of-cycles wait. */
export default makeChapter(7, [
  {
    cue: (v) =>
      seq(together(v.setMood('tense-miss'), v.flyTo('warehouse')), v.flash('disk', 'focus')),
  },
  {
    cue: (v) => {
      const pulse = v.spawnPulse('disk', 'data');
      return seq(
        pulse.tl,
        together(
          v.courierTrip(pulse.id, { fastForward: true }),
          // Camera tracks the van door-to-door; trip and follow end together.
          v.follow('courier', { duration: 3 }),
          v.workerWork('foot-tap'),
        ),
        together(v.deliver(pulse.id, 'worker'), v.flyTo('floor10-desk')),
      );
    },
    timing: ['ram', 'disk'],
  },
  {
    cue: (v) =>
      seq(
        together(v.setMood('working'), v.flyTo('floor9-shelves')),
        v.flash('l1d', 'hit'),
        v.flash('l1i', 'hit'),
      ),
  },
]);
