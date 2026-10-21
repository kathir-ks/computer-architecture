import type { LedgerSnapshot } from '../scene/telemetry/ledger';
import { formatCycles } from './ladderModel';
import { idleView, meterView, percentText } from './aidsModel';

/**
 * The live aids over the 3D view: a cycle meter for the current access (always visible), and — when
 * expanded — the memory ladder, the idle-versus-working counter and the locality strip.
 *
 * It is fed only by the cycle ledger (`update`) and never computes a cost: the meter shows what the
 * ledger says, so it cannot disagree with the scoreboard, the scale or the 3D scene.
 * Collapsed, it is a single line, so on a small screen it never covers the 3D focus area.
 */
export class AidsDock {
  /** Containers for the other aids; main.ts mounts a compact ladder and the locality strip in them. */
  readonly ladderSlot: HTMLElement;
  readonly localitySlot: HTMLElement;

  private root: HTMLElement;
  private meterValue: HTMLOutputElement;
  private meterNote: HTMLSpanElement;
  private meterWrap: HTMLElement;
  private idleText: HTMLSpanElement;
  private workText: HTMLSpanElement;
  private elapsedText: HTMLSpanElement;
  private shareText: HTMLSpanElement;
  private idleBar: HTMLElement;
  private announce: HTMLElement;
  private toggle: HTMLButtonElement;
  private body: HTMLElement;
  private localityToggle!: HTMLButtonElement;
  private lastState = 'idle';

  constructor(root: HTMLElement, opts?: { collapsed?: boolean; localityOpen?: boolean }) {
    this.root = root;
    root.hidden = false;
    const dock = document.createElement('section');
    dock.className = 'aids';
    dock.setAttribute('aria-label', 'Live aids: cycle meter, memory ladder, idle time and locality');

    // ---- header: the cycle meter, always visible ----
    const head = document.createElement('div');
    head.className = 'aids-head';

    this.meterWrap = document.createElement('div');
    this.meterWrap.className = 'meter';
    this.meterWrap.dataset.state = 'idle';
    const label = document.createElement('span');
    label.className = 'meter-label';
    label.textContent = 'This access';
    this.meterValue = document.createElement('output');
    this.meterValue.className = 'meter-value';
    this.meterValue.setAttribute('aria-live', 'off'); // changes every frame; the summary below speaks instead
    this.meterValue.textContent = '0';
    const unit = document.createElement('span');
    unit.className = 'meter-unit';
    unit.textContent = 'cycles';
    this.meterNote = document.createElement('span');
    this.meterNote.className = 'meter-note';
    this.meterWrap.append(label, this.meterValue, unit, this.meterNote);

    this.toggle = document.createElement('button');
    this.toggle.type = 'button';
    this.toggle.className = 'aids-toggle';
    this.toggle.addEventListener('click', () => this.setCollapsed(!this.collapsed));

    head.append(this.meterWrap, this.toggle);

    // ---- body: ladder, idle counter, locality ----
    this.body = document.createElement('div');
    this.body.className = 'aids-body';
    this.body.id = 'aids-body';
    this.toggle.setAttribute('aria-controls', this.body.id);

    this.ladderSlot = document.createElement('div');
    this.ladderSlot.className = 'aids-ladder';

    const idle = document.createElement('div');
    idle.className = 'idle';
    const idleHead = document.createElement('div');
    idleHead.className = 'idle-head';
    const idleTitle = document.createElement('span');
    idleTitle.className = 'idle-title';
    idleTitle.textContent = 'Worker time';
    this.shareText = document.createElement('span');
    this.shareText.className = 'idle-share';
    idleHead.append(idleTitle, this.shareText);

    this.idleBar = document.createElement('div');
    this.idleBar.className = 'idle-bar';
    this.idleBar.setAttribute('role', 'img');
    const fill = document.createElement('i');
    this.idleBar.appendChild(fill);

    const figures = document.createElement('div');
    figures.className = 'idle-figures';
    this.idleText = document.createElement('span');
    this.workText = document.createElement('span');
    this.elapsedText = document.createElement('span');
    figures.append(this.idleText, this.workText, this.elapsedText);
    idle.append(idleHead, this.idleBar, figures);

    // The locality strip is a toy to play with, not a reading: it has its own fold so the aids that
    // describe the current access stay short on a small screen.
    const locality = document.createElement('div');
    locality.className = 'aids-locality';
    this.localityToggle = document.createElement('button');
    this.localityToggle.type = 'button';
    this.localityToggle.className = 'locality-toggle';
    this.localitySlot = document.createElement('div');
    this.localitySlot.id = 'aids-locality-slot';
    this.localityToggle.setAttribute('aria-controls', this.localitySlot.id);
    this.localityToggle.addEventListener('click', () => this.setLocalityOpen(!this.localityOpen));
    locality.append(this.localityToggle, this.localitySlot);

    this.body.append(this.ladderSlot, idle, locality);

    // Screen readers hear the final result once, not 60 updates a second.
    this.announce = document.createElement('div');
    this.announce.className = 'sr-only';
    this.announce.setAttribute('aria-live', 'polite');

    dock.append(head, this.body, this.announce);
    root.appendChild(dock);

    this.setCollapsed(opts?.collapsed ?? false);
    this.setLocalityOpen(opts?.localityOpen ?? true);
    this.update({ current: null, idleCycles: 0, workingCycles: 0, elapsedCycles: 0 });
  }

  get collapsed(): boolean {
    return this.toggle.getAttribute('aria-expanded') !== 'true';
  }

  setCollapsed(collapsed: boolean): void {
    this.body.hidden = collapsed;
    this.toggle.setAttribute('aria-expanded', String(!collapsed));
    this.toggle.textContent = collapsed ? 'Aids ▴' : 'Aids ▾';
    this.toggle.title = collapsed ? 'Show the ladder, idle time and locality' : 'Hide the extra aids';
    this.root.classList.toggle('collapsed', collapsed);
  }

  get localityOpen(): boolean {
    return this.localityToggle.getAttribute('aria-expanded') === 'true';
  }

  setLocalityOpen(open: boolean): void {
    this.localitySlot.hidden = !open;
    this.localityToggle.setAttribute('aria-expanded', String(open));
    this.localityToggle.textContent = open ? 'Locality ▾' : 'Locality ▸';
  }

  update(s: LedgerSnapshot): void {
    const m = meterView(s);
    this.meterWrap.dataset.state = m.state;
    this.meterValue.textContent = formatCycles(m.cycles);
    this.meterNote.textContent = m.note;
    if (m.state === 'done' && this.lastState !== 'done') {
      this.announce.textContent = `Access finished: ${formatCycles(m.cycles)} cycles, ${m.note}.`;
    }
    this.lastState = m.state;

    const v = idleView(s);
    this.idleText.textContent = `Waiting ${formatCycles(v.idle)}`;
    this.workText.textContent = `Working ${formatCycles(v.working)}`;
    this.elapsedText.textContent = `Total ${formatCycles(v.elapsed)}`;
    this.shareText.textContent = v.elapsed > 0 ? `${percentText(v.idleShare)} waiting` : '';
    (this.idleBar.firstElementChild as HTMLElement).style.width = `${(v.idleShare * 100).toFixed(2)}%`;
    this.idleBar.setAttribute(
      'aria-label',
      v.elapsed > 0
        ? `Waiting ${formatCycles(v.idle)} cycles, working ${formatCycles(v.working)} cycles`
        : 'Nothing has happened yet',
    );
  }
}
