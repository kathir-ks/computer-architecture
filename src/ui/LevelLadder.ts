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
 *  scale    vertical rungs with a bar and the cost in cycles — the X-ray side panel
 *  compact  one short row of chips, no numbers — the always-on aid beside the cycle meter
 */
export type LadderLayout = 'scale' | 'compact';

/**
 * The memory ladder: one rung per level, closest to the Worker first, with a marker on each level the
 * current access has checked or is using. Plain DOM; every number comes from `locations.ts` through
 * `ladderModel`, and every state comes from the cycle ledger — this component computes nothing itself.
 */
export class LevelLadder {
  private rows = new Map<RungId, HTMLLIElement>();
  private marks = new Map<RungId, HTMLSpanElement>();

  constructor(root: HTMLElement, layout: LadderLayout = 'scale') {
    const compact = layout === 'compact';
    const section = document.createElement('section');
    section.className = `level-ladder ${layout}`;
    section.setAttribute('aria-label', compact ? 'Levels this access has checked' : 'How far each level is, in cycles');

    const list = document.createElement('ol');
    list.className = 'ladder-rungs';
    for (const rung of RUNGS) {
      const li = document.createElement('li');
      li.dataset.rung = rung.id;
      li.dataset.state = 'idle';

      const name = document.createElement('span');
      name.className = 'rung-name';
      name.textContent = rung.label;
      li.appendChild(name);

      if (!compact) {
        const track = document.createElement('span');
        track.className = 'rung-bar';
        const fill = document.createElement('i');
        fill.style.width = `${(barFraction(rung.cycles) * 100).toFixed(1)}%`;
        track.appendChild(fill);

        const cycles = document.createElement('span');
        cycles.className = 'rung-cycles';
        cycles.textContent = formatCycles(rung.cycles);
        li.append(track, cycles);
      }

      const mark = document.createElement('span');
      mark.className = 'rung-mark';
      mark.setAttribute('aria-hidden', 'true');
      li.appendChild(mark);

      li.title = `${rung.label}: ${formatCycles(rung.cycles)} cycles`;
      li.setAttribute('aria-label', li.title);
      list.appendChild(li);
      this.rows.set(rung.id, li);
      this.marks.set(rung.id, mark);
    }

    if (!compact) {
      const title = document.createElement('h2');
      title.className = 'ladder-title';
      title.textContent = 'Distance in cycles';
      const note = document.createElement('p');
      note.className = 'ladder-note';
      note.textContent = 'Bars use a log scale — the numbers are the real ratio.';
      section.append(title, list, note);
    } else {
      section.appendChild(list);
    }
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
