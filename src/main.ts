import './styles.css';
import { Scene } from './scene';
import { StoryEngine } from './story/StoryEngine';
import { CHAPTERS } from './story/chapters';
import { NarrationPanel, defaultPanelRefs } from './ui/NarrationPanel';
import { Highlighter } from './sync/Highlighter';
import { ALL_HIGHLIGHT_IDS, type HighlightId } from './scene/locations';

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function hideLoading(): void {
  document.getElementById('loading')?.classList.add('hidden');
}

/** ?dev — buttons for every scene verb, for manual choreography testing (T014). */
function mountDevHarness(scene: Scene): void {
  const narration = document.getElementById('narration')!;
  narration.innerHTML = '<p class="chapter-title">Dev harness — scene verbs</p>';
  const controls = document.getElementById('panel-controls')!;
  controls.style.display = 'none';

  let lastPulse = -1;
  const actions: Record<string, () => unknown> = {
    'flyTo street': () => scene.flyTo('street'),
    'flyTo desk': () => scene.flyTo('floor10-desk'),
    'flyTo shelves': () => scene.flyTo('floor9-shelves'),
    'flyTo storeroom': () => scene.flyTo('floor8-storeroom'),
    'flyTo archive': () => scene.flyTo('floor4-archive'),
    'flyTo warehouse': () => scene.flyTo('warehouse'),
    'flyTo lift': () => scene.flyTo('lift-shaft'),
    'flyTo recap': () => scene.flyTo('recap-wide'),
    'reveal l1i': () => scene.reveal('l1i'),
    'reveal l1d': () => scene.reveal('l1d'),
    'reveal l2': () => scene.reveal('l2'),
    'reveal ram': () => scene.reveal('ram'),
    'reveal disk': () => scene.reveal('disk'),
    'flash l1d hit': () => scene.flash('l1d', 'hit'),
    'flash l1d miss': () => scene.flash('l1d', 'miss'),
    'flash l2 miss': () => scene.flash('l2', 'miss'),
    'work compute': () => scene.workerWork('compute'),
    'work read-card': () => scene.workerWork('read-card'),
    'work foot-tap': () => scene.workerWork('foot-tap'),
    'drawer put r1': () => scene.drawer('put', 'r1'),
    'drawer take r2': () => scene.drawer('take', 'r2'),
    'dispense ticket': () => scene.dispenseTicket(),
    'show card': () => scene.showCard(),
    'split card': () => scene.splitCard(),
    'pulse @l1d': () => (lastPulse = scene.spawnPulse('l1d', 'data').id),
    'pulse @ram': () => (lastPulse = scene.spawnPulse('ram', 'data').id),
    'carry l1d→registers': () => scene.carry(lastPulse, 'l1d', 'registers'),
    'carry ram→registers': () => scene.carry(lastPulse, 'ram', 'registers'),
    'courier trip': () => {
      lastPulse = scene.spawnPulse('disk', 'data').id;
      scene.courierTrip(lastPulse, { fastForward: true });
    },
    'deliver → worker': () => scene.deliver(lastPulse, 'worker'),
    'mood tense': () => scene.setMood('tense-miss'),
    'mood working': () => scene.setMood('working'),
    'quality toggle': () => scene.neon.setQuality(!scene.neon.isOn),
  };

  const wrap = document.createElement('div');
  wrap.className = 'fp-options';
  for (const [name, fn] of Object.entries(actions)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.style.margin = '2px';
    b.addEventListener('click', fn);
    wrap.appendChild(b);
  }
  narration.appendChild(wrap);
}

function boot(): void {
  if (!webglAvailable()) {
    // Full fallback arrives in T034; until then, show a plain message.
    hideLoading();
    document.getElementById('app')!.innerHTML =
      '<div id="fallback"><p class="para">This experience needs WebGL, which your browser does not support.</p></div>';
    return;
  }

  const scene = new Scene(
    document.getElementById('canvas-host')!,
    document.getElementById('labels-host')!,
  );
  hideLoading();

  if (new URLSearchParams(location.search).has('dev')) {
    mountDevHarness(scene);
    return;
  }

  wireStory(scene);
}

function wireStory(scene: Scene): void {
  const panel = new NarrationPanel(defaultPanelRefs());
  const engine = new StoryEngine(CHAPTERS, scene);

  panel.initProgress(CHAPTERS.length);

  engine.onStep((e) => {
    const step = e.chapter.steps[e.stepIndex];
    if (e.isChapterStart) {
      panel.addChapterTitle(e.chapter.title);
      panel.setChapterProgress(e.chapterIndex);
    }
    panel.addParagraph(step.narration);
    if (step.timing) panel.showTiming(step.timing);
    else panel.hideTiming();
  });

  engine.onStatus((s) => panel.setStatus(s));

  panel.onNext(() => engine.next());
  panel.onPauseToggle(() => {
    if (engine.state.status === 'paused') engine.resume();
    else engine.pause();
  });

  // Two-way term↔world sync through the Highlighter registry (US2).
  const highlighter = new Highlighter(
    {
      glow3D: (id, on) => scene.setGlow(id as HighlightId, on),
      focusText: (id) => panel.focusText(id),
      glowText: (id, on) => panel.setTermGlow(id, on),
    },
    import.meta.env.DEV,
  );
  highlighter.registerAll(ALL_HIGHLIGHT_IDS);

  panel.onTermHover((id, on) => highlighter.glow(id, on));
  panel.onTermClick((id) => highlighter.glow(id, true));
  scene.onElementClick((id) => {
    highlighter.focusText(id);
    highlighter.glow(id, true);
    setTimeout(() => highlighter.glow(id, false), 1200);
  });

  engine.onFreeplayUnlock(() => {
    // FreePlayPanel arrives in Phase 5; until then, celebrate quietly.
    panel.setStatus('waiting');
  });

  // Deep links skip chapter 1's tour — reveal the labeled rooms instantly
  // so the learner never lands in a dark building.
  if (engine.state.chapterIndex > 0) {
    for (const id of ['l1i', 'l1d', 'l2', 'ram', 'disk'] as const) {
      scene.reveal(id).progress(1);
    }
  }

  panel.setStatus('waiting');
  engine.next(); // Auto-play the first step so the page opens alive.
}

boot();
