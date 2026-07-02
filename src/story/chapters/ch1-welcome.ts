import { makeChapter, seq, together } from './helpers';

/** Chapter 1 — camera tour; labeled floors light up as they are introduced. */
export default makeChapter(1, [
  { cue: (v) => together(v.setMood('intro'), v.flyTo('street', { duration: 2.2 })) },
  { cue: (v) => seq(v.flyTo('floor10-desk'), v.workerWork('idle')) },
  {
    cue: (v) =>
      seq(
        v.flyTo('floor9-shelves'),
        together(v.reveal('l1i'), v.reveal('l1d')),
        v.flyTo('floor8-storeroom'),
        v.reveal('l2'),
      ),
  },
  {
    cue: (v) =>
      seq(
        v.flyTo('floor4-archive'),
        v.reveal('ram'),
        v.flyTo('warehouse'),
        v.reveal('disk'),
        v.flyTo('building-front', { duration: 2 }),
      ),
  },
]);
