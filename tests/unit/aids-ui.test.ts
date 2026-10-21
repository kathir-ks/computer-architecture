import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AidsDock } from '../../src/ui/AidsDock';
import { LevelLadder } from '../../src/ui/LevelLadder';
import { LocalityStrip } from '../../src/ui/LocalityStrip';
import { CycleLedger } from '../../src/scene/telemetry/ledger';
import { setMotionProvider } from '../../src/scene/motion';

let host: HTMLElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  host.remove();
  setMotionProvider(null);
  vi.useRealTimers();
});

const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = host) => root.querySelector(sel) as T;

describe('LevelLadder — compact layout', () => {
  it('is one row of chips with no bars or numbers, in ladder order', () => {
    new LevelLadder(host, 'compact');
    expect(host.querySelectorAll('li')).toHaveLength(5);
    expect([...host.querySelectorAll<HTMLElement>('li')].map((li) => li.dataset.rung)).toEqual(['registers', 'l1', 'l2', 'ram', 'disk']);
    expect(host.querySelector('.rung-bar')).toBeNull();
    expect(host.querySelector('.rung-cycles')).toBeNull();
    expect(host.querySelector('.level-ladder')!.classList.contains('compact')).toBe(true);
  });

  it('still carries the real numbers for hover and screen readers', () => {
    new LevelLadder(host, 'compact');
    expect(q('[data-rung="disk"]').getAttribute('aria-label')).toBe('Disk: 4,000,000 cycles');
    expect(q('[data-rung="ram"]').title).toBe('RAM: 200 cycles');
  });

  it('lights the rungs of a miss cascade in order, with a mark that is not just a colour', () => {
    const ladder = new LevelLadder(host, 'compact');
    const l = new CycleLedger();
    l.beginAccess();
    l.probe('l1d', 'miss');
    l.probe('l2', 'miss');
    l.serve('ram');
    ladder.update(l.snapshot().current);

    expect(q('[data-rung="l1"]').dataset.state).toBe('checked-miss');
    expect(q('[data-rung="l1"] .rung-mark').textContent).toBe('✕');
    expect(q('[data-rung="l2"]').dataset.state).toBe('checked-miss');
    expect(q('[data-rung="ram"]').dataset.state).toBe('current');
    expect(q('[data-rung="ram"]').getAttribute('aria-current')).toBe('true');
    expect(q('[data-rung="disk"]').dataset.state).toBe('idle');

    l.complete();
    ladder.update(l.snapshot().current);
    expect(q('[data-rung="ram"]').dataset.state).toBe('served');
    expect(q('[data-rung="ram"]').hasAttribute('aria-current')).toBe(false);

    ladder.update(null);
    expect([...host.querySelectorAll<HTMLElement>('li')].every((li) => li.dataset.state === 'idle')).toBe(true);
  });
});

