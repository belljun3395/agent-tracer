import { useMemo } from "react";
import type { TimelineEventRecord } from "~domain/monitoring.js";
import { useTaskDetailQuery } from "~state/server/queries.js";
import { useSelectedEventId, useSelectedTaskId } from "~state/ui/index.js";
import { EmptyView } from "~features/shell/index.js";
import { findTurnForEvent } from "~features/inspector/lib/find-turn.js";
import { EventEyebrow } from "./EventEyebrow.js";
import { EventTitle } from "./EventTitle.js";
import { TurnContextSection } from "./TurnContextSection.js";
import { EventKvGrid } from "./EventKvGrid.js";
import { EventBodySection } from "./EventBodySection.js";
import { EventTags } from "./EventTags.js";
import { RuleMatchesSection } from "./RuleMatchesSection.js";
import { SubagentInsightSection } from "./SubagentInsightSection.js";

/**
 * Inspect tab body — finds the selected event in the cached task detail
 * and lays out a vertical stack:
 *
 *   eyebrow → title → turn context → kv grid → body → tags → rule matches
 *
 * Reuses the same React Query cache the feed populated, so this component
 * never triggers an extra fetch.
 */
export function InspectTab() {
  const taskId = useSelectedTaskId();
  const eventId = useSelectedEventId();
  const { data } = useTaskDetailQuery(taskId);

  const event: TimelineEventRecord | null = useMemo(() => {
    if (!eventId || !data) return null;
    return data.timeline.find((e) => e.id === eventId) ?? null;
  }, [eventId, data]);

  const turn = useMemo(() => {
    if (!event || !data?.turns) return undefined;
    return findTurnForEvent(event, data.turns);
  }, [event, data?.turns]);

  if (!event) {
    return (
      <EmptyView
        eyebrow="Inspect"
        title="Select an action to inspect."
        description="Click a card in the timeline to see its full payload."
      />
    );
  }

  return (
    <div className="px-4 py-4 border-b border-[var(--hair)]">
      <EventEyebrow event={event} />
      <EventTitle event={event} />
      <TurnContextSection turn={turn} />
      <EventKvGrid event={event} />
      <EventBodySection event={event} />
      <EventTags event={event} />
      <RuleMatchesSection event={event} />
      {taskId && <SubagentInsightSection taskId={taskId} />}
    </div>
  );
}
