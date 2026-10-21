import type { CameraMode } from './scene/view/viewState';

export interface ViewParams {
  cam?: CameraMode;
  xray: boolean;
  /** `?view=worker` starts in Worker first-person view. */
  worker: boolean;
  lowq: boolean;
  debug: boolean;
  dev: boolean;
  nowebgl: boolean;
}

const CAM_MODES: readonly CameraMode[] = ['free', 'follow', 'cinematic'];

/** Pure parse of the URL query string; unknown or invalid values are ignored. */
export function parseViewParams(search: string): ViewParams {
  const p = new URLSearchParams(search);
  const cam = p.get('cam');
  return {
    cam: CAM_MODES.includes(cam as CameraMode) ? (cam as CameraMode) : undefined,
    xray: p.has('xray'),
    worker: p.get('view') === 'worker',
    lowq: p.has('lowq'),
    debug: p.has('debug'),
    dev: p.has('dev'),
    nowebgl: p.has('nowebgl'),
  };
}
