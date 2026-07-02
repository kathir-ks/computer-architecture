import { makeChapter, seq, together } from './helpers';

/** Chapter 6 — the miss cascade: L1 → L2 → the long ride to RAM. */
export default makeChapter(6, [
  {
    cue: (v) =>
      seq(together(v.setMood('tense-miss'), v.flyTo('floor9-shelves')), v.flash('l1d', 'miss')),
  },
  { cue: (v) => seq(v.flyTo('floor8-storeroom'), v.flash('l2', 'miss'), v.flash('l2', 'miss')) },
  {
    cue: (v) => {
      const pulse = v.spawnPulse('ram', 'data');
      return seq(
        together(v.flyTo('floor4-archive'), v.flash('ram', 'focus')),
        pulse.tl,
        together(
          v.carry(pulse.id, 'ram', 'registers'),
          v.workerWork('foot-tap'),
          v.flyTo('lift-shaft', { duration: 2.5 }),
        ),
        together(v.deliver(pulse.id, 'worker'), v.flyTo('floor10-desk')),
      );
    },
  },
  {
    cue: (v) => seq(v.flyTo('building-front'), v.workerWork('foot-tap')),
    timing: ['registers', 'l1d', 'l2', 'ram'],
  },
]);