describe('AidsDock', () => {
  it('starts at zero with the meter in the header', () => {
    new AidsDock(host);
    expect(q('.meter-value').textContent).toBe('0');
    expect(q('.meter').dataset.state).toBe('idle');
  });

  it('follows the ledger: running value, then exactly the latency, with thousands separators', () => {
    const dock = new AidsDock(host);
    const l = new CycleLedger();
    l.subscribe((s) => dock.update(s));

    l.beginAccess();
    l.probe('l1d', 'miss');
    expect(q('.meter').dataset.state).toBe('checking');

    l.serve('disk');
    l.advance(1_500_000);
    expect(q('.meter').dataset.state).toBe('running');
    expect(q('.meter-value').textContent).toBe('1,500,000');
    expect(q('.meter-note').textContent).toBe('Waiting on Disk');

    l.complete();
    expect(q('.meter').dataset.state).toBe('done');
    expect(q('.meter-value').textContent).toBe('4,000,000');
    expect(q('.meter-note').textContent).toBe('served by Disk');
  });

  it('shows waiting versus working, and the parts add up to the total', () => {
    const dock = new AidsDock(host);
    const l = new CycleLedger();
    l.subscribe((s) => dock.update(s));
    l.beginAccess();
    l.serve('ram');
    l.complete();
    l.work('compute');

    expect(q('.idle-figures').textContent).toContain('Waiting 200');
    expect(q('.idle-figures').textContent).toContain('Working 1');
    expect(q('.idle-figures').textContent).toContain('Total 201');
    expect(q('.idle-share').textContent).toBe('99.5% waiting');
    expect((q('.idle-bar i') as HTMLElement).style.width).toBe('99.5%');
  });

  it('idle time does not grow while the data is already home', () => {
    const dock = new AidsDock(host);
    const l = new CycleLedger();
    l.subscribe((s) => dock.update(s));
    l.beginAccess();
    l.serve('l1d');
    l.advance(4);
    l.complete();
    const before = q('.idle-figures').textContent;
    l.work('compute');
    l.advance(50);
    expect(q('.idle-figures').textContent).toContain('Waiting 4');
    expect(q('.idle-figures').textContent).not.toBe(before); // only the working part moved
  });

  it('announces the result once, not on every frame', () => {
    const dock = new AidsDock(host);
    const l = new CycleLedger();
    l.subscribe((s) => dock.update(s));
    l.beginAccess();
    l.serve('l2');
    l.advance(5);
    expect(q('.sr-only').textContent).toBe('');
    l.complete();
    expect(q('.sr-only').textContent).toBe('Access finished: 12 cycles, served by L2 cache.');
    expect(q('.meter-value').getAttribute('aria-live')).toBe('off');
  });

  it('resets cleanly when the ledger resets (chapter jump mid-journey)', () => {
    const dock = new AidsDock(host);
    const l = new CycleLedger();
    l.subscribe((s) => dock.update(s));
    l.beginAccess();
    l.serve('ram');
    l.advance(120);
    l.reset();
    expect(q('.meter-value').textContent).toBe('0');
    expect(q('.meter').dataset.state).toBe('idle');
    expect(q('.idle-figures').textContent).toContain('Total 0');
    expect(q('.idle-share').textContent).toBe('');
  });

  it('collapses to the meter alone and expands again, keeping the toggle honest', () => {
    const dock = new AidsDock(host, { collapsed: true });
    expect(dock.collapsed).toBe(true);
    expect(q('.aids-body').hidden).toBe(true);
    expect(q('.aids-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(q('.meter')).toBeTruthy(); // the meter stays in the header

    q<HTMLButtonElement>('.aids-toggle').click();
    expect(dock.collapsed).toBe(false);
    expect(q('.aids-body').hidden).toBe(false);
    expect(q('.aids-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('folds the locality strip on its own, so the aids that describe the access stay short', () => {
    const dock = new AidsDock(host, { localityOpen: false });
    new LocalityStrip(dock.localitySlot);
    expect(dock.localityOpen).toBe(false);
    expect(dock.localitySlot.hidden).toBe(true);
    expect(q('.locality-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(q('.aids-body').hidden).toBe(false); // the rest of the body is still showing

    q<HTMLButtonElement>('.locality-toggle').click();
    expect(dock.localityOpen).toBe(true);
    expect(dock.localitySlot.hidden).toBe(false);
  });

  it('offers slots for the ladder and the locality strip', () => {
    const dock = new AidsDock(host);
    new LevelLadder(dock.ladderSlot, 'compact');
    new LocalityStrip(dock.localitySlot);
    expect(dock.ladderSlot.querySelectorAll('li')).toHaveLength(5);
    expect(dock.localitySlot.querySelectorAll('.cell')).toHaveLength(16);
  });
});

describe('LocalityStrip', () => {
  const cell = (i: number) => q<HTMLButtonElement>(`.cell[data-index="${i}"]`);

  it('has sixteen real buttons, so the keyboard works', () => {
    new LocalityStrip(host);
    expect(host.querySelectorAll('button.cell')).toHaveLength(16);
  });

  it('a cold click is a miss that brings its whole line, and a neighbour then hits', () => {
    vi.useFakeTimers();
    setMotionProvider(() => true); // the line arrives at once
    new LocalityStrip(host);

    cell(5).click();
    vi.runAllTimers();
    expect([...host.querySelectorAll('.cell.resident')].map((c) => (c as HTMLElement).dataset.index)).toEqual(['4', '5', '6', '7']);
    expect(q('.locality-status').textContent).toMatch(/miss/);
    expect(q('.locality-status').textContent).toContain('4–7');

    cell(6).click();
    expect(q('.locality-status').textContent).toMatch(/hit/);
    expect(q('.locality-tally').textContent).toBe('1 hit · 1 miss');
    expect(host.querySelectorAll('.cell.resident')).toHaveLength(4); // a hit fetches nothing
  });

  it('the line fills cell by cell, touched cell first, when motion is allowed', () => {
    vi.useFakeTimers();
    setMotionProvider(() => false);
    new LocalityStrip(host);
    cell(6).click();

    vi.advanceTimersByTime(1);
    expect(host.querySelectorAll('.cell.resident')).toHaveLength(1);
    expect(cell(6).classList.contains('resident')).toBe(true);

    vi.runAllTimers();
    expect(host.querySelectorAll('.cell.resident')).toHaveLength(4);
  });

  it('labels each cell for screen readers and keeps the label current', () => {
    vi.useFakeTimers();
    setMotionProvider(() => true);
    new LocalityStrip(host);
    expect(cell(2).getAttribute('aria-label')).toBe('Cell 2, not cached');
    cell(2).click();
    vi.runAllTimers();
    expect(cell(2).getAttribute('aria-label')).toBe('Cell 2, cached');
    expect(cell(0).getAttribute('aria-label')).toBe('Cell 0, cached');
  });

  it('Reset clears the strip and the tally, and cancels a fill still in flight', () => {
    vi.useFakeTimers();
    setMotionProvider(() => false);
    new LocalityStrip(host);
    cell(9).click();
    q<HTMLButtonElement>('.locality-reset').click();
    vi.runAllTimers();
    expect(host.querySelectorAll('.cell.resident')).toHaveLength(0);
    expect(q('.locality-tally').textContent).toBe('');

    cell(9).click(); // the model forgot it too: a miss again
    expect(q('.locality-status').textContent).toMatch(/miss/);
  });
});

describe('free-play panel while data is in transit', () => {
  it('disables Reset as well as Fire, so the scoreboard and the aids cannot fall out of step', async () => {
    const { FreePlayPanel } = await import('../../src/ui/FreePlayPanel');
    const panel = new FreePlayPanel(host);
    const fire = q<HTMLButtonElement>('#fp-fire');
    const reset = q<HTMLButtonElement>('.fp-reset');
    expect(reset.disabled).toBe(false);

    panel.setBusy(true);
    expect(fire.disabled).toBe(true);
    expect(reset.disabled).toBe(true);

    panel.setBusy(false);
    expect(fire.disabled).toBe(false);
    expect(reset.disabled).toBe(false);
  });
});
