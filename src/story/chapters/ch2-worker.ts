import { makeChapter, seq, together } from './helpers';

/** Chapter 2 — meet the Worker, the register drawers and the program counter. */
export default makeChapter(2, [
  { cue: (v) => seq(v.flyTo('floor10-desk'), v.workerWork('compute')) },
  { cue: (v) => seq(v.drawer('take', 'r1'), v.drawer('put', 'r2'), v.workerWork('idle')) },
  {
    cue: (v) =>
      seq(
        v.dispenseTicket(),
        together(v.flyTo('floor4-archive'), v.flash('ram', 'focus')),
        v.flyTo('floor10-desk'),
      ),
  },
]);
