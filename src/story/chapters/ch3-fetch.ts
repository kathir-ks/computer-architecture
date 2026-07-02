import { makeChapter, seq, together } from './helpers';

/** Chapter 3 — fetch: the instruction card arrives from the L1i shelf. */
export default makeChapter(3, [
  { cue: (v) => seq(v.dispenseTicket(), v.workerWork('idle')) },
  { cue: (v) => seq(v.flyTo('floor9-shelves'), v.flash('l1i', 'focus'), v.flash('l1i', 'focus')) },
  {
    cue: (v) => {
      const pulse = v.spawnPulse('l1i', 'instruction');
      return seq(
        pulse.tl,
        together(v.carry(pulse.id, 'l1i', 'registers'), v.flyTo('floor10-desk')),
        v.deliver(pulse.id, 'worker'),
        v.showCard(),
        v.workerWork('read-card'),
      );
    },
  },
]);
