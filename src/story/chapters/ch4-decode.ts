import { makeChapter, seq } from './helpers';

/** Chapter 4 — decode: the card splits into WHAT and WHERE. */
export default makeChapter(4, [
  { cue: (v) => seq(v.flyTo('floor10-desk'), v.workerWork('read-card')) },
  { cue: (v) => seq(v.splitCard(), v.workerWork('idle')) },
]);
