import { makeChapter, seq, together } from './helpers';

/** Chapter 5 — execute, happy path: L1 hit, quick lift hop, compute, store. */
export default makeChapter(5, [
  { cue: (v) => seq(v.flyTo('floor9-shelves'), v.flash('l1d', 'hit'), v.flash('l1d', 'hit')) },
  {
    cue: (v) => {
      const pulse = v.spawnPulse('l1d', 'data');
      return seq(
        together(v.setMood('working'), pulse.tl),
        together(v.carry(pulse.id, 'l1d', 'registers'), v.flyTo('floor10-desk')),
        v.deliver(pulse.id, 'worker'),
        v.workerWork('compute'),
      );
    },
    timing: ['registers', 'l1d'],
  },
  { cue: (v) => seq(v.drawer('put', 'r1'), v.setMood('celebration'), v.workerWork('idle')) },
]);
