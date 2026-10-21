import type { AccessJourney } from '../scene/telemetry/ledger';
import { barFraction, formatCycles, RUNGS, rungStates, type RungId, type RungState } from './ladderModel';

/** Short words for each state — the colour is never the only signal. */
const STATE_TEXT: Record<RungState, string> = {
  idle: '',
  'checked-miss': 'checked, not here',
  'checked-hit': 'checked, found it',
  served: 'supplied the data',
  current: 'data moving now',
};

const STATE_MARK: Record<RungState, string> = {
  idle: '',
  'checked-miss': '✕',
  'checked-hit': '✓',
  served: '✓',
  current: '◀',
};

/**
 * Vertical latency scale: one rung per memory level, closest to the Worker at the top, with the cost in
 * cycles beside it and a marker on the level currently being used. Plain DOM; every number comes from
 * `locations.ts` through `ladderModel`, and the marker comes from the cycle ledger — this component
 * computes nothing itself.
 */
export class LevelLadder {
  private rows = new Map<RungId, HTMLLIElement>();
  private marks = new Map<RungId, HTMLSpanElement>();

  constructor(root: HTMLElement) {
    const section = document.createElement('section');
    section.className = 'level-ladder scale';
    section.setAttribute('aria-label', 'How far each level is, in cycles');

    const title = document.createElement('h2');
    title.className = 'ladder-title';
    title.textContent = 'Distance in cycles';

    const list = document.createElement('ol');
    list.className = 'ladder-rungs';
    for (const rung of RUNGS) {
      const li = document.createElement('li');
      li.dataset.rung = rung.id;
      li.dataset.state = 'idle';

      const name = document.createElement('span');
      name.className = 'rung-name';
      name.textContent = rung.label;

      const track = document.createElement('span');
      track.className = 'rung-bar';
      const fill = document.createElement('i');
      fill.style.width = `${(barFraction(rung.cycles) * 100).toFixed(1)}%`;
      track.appendChild(fill);

      const cycles = document.createElement('span');
      cycles.className = 'rung-cycles';
      cycles.textContent = formatCycles(rung.cycles);

      const mark = document.createElement('span');
      mark.className = 'rung-mark';
      mark.setAttribute('aria-hidden', 'true');

      li.append(name, track, cycles, mark);
      li.setAttribute('aria-label', `${rung.label}: ${formatCycles(rung.cycles)} cycles`);
      list.appendChild(li);
      this.rows.set(rung.id, li);
      this.marks.set(rung.id, mark);
    }

    const note = document.createElement('p');
    note.className = 'ladder-note';
    note.textContent = 'Bars use a log scale — the numbers are the real ratio.';

    section.append(title, list, note);
    root.appendChild(section);
  }

  /** Light the rungs for the current access (or clear them with null). */
  update(journey: AccessJourney | null): void {
    const states = rungStates(journey);
    for (const rung of RUNGS) {
      const li = this.rows.get(rung.id)!;
      const state = states[rung.id];
      li.dataset.state = state;
      if (state === 'current') li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
      this.marks.get(rung.id)!.textContent = STATE_MARK[state];
      const base = `${rung.label}: ${formatCycles(rung.cycles)} cycles`;
      li.setAttribute('aria-label', STATE_TEXT[state] ? `${base}, ${STATE_TEXT[state]}` : base);
    }
  }
}
