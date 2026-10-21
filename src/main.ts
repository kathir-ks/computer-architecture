import './styles.css';
import { Scene } from './scene';
import { StoryEngine } from './story/StoryEngine';
import { CHAPTERS } from './story/chapters';
import { NarrationPanel, defaultPanelRefs } from './ui/NarrationPanel';
import { Highlighter } from './sync/Highlighter';
import { ALL_HIGHLIGHT_IDS, type HighlightId } from './scene/locations';
import { FreePlayPanel } from './ui/FreePlayPanel';
import { applyOutcome, emptyScoreboard, fire, type Op, type Target } from './story/freeplay';
import { parseViewParams } from './urlParams';
import { ViewDock, nextTier } from './ui/ViewDock';
import { mountStaticFallback } from './fallback/static-page';
import gsap from 'gsap';

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

  // Dev-only handle so poses can be inspected (e.g. scene.flyTo('floor10-desk').progress(1)).
  (window as unknown as { __scene: Scene }).__scene = scene;

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
    'quality cycle': () => scene.setQuality(nextTier(scene.getView().quality)),
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
  const params = parseViewParams(location.search);
  // ?nowebgl forces the fallback (manual testing per quickstart).
  if (!webglAvailable() || params.nowebgl) {
    hideLoading();
    mountStaticFallback();
    return;
  }

  const scene = new Scene(
    document.getElementById('canvas-host')!,
    document.getElementById('labels-host')!,
    // ?lowq starts on the lowest tier — weak GPUs, headless smoke tests.
    { quality: params.lowq ? 'low' : 'high', cameraMode: params.cam },
  );
  hideLoading();
  new ViewDock(document.getElementById('settings-chip')!, scene);
  if (params.worker) scene.enterWorkerView();

  // ?debug exposes state (and the scene, for inspection) to smoke tests and manual checks.
  if (params.debug) {
    (window as unknown as { __cpu: unknown }).__cpu = { view: () => scene.getView(), scene };
  }

  if (params.dev) {
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

  engine.onStatus((s) => {
    panel.setStatus(s);
    // Pausing the story pauses scripted camera steering too (FR-019).
    scene.setAutomationPaused(s === 'paused');
  });

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

  wireFreePlay(scene, panel, engine);

  // Deep links skip chapter 1's tour — reveal the labeled rooms instantly
  // so the learner never lands in a dark building.
  if (engine.state.chapterIndex > 0) {
    for (const id of ['l1i', 'l1d', 'l2', 'ram', 'disk'] as const) {
      scene.reveal(id).progress(1);
    }
  }

  // Hash navigation mid-session: reset the book and start the target chapter.
  engine.onJump(() => {
    scene.resumeCamera(); // a new chapter hands the camera back to the story
    panel.clear();
    document.getElementById('panel-controls')!.style.display = '';
    document.getElementById('freeplay')?.setAttribute('hidden', '');
    panel.setChapterProgress(engine.state.chapterIndex);
    engine.next();
  });

  // Tab hidden → pause; back → resume only what the tab-switch paused (FR-015).
  document.addEventListener('visibilitychange', () => {
    engine.handleVisibility(document.hidden);
  });

  panel.setStatus('waiting');
  engine.next(); // Auto-play the first step so the page opens alive.
}

function wireFreePlay(scene: Scene, panel: NarrationPanel, engine: StoryEngine): void {
  const fp = new FreePlayPanel(document.getElementById('panel')!);
  let board = emptyScoreboard();

  engine.onFreeplayUnlock(() => {
    document.getElementById('panel-controls')!.style.display = 'none';
    panel.showTiming(['registers', 'l1d', 'l2', 'ram', 'disk']);
    fp.show();
    fp.updateScoreboard(board);
  });

  fp.onReset(() => {
    board = emptyScoreboard();
    fp.updateScoreboard(board);
  });

  fp.onFire((op: Op, target: Target) => {
    const outcome = fire(op, target, Math.random);
    const tl = gsap.timeline({
      onComplete: () => {
        board = applyOutcome(board, outcome);
        fp.updateScoreboard(board);
        fp.setBusy(false);
      },
    });

    // Check each level in order; every level closer than the answer misses.
    const ladder = ['l1d', 'l2', 'ram', 'disk'] as const;
    const depth = ladder.indexOf(outcome.resolved);
    for (let i = 0; i < depth; i++) tl.add(scene.flash(ladder[i], 'miss'));
    tl.add(scene.flash(outcome.resolved, outcome.hit ? 'hit' : 'focus'));

    // The journey: STOREs travel outward, LOADs/ADDs travel to the desk.
    const journeyStart = tl.duration();
    if (op === 'STORE') {
      const pulse = scene.spawnPulse('registers', 'data');
      tl.add(pulse.tl);
      if (outcome.resolved === 'disk') {
        tl.add(scene.courierTrip(pulse.id, { fastForward: true }));
        tl.add(scene.deliver(pulse.id, 'disk'));
      } else {
        tl.add(scene.carry(pulse.id, 'registers', outcome.resolved));
        tl.add(scene.deliver(pulse.id, outcome.resolved));
      }
    } else {
      const pulse = scene.spawnPulse(outcome.resolved, 'data');
      tl.add(pulse.tl);
      if (outcome.resolved === 'disk') {
        tl.add(scene.courierTrip(pulse.id, { fastForward: true }));
      } else {
        tl.add(scene.carry(pulse.id, outcome.resolved, 'registers'));
      }
      tl.add(scene.deliver(pulse.id, 'worker'));

      // The Worker is stuck waiting for anything slower than the L1 shelf: tap away until the data lands (FR-011).
      if (outcome.resolved !== 'l1d') {
        const taps = gsap.timeline();
        const waitFor = tl.duration() - journeyStart;
        for (let t = 0; t < waitFor; t += 1.3) taps.add(scene.workerWork('foot-tap'));
        tl.add(taps, journeyStart);
      }
      tl.add(scene.workerWork(op === 'ADD' ? 'compute' : 'idle'));
    }

    fp.setBusy(true);
    fp.showOutcome(outcome, tl.duration());
  });
}

boot();
