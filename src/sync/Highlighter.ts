/**
 * The one bridge between words and world: both the narration panel and the
 * scene register their elements under shared ids; hover/click route both ways.
 */

export interface HighlightTargets {
  /** Turn a 3D element's steady glow on/off. */
  glow3D: (id: string, on: boolean) => void;
  /** Scroll narration to a term and flash it. */
  focusText: (id: string) => void;
  /** Glow a term span in the panel. */
  glowText: (id: string, on: boolean) => void;
}

export class Highlighter {
  private known = new Set<string>();

  constructor(
    private targets: HighlightTargets,
    private dev = false,
  ) {}

  /** Declare an id as highlightable (scene and panel both register). */
  register(id: string): void {
    this.known.add(id);
  }

  registerAll(ids: readonly string[]): void {
    for (const id of ids) this.known.add(id);
  }

  has(id: string): boolean {
    return this.known.has(id);
  }

  /** Text hover → 3D glow (and keep the text glowing too). */
  glow(id: string, on: boolean): void {
    if (!this.check(id)) return;
    this.targets.glow3D(id, on);
    this.targets.glowText(id, on);
  }

  /** 3D click → scroll narration to the explanation. */
  focusText(id: string): void {
    if (!this.check(id)) return;
    this.targets.focusText(id);
  }

  private check(id: string): boolean {
    if (this.known.has(id)) return true;
    if (this.dev) throw new Error(`Highlighter: unknown id "${id}"`);
    console.warn(`Highlighter: unknown id "${id}" — ignored`);
    return false;
  }
}
