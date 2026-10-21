/** Reduced-motion preference. Camera moves and decorative loops scale by it; teaching animations never do. */

export type MotionProvider = () => boolean;

const REDUCED_FACTOR = 0.35;

const systemProvider: MotionProvider = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let provider: MotionProvider = systemProvider;
const subscribers = new Set<(reduced: boolean) => void>();
let mediaListenerAttached = false;

function notify(): void {
  const reduced = provider();
  for (const cb of subscribers) cb(reduced);
}

function attachMediaListener(): void {
  if (mediaListenerAttached || provider !== systemProvider) return;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  mediaListenerAttached = true;
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', notify);
}

export function reducedMotion(): boolean {
  return provider();
}

/** Shorten a camera / decorative duration when the learner prefers reduced motion. */
export function scaleDuration(seconds: number): number {
  return reducedMotion() ? seconds * REDUCED_FACTOR : seconds;
}

/** Fires when the preference changes. Returns an unsubscribe function. */
export function onReducedMotionChange(cb: (reduced: boolean) => void): () => void {
  attachMediaListener();
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

/** Test seam: replace the system preference. Pass null to restore it. */
export function setMotionProvider(next: MotionProvider | null): void {
  provider = next ?? systemProvider;
  notify();
}
