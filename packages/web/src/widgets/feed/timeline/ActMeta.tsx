import type { ActVm } from "~web/widgets/feed/lib/timeline/act-classification.js";
import { formatDuration } from "~web/shared/lib/formatting/time.js";
import {
  formatCompactCount,
  type TokensVm,
} from "~web/widgets/feed/lib/extraction/extract-metadata.js";
import { readMetaNumberByKeys } from "~web/widgets/feed/lib/extraction/read-meta.js";

const DURATION_KEYS = ["durationMs", "duration_ms"] as const;

interface ActMetaProps {
  readonly vm: ActVm;
}

/** act 카드 하단의 모노 캡션 줄. */
export function ActMeta({ vm }: ActMetaProps) {
  const parts = collectParts(vm);
  if (parts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1 font-mono text-[11px] text-ink-subtle leading-[1.5]">
      {parts.map((p, idx) => (
        <span key={idx} className="inline-flex items-center gap-2">
          <span>{p}</span>
          {idx < parts.length - 1 && (
            <span className="text-hair-strong">·</span>
          )}
        </span>
      ))}
    </div>
  );
}

function collectParts(vm: ActVm): string[] {
  const out: string[] = [];

  const durationMs = readMetaNumberByKeys(vm.event.metadata, DURATION_KEYS);
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
  // 두 값이 모두 있으면 분리해서 보여준다.
  if (tokens.input !== null && tokens.output !== null) {
    return `${formatCompactCount(tokens.input)} in / ${formatCompactCount(tokens.output)} out`;
  }
  if (tokens.total !== null && tokens.total > 0) {
    return `${formatCompactCount(tokens.total)} tokens`;
  }
  return null;
}
