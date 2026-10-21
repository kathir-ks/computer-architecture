import { CacheLineSim } from '../sim/cacheLine';
import { reducedMotion } from '../scene/motion';

const FILL_STAGGER_MS = 90;

/**
 * "Why does a miss bring neighbours along?" — sixteen memory cells; click one. A cold cell misses and its
 * whole aligned line of four arrives together; clicking a neighbour then hits. A view of `CacheLineSim`
 * and nothing more. Every cell is a real button, so it works with a keyboard (Tab, then Enter or Space).
 */
export class LocalityStrip {
  private sim: CacheLineSim;
  private cells: HTMLButtonElement[] = [];
  private status: HTMLParagraphElement;
  private tally: HTMLSpanElement;
  private hits = 0;
  private misses = 0;
  private timers: number[] = [];

  constructor(root: HTMLElement, sim = new CacheLineSim()) {
    this.sim = sim;
    const wrap = document.createElement('section');
    wrap.className = 'locality';
    wrap.setAttribute('aria-label', 'Locality: a miss brings its neighbours along');

    const head = document.createElement('div');
    head.className = 'locality-head';
    this.tally = document.createElement('span');
    this.tally.className = 'locality-tally';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'locality-reset';
    reset.textContent = 'Reset';
    reset.addEventListener('click', () => this.reset());
    head.append(this.tally, reset);

    const strip = document.createElement('div');
    strip.className = 'locality-cells';
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', `${sim.cells} memory cells in lines of ${sim.lineSize}`);
    for (let i = 0; i < sim.cells; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell';
      b.dataset.index = String(i);
      b.dataset.line = String(Math.floor(i / sim.lineSize));
      b.textContent = String(i);
      b.addEventListener('click', () => this.access(i));
      strip.appendChild(b);
      this.cells.push(b);
    }

    this.status = document.createElement('p');
    this.status.className = 'locality-status';
    this.status.setAttribute('aria-live', 'polite');

    wrap.append(head, strip, this.status);
    root.appendChild(wrap);
    this.render();
    this.say('Click a cell. The first touch is a miss — see what comes with it.');
  }

  /** Touch cell `i`, as a click would. */
  access(i: number): void {
    const r = this.sim.access(i);
    const btn = this.cells[i];

    if (r.hit) {
      this.hits++;
      this.flashCell(btn, 'hit');
      this.say(`Cell ${i}: hit. It came along with an earlier fetch, so no wait.`);
    } else {
      this.misses++;
      this.flashCell(btn, 'miss');
      const first = r.filled[0];
      const last = r.filled[r.filled.length - 1];
      this.say(`Cell ${i}: miss. Cells ${first}–${last} were fetched together — touch a neighbour.`);
      // The line arrives cell by cell (all at once under reduced motion), the touched cell first.
      const order = [i, ...r.filled.filter((c) => c !== i)];
      order.forEach((cell, n) => {
        const delay = reducedMotion() ? 0 : n * FILL_STAGGER_MS;
        this.timers.push(window.setTimeout(() => this.paintCell(cell), delay));
      });
    }
    this.renderTally();
  }

  reset(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    this.sim.reset();
    this.hits = 0;
    this.misses = 0;
    this.render();
    this.say('Cleared. Click a cell to start again.');
  }

  private paintCell(i: number): void {
    const resident = this.sim.resident[i];
    const b = this.cells[i];
    b.classList.toggle('resident', resident);
    b.setAttribute('aria-label', `Cell ${i}, ${resident ? 'cached' : 'not cached'}`);
  }

  private flashCell(b: HTMLButtonElement, kind: 'hit' | 'miss'): void {
    b.classList.remove('flash-hit', 'flash-miss');
    void b.offsetWidth; // restart the CSS animation when the same cell is clicked twice
    b.classList.add(kind === 'hit' ? 'flash-hit' : 'flash-miss');
  }

  private render(): void {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].classList.remove('flash-hit', 'flash-miss');
      this.paintCell(i);
    }
    this.renderTally();
  }

  private renderTally(): void {
    const total = this.hits + this.misses;
    this.tally.textContent = total
      ? `${this.hits} hit${this.hits === 1 ? '' : 's'} · ${this.misses} miss${this.misses === 1 ? '' : 'es'}`
      : '';
  }

  private say(text: string): void {
    this.status.textContent = text;
  }
}
