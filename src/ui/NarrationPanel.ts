import { parseMarkers } from '../story/markers';
import type { StoryStatus } from '../story/types';
import { locationOf, LOCATION_BY_ID, type LocationId } from '../scene/locations';

export interface PanelRefs {
  narration: HTMLElement;
  progress: HTMLElement;
  timingBar: HTMLElement;
  btnNext: HTMLButtonElement;
  btnPause: HTMLButtonElement;
}

export function defaultPanelRefs(): PanelRefs {
  return {
    narration: document.getElementById('narration')!,
    progress: document.getElementById('chapter-progress')!,
    timingBar: document.getElementById('timing-bar')!,
    btnNext: document.getElementById('btn-next') as HTMLButtonElement,
    btnPause: document.getElementById('btn-pause') as HTMLButtonElement,
  };
}

/**
 * Book-style narration: paragraphs accumulate (older ones dim), key terms are
 * interactive spans, chapter progress dots on top, timing bar for latency beats.
 */
export class NarrationPanel {
  private termHoverCbs = new Set<(id: string, on: boolean) => void>();
  private termClickCbs = new Set<(id: string) => void>();
  private chapterCount = 0;

  constructor(private refs: PanelRefs) {}

  onNext(cb: () => void): void {
    this.refs.btnNext.addEventListener('click', cb);
  }

  onPauseToggle(cb: () => void): void {
    this.refs.btnPause.addEventListener('click', cb);
  }

  onTermHover(cb: (id: string, on: boolean) => void): void {
    this.termHoverCbs.add(cb);
  }

  onTermClick(cb: (id: string) => void): void {
    this.termClickCbs.add(cb);
  }

  initProgress(chapterCount: number): void {
    this.chapterCount = chapterCount;
    this.refs.progress.innerHTML = '';
    for (let i = 0; i < chapterCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'progress-dot';
      this.refs.progress.appendChild(dot);
    }
  }

  setChapterProgress(currentIndex: number): void {
    const dots = this.refs.progress.children;
    for (let i = 0; i < this.chapterCount; i++) {
      dots[i].className =
        'progress-dot' + (i < currentIndex ? ' done' : i === currentIndex ? ' current' : '');
    }
  }

  /** Append a chapter heading. */
  addChapterTitle(title: string): void {
    const h = document.createElement('p');
    h.className = 'chapter-title';
    h.textContent = title;
    this.refs.narration.appendChild(h);
    this.scrollToEnd();
  }

  /** Append one narration paragraph; previous paragraphs dim. */
  addParagraph(raw: string): void {
    for (const p of this.refs.narration.querySelectorAll('.para')) p.classList.add('dimmed');

    const { plainText, spans } = parseMarkers(raw);
    const p = document.createElement('p');
    p.className = 'para';

    let cursor = 0;
    for (const span of spans) {
      p.appendChild(document.createTextNode(plainText.slice(cursor, span.start)));
      const term = document.createElement('span');
      term.className = 'term';
      term.dataset.id = span.id;
      term.textContent = plainText.slice(span.start, span.end);
      term.addEventListener('mouseenter', () => this.emitHover(span.id, true));
      term.addEventListener('mouseleave', () => this.emitHover(span.id, false));
      term.addEventListener('click', () => {
        for (const cb of this.termClickCbs) cb(span.id);
      });
      p.appendChild(term);
      cursor = span.end;
    }
    p.appendChild(document.createTextNode(plainText.slice(cursor)));

    this.refs.narration.appendChild(p);
    this.scrollToEnd();
  }

  /** Scroll to and flash the first mention of a term (3D → text direction). */
  focusText(id: string): void {
    const term = this.refs.narration.querySelector<HTMLElement>(`.term[data-id="${id}"]`);
    if (!term) return;
    const para = term.closest('.para');
    term.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (para) {
      para.classList.remove('flash-focus');
      // Force reflow so the animation can replay.
      void (para as HTMLElement).offsetWidth;
      para.classList.add('flash-focus');
    }
  }

  setTermGlow(id: string, on: boolean): void {
    for (const el of this.refs.narration.querySelectorAll(`.term[data-id="${id}"]`)) {
      el.classList.toggle('glowing', on);
    }
  }

  /** Latency comparison bar (log scale so disk doesn't flatten everything). */
  showTiming(ids: LocationId[]): void {
    const bar = this.refs.timingBar;
    bar.hidden = false;
    bar.innerHTML = '';
    const maxLog = Math.log10(Math.max(...ids.map((id) => locationOf(id).latencyCycles + 1)));
    for (const id of ids) {
      const loc = LOCATION_BY_ID.get(id)!;
      const row = document.createElement('div');
      row.className = 'timing-row';
      const pct = maxLog === 0 ? 0 : (Math.log10(loc.latencyCycles + 1) / maxLog) * 100;
      row.innerHTML =
        `<span class="t-label">${loc.label}</span>` +
        `<span class="t-track"><span class="t-fill"></span></span>` +
        `<span class="t-cycles">${loc.latencyCycles.toLocaleString('en-US')} cyc</span>`;
      bar.appendChild(row);
      const fill = row.querySelector<HTMLElement>('.t-fill')!;
      requestAnimationFrame(() => (fill.style.width = `${Math.max(pct, 3)}%`));
    }
  }

  hideTiming(): void {
    this.refs.timingBar.hidden = true;
  }

  /** Reflect engine status in the controls. */
  setStatus(status: StoryStatus): void {
    const { btnNext, btnPause } = this.refs;
    btnNext.classList.toggle('pulsing', status === 'waiting');
    btnNext.textContent = status === 'playing' ? 'Skip ▶▶' : 'Next ▶';
    btnPause.hidden = status === 'waiting';
    btnPause.textContent = status === 'paused' ? '▶' : '⏸';
  }

  clear(): void {
    this.refs.narration.innerHTML = '';
    this.hideTiming();
  }

  private emitHover(id: string, on: boolean): void {
    this.setTermGlow(id, on);
    for (const cb of this.termHoverCbs) cb(id, on);
  }

  private scrollToEnd(): void {
    this.refs.narration.scrollTop = this.refs.narration.scrollHeight;
  }
}
