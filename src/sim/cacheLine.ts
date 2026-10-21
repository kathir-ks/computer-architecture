/**
 * Why a cache miss brings neighbours along: memory is fetched in aligned blocks (cache lines), not one item
 * at a time. A pure model with no DOM, so the locality strip is only a view of it.
 */
export interface LineAccess {
  hit: boolean;
  /** Cells that became resident because of this access (empty on a hit). */
  filled: number[];
}

export class CacheLineSim {
  readonly cells: number;
  readonly lineSize: number;
  private present: boolean[];

  constructor(cells = 16, lineSize = 4) {
    if (!Number.isInteger(cells) || cells < 1) throw new RangeError(`cells must be a positive integer, got ${cells}`);
    if (!Number.isInteger(lineSize) || lineSize < 1) {
      throw new RangeError(`lineSize must be a positive integer, got ${lineSize}`);
    }
    this.cells = cells;
    this.lineSize = lineSize;
    this.present = new Array<boolean>(cells).fill(false);
  }

  /** Which cells are cached right now (a copy). */
  get resident(): boolean[] {
    return [...this.present];
  }

  /** First cell of the aligned line that holds `index`. */
  lineStart(index: number): number {
    this.check(index);
    return Math.floor(index / this.lineSize) * this.lineSize;
  }

  /** Every cell of the aligned line that holds `index` (the last line may be shorter). */
  lineOf(index: number): number[] {
    const start = this.lineStart(index);
    const end = Math.min(start + this.lineSize, this.cells);
    return Array.from({ length: end - start }, (_, i) => start + i);
  }

  /** A hit changes nothing; a miss makes the whole aligned line resident. */
  access(index: number): LineAccess {
    this.check(index);
    if (this.present[index]) return { hit: true, filled: [] };
    const line = this.lineOf(index);
    for (const i of line) this.present[i] = true;
    return { hit: false, filled: line };
  }

  reset(): void {
    this.present.fill(false);
  }

  private check(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.cells) {
      throw new RangeError(`cell ${index} is outside 0..${this.cells - 1}`);
    }
  }
}
