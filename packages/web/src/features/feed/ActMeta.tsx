import type { ActVm } from "./lib/act-classification.js";
import { formatDuration } from "./lib/format-time.js";
import {
  formatCompactCount,
  type TokensVm,
} from "./lib/extract-metadata.js";

interface ActMetaProps {
  readonly vm: ActVm;
}

/**
 * Mono caption line at the bottom of an act card. Composes whichever of
 * these are present (each one optional, hidden when empty):
 *
 *   • duration  ("412ms" / "5m 33s")
 *   • subtype   ("read_file" / "apply_patch")
 *   • tokens    ("2.4k" or "1.2k in / 0.8k out" when split)
 *   • paths     (first 1 + "+N" if there are more)
 *
 * Each chunk is separated by a hairline `·` so the eye can land on any
 * one without parsing a blob.
 */
export function ActMeta({ vm }: ActMetaProps) {
  const parts = collectParts(vm);
  if (parts.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 mt-1"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--ink-subtle)",
        lineHeight: 1.5,
      }}
    >
      {parts.map((p, idx) => (
        <span key={idx} className="inline-flex items-center gap-2">
          <span>{p}</span>
          {idx < parts.length - 1 && (
            <span style={{ color: "var(--hair-strong)" }}>·</span>
          )}
        </span>
      ))}
    </div>
  );
}

function collectParts(vm: ActVm): string[] {
  const out: string[] = [];

  const durationMs = readNumber(vm.event.metadata, "durationMs", "duration_ms");
  if (durationMs !== null && durationMs > 0) {
    out.push(formatDuration(durationMs));
  }

  if (vm.subtypeLabel) {
    out.push(vm.subtypeLabel);
  }

  if (vm.tokens) {
    const label = formatTokens(vm.tokens);
    if (label) out.push(label);
  }

  if (vm.paths.length > 0) {
    const [first, ...rest] = vm.paths;
    out.push(rest.length > 0 ? `${first} +${rest.length}` : (first ?? ""));
  }

  return out;
}

function formatTokens(tokens: TokensVm): string | null {
  // Prefer split when we have both halves — it's more diagnostic than a
  // single sum (e.g. lopsided in/out ratios reveal long prompts).
  if (tokens.input !== null && tokens.output !== null) {
    return `${formatCompactCount(tokens.input)} in / ${formatCompactCount(tokens.output)} out`;
  }
  if (tokens.total !== null && tokens.total > 0) {
    return `${formatCompactCount(tokens.total)} tokens`;
  }
  return null;
}

function readNumber(
  meta: Record<string, unknown>,
  ...keys: readonly string[]
): number | null {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}
