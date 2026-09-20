/** Comparison form for answers and questions: trimmed, single-spaced, lowercase. */
export function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Stable key for a question, derived from its text (FNV-1a, 32 bit). Progress
 * is stored under this key, so reordering a quiz file doesn't scramble it and
 * editing a question's text starts that question fresh.
 */
export function questionKey(text: string): string {
  const s = normalize(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
