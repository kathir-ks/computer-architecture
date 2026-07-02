import { makeChapter, seq, together } from './helpers';

/** Chapter 8 — recap ladder; the last step's completion unlocks free play. */
export default makeChapter(8, [
  {
    cue: (v) =>
      seq(
        v.flyTo('recap-wide', { duration: 2.2 }),
        v.flash('l1d', 'focus'),
        v.flash('l2', 'focus'),
        v.flash('ram', 'focus'),
        v.flash('disk', 'focus'),
      ),
  },
  {
    cue: (v) => seq(v.workerWork('idle')),
    timing: ['registers', 'l1d', 'l2', 'ram', 'disk'],
  },
  {
    cue: (v) =>
      seq(together(v.setMood('celebration'), v.flyTo('building-front')), v.workerWork('compute')),
  },
]);
