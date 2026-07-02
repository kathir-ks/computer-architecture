import './styles.css';
import { Scene } from './scene';

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

  // Story wiring lands in T024.
  scene.flyTo('building-front');
}

boot();
