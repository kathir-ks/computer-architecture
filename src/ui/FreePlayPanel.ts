import gsap from 'gsap';
import type { Op, Target, FreePlayOutcome, Scoreboard } from '../story/freeplay';

const OPS: Op[] = ['LOAD', 'ADD', 'STORE'];
const TARGETS: Array<{ id: Target; label: string }> = [
  { id: 'l1d', label: 'L1' },
  { id: 'l2', label: 'L2' },
  { id: 'ram', label: 'RAM' },
  { id: 'disk', label: 'Disk' },
  { id: 'random', label: '🎲 Random' },
];

/** Instruction launcher + cycle counter + hit/miss scoreboard (US3). */
export class FreePlayPanel {
  private root: HTMLElement;
  private fireBtn!: HTMLButtonElement;
  private cyclesEl!: HTMLElement;
  private statEls!: { hits: HTMLElement; misses: HTMLElement; cycles: HTMLElement };
  private op: Op = 'LOAD';
  private target: Target = 'random';
  private fireCbs = new Set<(op: Op, target: Target) => void>();
  private resetCbs = new Set<() => void>();

  constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'freeplay';
    this.root.hidden = true;
    this.build();
    host.appendChild(this.root);
  }

  private build(): void {
    const mkGroup = <T extends string>(
      label: string,
      options: Array<{ id: T; label: string }>,
      initial: T,
      onPick: (id: T) => void,
    ) => {
      const group = document.createElement('div');
      group.className = 'fp-group';
      group.innerHTML = `<span class="label">${label}</span>`;
      const opts = document.createElement('div');
      opts.className = 'fp-options';
      for (const o of options) {
        const b = document.createElement('button');
        b.textContent = o.label;
        if (o.id === initial) b.classList.add('selected');
        b.addEventListener('click', () => {
          for (const sib of opts.children) sib.classList.remove('selected');
          b.classList.add('selected');
          onPick(o.id);
        });
        opts.appendChild(b);
      }
      group.appendChild(opts);
      return group;
    };

    this.root.appendChild(
      mkGroup('Instruction', OPS.map((o) => ({ id: o, label: o })), this.op, (o) => (this.op = o)),
    );
    this.root.appendChild(
      mkGroup('Where the data lives', TARGETS, this.target, (t) => (this.target = t)),
    );

    this.fireBtn = document.createElement('button');
    this.fireBtn.id = 'fp-fire';
    this.fireBtn.textContent = '⚡ Fire instruction';
    this.fireBtn.addEventListener('click', () => {
      for (const cb of this.fireCbs) cb(this.op, this.target);
    });
    this.root.appendChild(this.fireBtn);

    this.cyclesEl = document.createElement('div');
    this.cyclesEl.id = 'fp-cycles';
    this.root.appendChild(this.cyclesEl);

    const board = document.createElement('div');
    board.className = 'fp-scoreboard';
    board.innerHTML =
      '<span class="stat">Hits<b data-k="hits">0</b></span>' +
      '<span class="stat">Misses<b data-k="misses">0</b></span>' +
      '<span class="stat">Total cycles<b data-k="cycles">0</b></span>';
    this.root.appendChild(board);
    this.statEls = {
      hits: board.querySelector('[data-k="hits"]')!,
      misses: board.querySelector('[data-k="misses"]')!,
      cycles: board.querySelector('[data-k="cycles"]')!,
    };

    const reset = document.createElement('button');
    reset.textContent = 'Reset scoreboard';
    reset.className = 'fp-reset';
    reset.style.cssText =
      'margin-top:10px;background:transparent;border:1px solid var(--panel-border);' +
      'color:var(--text-dim);border-radius:14px;padding:6px 12px;cursor:pointer;font-size:12px';
    reset.addEventListener('click', () => {
      for (const cb of this.resetCbs) cb();
    });
    this.root.appendChild(reset);
  }

  onFire(cb: (op: Op, target: Target) => void): void {
    this.fireCbs.add(cb);
  }

  onReset(cb: () => void): void {
    this.resetCbs.add(cb);
  }

  show(): void {
    this.root.hidden = false;
  }

  setBusy(busy: boolean): void {
    this.fireBtn.disabled = busy;
    this.fireBtn.textContent = busy ? '… data in transit' : '⚡ Fire instruction';
  }

  /** Animate the cycle counter racking up alongside the journey. */
  showOutcome(outcome: FreePlayOutcome, durationSec: number): void {
    const counter = { v: 0 };
    this.cyclesEl.classList.remove('flash-focus');
    gsap.to(counter, {
      v: outcome.cycles,
      duration: durationSec,
      ease: 'power1.in',
      onUpdate: () => {
        this.cyclesEl.textContent = `${Math.round(counter.v).toLocaleString('en-US')} cycles`;
      },
      onComplete: () => {
        this.cyclesEl.textContent =
          `${outcome.cycles.toLocaleString('en-US')} cycles — ` +
          (outcome.hit ? 'HIT ✓' : `miss (found in ${outcome.resolved.toUpperCase()})`);
      },
    });
  }

  updateScoreboard(board: Scoreboard): void {
    this.statEls.hits.textContent = String(board.hits);
    this.statEls.misses.textContent = String(board.misses);
    this.statEls.cycles.textContent = board.totalCycles.toLocaleString('en-US');
  }
}
