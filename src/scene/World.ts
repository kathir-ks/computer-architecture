import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ENV_ON = 0.45;
const HEMI_ENV_ON = 1.1;
const HEMI_ENV_OFF = 1.7;
/** Keys OrbitControls moves the camera with; pressing one counts as the learner taking control. */
const CAMERA_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * Owns renderer, camera, orbit controls, label overlay and the render loop.
 * Knows nothing about the building or the story.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  readonly controls: OrbitControls;
  readonly keyLight: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private pmrem: THREE.PMREMGenerator;
  private envTexture: THREE.Texture;

  /** Optional composer-style render override (set by Neon when bloom is on). */
  renderOverride: (() => void) | null = null;

  private frameCallbacks = new Set<(dt: number) => void>();
  private fpsCallbacks = new Set<(fps: number) => void>();
  private grabCallbacks = new Set<() => void>();
  private clock = new THREE.Clock();
  private frameCount = 0;
  private frameTimeAccum = 0;

  constructor(canvasHost: HTMLElement, labelsHost: HTMLElement) {
    const w = canvasHost.clientWidth || window.innerWidth;
    const h = canvasHost.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    canvasHost.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    labelsHost.appendChild(this.labelRenderer.domElement);

    this.scene.background = new THREE.Color(0x0a0e1a);
    this.scene.fog = new THREE.Fog(0x0a0e1a, 60, 140);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 300);
    this.camera.position.set(28, 22, 34);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 90;
    this.controls.minDistance = 4;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.target.set(0, 14, 0);

    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Image-based light from a procedural room — reflections and fill without any asset files.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = ENV_ON;

    // Lights: readable cool-blue night, warm key from the front-right, cool fill from the left.
    this.hemi = new THREE.HemisphereLight(0x8fa6d8, 0x1d2540, HEMI_ENV_ON);
    this.scene.add(this.hemi);
    this.keyLight = new THREE.DirectionalLight(0xfff0dc, 1.5);
    this.keyLight.position.set(24, 40, 18);
    this.keyLight.target.position.set(0, 14, 0);
    const sh = this.keyLight.shadow;
    sh.mapSize.set(1024, 1024);
    sh.camera.left = -34;
    sh.camera.right = 34;
    sh.camera.top = 34;
    sh.camera.bottom = -34;
    sh.camera.near = 5;
    sh.camera.far = 110;
    sh.bias = -0.0004;
    sh.normalBias = 0.04;
    this.scene.add(this.keyLight, this.keyLight.target);
    const fill = new THREE.DirectionalLight(0x86a8ff, 0.55);
    fill.position.set(-26, 18, 30);
    this.scene.add(fill);

    // Any learner input on the view must instantly win over scripted camera moves (FR-016):
    // mouse/pen, wheel, touch, and the keys that orbit/pan/zoom.
    const grab = () => {
      for (const cb of this.grabCallbacks) cb();
    };
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', grab);
    el.addEventListener('wheel', grab, { passive: true });
    el.addEventListener('touchstart', grab, { passive: true });
    this.controls.listenToKeyEvents(window);
    window.addEventListener('keydown', (e) => {
      if (!CAMERA_KEYS.has(e.key)) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      grab();
    });

    window.addEventListener('resize', () => this.resize(canvasHost));
  }

  /** Soft shadows from the key light (high tier only). Materials must recompile when this flips. */
  setShadowsEnabled(on: boolean): void {
    if (this.renderer.shadowMap.enabled === on) return;
    this.renderer.shadowMap.enabled = on;
    this.keyLight.castShadow = on;
    this.refreshMaterials();
  }

  /** Procedural environment light. Without it the hemisphere light is lifted to keep the scene readable. */
  setEnvEnabled(on: boolean): void {
    this.scene.environment = on ? this.envTexture : null;
    this.scene.environmentIntensity = on ? ENV_ON : 0;
    this.hemi.intensity = on ? HEMI_ENV_ON : HEMI_ENV_OFF;
    this.refreshMaterials();
  }

  private refreshMaterials(): void {
    this.scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      for (const m of Array.isArray(mat) ? mat : [mat]) m.needsUpdate = true;
    });
  }

  private resize(host: HTMLElement): void {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.resizeCallbacks.forEach((cb) => cb(w, h));
  }

  private resizeCallbacks: Array<(w: number, h: number) => void> = [];
  onResize(cb: (w: number, h: number) => void): void {
    this.resizeCallbacks.push(cb);
  }

  onFrame(cb: (dt: number) => void): void {
    this.frameCallbacks.add(cb);
  }

  /** Rolling average fps, reported once per 60 frames (feeds the quality watchdog). */
  onFps(cb: (fps: number) => void): void {
    this.fpsCallbacks.add(cb);
  }

  /** Fired on pointerdown on the canvas — used to kill scripted camera tweens. */
  onUserGrab(cb: () => void): void {
    this.grabCallbacks.add(cb);
  }

  start(): void {
    this.renderer.setAnimationLoop(() => {
      const dt = this.clock.getDelta();
      // Scripted camera first (rig), then OrbitControls applies learner damping on top.
      for (const cb of this.frameCallbacks) cb(dt);
      this.controls.update();

      if (this.renderOverride) this.renderOverride();
      else this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);

      this.frameTimeAccum += dt;
      if (++this.frameCount >= 60) {
        const fps = this.frameCount / this.frameTimeAccum;
        this.frameCount = 0;
        this.frameTimeAccum = 0;
        for (const cb of this.fpsCallbacks) cb(fps);
      }
    });
  }
}
