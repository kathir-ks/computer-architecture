import * as THREE from 'three';
import { seeded } from './rand';

/**
 * Procedural textures drawn on canvases at startup — no image files (constitution III).
 * If a 2D canvas is unavailable (e.g. unit tests under jsdom) every texture degrades to an
 * empty placeholder so importing this module never throws.
 */

function draw(
  w: number,
  h: number,
  paint: (g: CanvasRenderingContext2D) => void,
  srgb = true,
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) return new THREE.Texture();
  paint(g);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function noiseFill(g: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, seed: number): void {
  const rnd = seeded(seed);
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * amp;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

/** One window tile = 2 columns (7 units) x 4 floors (12 units). Repeats align with the 3-unit floors. */
const WIN_COLS = 2;
const WIN_ROWS = 4;

export interface TextureSet {
  concrete: THREE.Texture;
  concreteBump: THREE.Texture;
  tiles: THREE.Texture;
  windowMap: THREE.Texture;
  windowEmissive: THREE.Texture;
  /** Clone a texture with its own repeat (shares the canvas; disposed with the set). */
  repeated(tex: THREE.Texture, rx: number, ry: number): THREE.Texture;
  dispose(): void;
}

export function createTextures(): TextureSet {
  const owned: THREE.Texture[] = [];
  const own = <T extends THREE.Texture>(t: T): T => {
    owned.push(t);
    return t;
  };

  const concrete = own(
    draw(256, 256, (g) => {
      noiseFill(g, 256, 256, 205, 26, 11);
      g.strokeStyle = 'rgba(40,50,80,0.35)';
      g.lineWidth = 2;
      g.strokeRect(1, 1, 254, 254);
      g.beginPath();
      g.moveTo(128, 0);
      g.lineTo(128, 256);
      g.moveTo(0, 128);
      g.lineTo(256, 128);
      g.stroke();
    }),
  );

  const concreteBump = own(draw(256, 256, (g) => noiseFill(g, 256, 256, 128, 90, 12), false));

  const tiles = own(
    draw(256, 256, (g) => {
      const rnd = seeded(21);
      for (let ty = 0; ty < 4; ty++) {
        for (let tx = 0; tx < 4; tx++) {
          const v = 196 + Math.floor(rnd() * 28);
          g.fillStyle = `rgb(${v},${v + 4},${v + 12})`;
          g.fillRect(tx * 64, ty * 64, 64, 64);
        }
      }
      g.strokeStyle = 'rgba(30,40,70,0.55)';
      g.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo(i * 64, 0);
        g.lineTo(i * 64, 256);
        g.moveTo(0, i * 64);
        g.lineTo(256, i * 64);
        g.stroke();
      }
    }),
  );

  // Window colour map + emissive map share one random lit pattern.
  const W = 256;
  const H = 440;
  const cellW = W / WIN_COLS;
  const cellH = H / WIN_ROWS;
  const rnd = seeded(33);
  const lit: Array<'off' | 'warm' | 'cool'> = [];
  for (let i = 0; i < WIN_COLS * WIN_ROWS; i++) {
    const r = rnd();
    lit.push(r < 0.5 ? 'off' : r < 0.82 ? 'warm' : 'cool');
  }
  const eachCell = (fn: (x: number, y: number, state: 'off' | 'warm' | 'cool') => void) => {
    for (let row = 0; row < WIN_ROWS; row++) {
      for (let col = 0; col < WIN_COLS; col++) {
        // Canvas y runs downward; texture row 0 is the top of the tile.
        fn(col * cellW, row * cellH, lit[row * WIN_COLS + col]);
      }
    }
  };

  const windowMap = own(
    draw(W, H, (g) => {
      g.fillStyle = '#c9d2e6';
      g.fillRect(0, 0, W, H);
      eachCell((x, y) => {
        g.fillStyle = '#26314f';
        g.fillRect(x + 30, y + 30, cellW - 60, cellH - 64);
        g.fillStyle = 'rgba(160,190,255,0.18)';
        g.fillRect(x + 30, y + 30, cellW - 60, (cellH - 64) * 0.35);
        g.fillStyle = '#9aa6c2';
        g.fillRect(x + cellW / 2 - 2, y + 30, 4, cellH - 64);
      });
    }),
  );

  const windowEmissive = own(
    draw(W, H, (g) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      eachCell((x, y, state) => {
        if (state === 'off') return;
        g.fillStyle = state === 'warm' ? '#ffd9a0' : '#7fe6ff';
        g.fillRect(x + 30, y + 30, cellW - 60, cellH - 64);
      });
    }),
  );

  return {
    concrete,
    concreteBump,
    tiles,
    windowMap,
    windowEmissive,
    repeated(tex, rx, ry) {
      const t = own(tex.clone());
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
      return t;
    },
    dispose() {
      for (const t of owned) t.dispose();
    },
  };
}

/** Tile geometry of the window texture in world units (2 columns x 4 floors). */
export const WINDOW_TILE = { w: 7, h: 12 } as const;
