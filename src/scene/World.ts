import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { PALETTE } from './Building';

/**
 * Allowed camera orbit range (data-model ViewingArc): a front arc from which
 * every cutaway room stays visible. Azimuth is measured from +z (the open face).
 */
export const VIEW_ARC = {
  minAzimuth: (-80 * Math.PI) / 180,
  maxAzimuth: (80 * Math.PI) / 180,
  minPolar: Math.PI * 0.15,
  maxPolar: Math.PI * 0.52,
};

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

    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.sky, 60, 140);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 300);
    this.camera.position.set(28, 22, 34);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 90;
    this.controls.minDistance = 4;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.target.set(0, 14, 0);

    // Lights: cool ambient night + warm key.
    this.scene.add(new THREE.HemisphereLight(0x33415e, 0x0a0e1a, 0.9));
    const key = new THREE.DirectionalLight(0xfff2dd, 1.1);
    key.position.set(24, 40, 18);
    this.scene.add(key);

    // User grabbing the canvas must instantly win over scripted camera moves.
    this.renderer.domElement.addEventListener('pointerdown', () => {
      for (const cb of this.grabCallbacks) cb();
    });

    window.addEventListener('resize', () => this.resize(canvasHost));
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
      this.controls.update();
      for (const cb of this.frameCallbacks) cb(dt);

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
