/**
 * Tiny markdown-ish parser for event bodies. Detects ``` fenced code
 * blocks and splits the body into text + code segments. Anything more
 * complex (links, lists, inline code) is intentionally NOT supported —
 * the Inspector renders agent payloads as faithfully as possible without
 * pretending to be a full markdown viewer.
 */
export interface BodySegment {
  readonly kind: "text" | "code";
  readonly text: string;
  readonly lang?: string;
}

const FENCE = /```([\w-]*)\n?([\s\S]*?)```/g;

export function splitBodySegments(body: string): readonly BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;
  for (const match of body.matchAll(FENCE)) {
    const start = match.index;
    if (start > cursor) {
      const text = body.slice(cursor, start).trim();
      if (text) segments.push({ kind: "text", text });
    }
    const lang = match[1] || undefined;
    const code = (match[2] ?? "").replace(/\n$/, "");
    segments.push({ kind: "code", text: code, ...(lang ? { lang } : {}) });
    cursor = start + match[0].length;
  }
  if (cursor < body.length) {
    const text = body.slice(cursor).trim();
    if (text) segments.push({ kind: "text", text });
  }
  if (segments.length === 0 && body.trim()) {
    segments.push({ kind: "text", text: body });
  }
  return segments;
}
