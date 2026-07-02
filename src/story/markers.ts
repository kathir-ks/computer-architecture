/**
 * Narration marker syntax: "check the [[l1d:L1 data cache]] first"
 * → plain text with spans binding display text to highlight ids.
 */

export interface MarkerSpan {
  start: number; // index into plainText
  end: number; // exclusive
  id: string;
}

export interface ParsedNarration {
  plainText: string;
  spans: MarkerSpan[];
}

const MARKER = /\[\[([^:\]]+):([^\]]+)\]\]/g;

export function parseMarkers(raw: string): ParsedNarration {
  // Detect malformed leftovers first: unclosed "[[" or empty ids.
  const spans: MarkerSpan[] = [];
  let plainText = '';
  let last = 0;

  for (const m of raw.matchAll(MARKER)) {
    const [whole, id, display] = m;
    if (!id.trim()) throw new Error(`Empty marker id in: "${raw}"`);
    plainText += raw.slice(last, m.index);
    const start = plainText.length;
    plainText += display;
    spans.push({ start, end: plainText.length, id: id.trim() });
    last = m.index + whole.length;
  }
  plainText += raw.slice(last);

  if (plainText.includes('[[') || plainText.includes(']]')) {
    throw new Error(`Malformed marker (unbalanced [[ ]]) in: "${raw}"`);
  }
  return { plainText, spans };
}

/** All marker ids used in a raw narration string. */
export function markerIds(raw: string): string[] {
  return parseMarkers(raw).spans.map((s) => s.id);
}
