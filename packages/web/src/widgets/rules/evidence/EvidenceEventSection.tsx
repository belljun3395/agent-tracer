import type { EventId } from "~web/shared/identity.js";
import type {
  RuleEvidenceEvent,
  RuleMatchedBy,
} from "~web/entities/rule/model/rule-evidence.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { formatHHmm } from "~web/shared/lib/formatting/time.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, Tooltip } from "~web/shared/ui/index.js";
import {
  evidenceToneClasses,
  type EvidenceTone,
} from "~web/widgets/rules/evidence/evidence-tone.js";
import { pickEvidenceIcon } from "~web/widgets/rules/evidence/pick-evidence-icon.js";
import { ruleMatchedByLabel } from "~web/widgets/rules/evidence/rule-matched-by-label.js";

interface EvidenceEventSectionProps {
  readonly label: string;
  readonly tone: EvidenceTone;
  readonly count: number;
  readonly events: readonly RuleEvidenceEvent[];
  readonly onJump: (eventId: EventId) => void;
}

/** 같은 역할의 규칙 증거 이벤트와 선택 이동 동작을 표시한다. */
export function EvidenceEventSection({
  label,
  tone,
  count,
  events,
  onJump,
}: EvidenceEventSectionProps) {
  const toneClasses = evidenceToneClasses(tone);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.08em]">
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", toneClasses.dot)}
        />
        <span className={toneClasses.text}>{label}</span>
        <span className="text-ink-tertiary">({count})</span>
      </div>
      {events.map((event) => (
        <EvidenceEventRow
          key={`${label}-${event.eventId}`}
          event={event}
          onJump={onJump}
        />
      ))}
    </div>
  );
}

function EvidenceEventRow({
  event,
  onJump,
}: {
  readonly event: RuleEvidenceEvent;
  readonly onJump: (eventId: EventId) => void;
}) {
  const icon = pickEvidenceIcon(event);
  const primary = event.filePath ?? event.command ?? event.title;
  const time = formatHHmm(event.createdAt);
  const isPathLike = Boolean(event.filePath || event.command);
  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onJump(event.eventId as EventId);
      }}
      className="text-left flex items-center gap-1.5 py-[3px] px-1.5 bg-transparent border border-transparent rounded-xs text-[11.5px] text-ink cursor-pointer hover:bg-s2 hover:border-hair"
    >
      <span className="w-3.5 text-ink-tertiary">{icon}</span>
      <span
        className={cn(
          "flex-1 min-w-0 truncate",
          isPathLike ? "font-mono text-[11px]" : "text-[11.5px]",
        )}
      >
        {primary}
      </span>
      {event.toolName && isPathLike && (
        <span className="text-[10px] text-ink-tertiary font-mono whitespace-nowrap">
          {event.toolName}
        </span>
      )}
      <span className="text-[9.5px] text-ink-tertiary font-mono whitespace-nowrap">
        {time}
      </span>
      {event.matchedBy.length > 0 && (
        <MatchedByChips
          labels={event.matchedBy}
          matchKind={event.matchKind}
        />
      )}
      <span
        className={cn(
          "text-[9px] font-mono uppercase tracking-[0.05em] py-px px-1.5 rounded-xs",
          event.unfulfilled
            ? "text-warn bg-warn/12"
            : event.matchKind === "trigger"
              ? "text-primary-hover bg-primary/18"
              : "text-ink-tertiary bg-s2",
        )}
      >
        {event.matchKind === "trigger"
          ? event.unfulfilled
            ? "trigger ⚠"
            : "trigger"
          : "action"}
      </span>
    </button>
  );
}

function MatchedByChips({
  labels,
  matchKind,
}: {
  readonly labels: readonly RuleMatchedBy[];
  readonly matchKind: "trigger" | "expect-fulfilled";
}) {
  const guidance = useGuidance();
  return (
    <span className="inline-flex gap-[3px]">
      {labels.map((label) => (
        <Tooltip
          key={label}
          content={
            <GuidanceText
              locale={guidance.locale}
              message={
                matchKind === "trigger"
                  ? guidance.messages.rules.evidence.matchedTrigger
                  : guidance.messages.rules.evidence.matchedCondition(label)
              }
            />
          }
        >
          <span className="text-[9px] font-mono text-ink-tertiary py-px px-1.5 rounded-xs border border-hair bg-canvas">
            {ruleMatchedByLabel(label)}
          </span>
        </Tooltip>
      ))}
    </span>
  );
}
