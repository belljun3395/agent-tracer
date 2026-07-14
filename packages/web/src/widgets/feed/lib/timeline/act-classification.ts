import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { formatHHmmss, formatOffset } from "~web/shared/lib/formatting/time.js";
import { laneThemeForEvent, type LaneTheme } from "~web/entities/task/model/lane-theme.js";
import {
  extractPaths,
  extractTokens,
  type TokensVm,
} from "~web/widgets/feed/lib/extraction/extract-metadata.js";

/** act 카드 하나를 위한 렌더링용 뷰모델. */
export interface ActVm {
  readonly event: TimelineEventRecord;
  readonly lane: LaneTheme;
  readonly clockLabel: string;
  readonly offsetLabel: string;
  readonly toolName: string;
  /**
   * 백엔드가 제공하는 세분화 라벨(read_file / run_test / apply_patch...).
   * 의미 분류기가 돌지 않았거나 라벨이 toolName과 중복되면 null이다
   * (같은 문자열을 두 번 렌더링하지 않는다).
   */
  readonly subtypeLabel: string | null;
  readonly bodyText: string | null;
  readonly hasViolation: boolean;
  readonly paths: readonly string[];
  readonly tokens: TokensVm | null;
}

export function classifyEvent(event: TimelineEventRecord, baseMs: number): ActVm {
  const eventMs = Date.parse(event.createdAt);
  const subtypeLabel = pickSubtypeLabel(event);
  return {
    event,
    lane: laneThemeForEvent(event),
    clockLabel: formatHHmmss(eventMs),
    offsetLabel: formatOffset(eventMs, baseMs),
    toolName: event.title,
    subtypeLabel,
    bodyText: event.body ?? null,
    hasViolation: detectViolation(event),
    paths: extractPaths(event),
    tokens: extractTokens(event),
  };
}

/** 보수적인 휴리스틱이다. */
function detectViolation(event: TimelineEventRecord): boolean {
  const tags = event.classification.tags;
  return tags.includes("violation");
}

/** subtypeLabel이 title과 중복되면 숨긴다. */
function pickSubtypeLabel(event: TimelineEventRecord): string | null {
  const label = event.semantic?.subtypeLabel.trim();
  if (!label) return null;
  const title = event.title.toLowerCase();
  return title.includes(label.toLowerCase()) ? null : label;
}
