import type React from "react";
import { buildInspectorEventTitle } from "@monitor/web-core";
import type { QuestionGroup } from "@monitor/web-core";
import { Badge } from "../ui/Badge.js";
import { SectionCard } from "./SectionCard.js";
const QUESTION_PHASE_LABELS: Readonly<Record<string, string>> = {
    asked: "Asked",
    answered: "Answered",
    concluded: "Concluded"
};
export function QuestionGroupSection({ group }: {
    readonly group: QuestionGroup;
}): React.JSX.Element {
    return (<SectionCard title="Question Flow" bodyClassName="pt-4">
      <div className="flex flex-col gap-2">
        {group.phases.map(({ phase, event }) => (<div key={event.id} className="flex flex-col gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Badge tone={phase === "concluded" ? "success" : phase === "answered" ? "accent" : "neutral"} size="xs">
              {QUESTION_PHASE_LABELS[phase] ?? phase}
            </Badge>
            <span className="min-w-0 flex-1 text-[0.84rem] font-medium text-[var(--text-1)]">{buildInspectorEventTitle(event) ?? event.title}</span>
            <span className="text-[0.76rem] font-semibold text-[var(--text-3)]">{new Date(event.createdAt).toLocaleTimeString()}</span>
          </div>))}
      </div>
      {!group.isComplete && (<p className="mt-2 text-[0.8rem] text-[var(--text-3)]">Awaiting conclusion.</p>)}
    </SectionCard>);
}
