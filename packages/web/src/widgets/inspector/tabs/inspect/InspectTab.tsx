import { useMemo } from "react";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import {
  useTaskDetailQuery,
  useTaskVerificationsQuery,
} from "~web/entities/task/api/detail-queries.js";
import {
  useGuidance,
  useSelectedEventId,
  useSelectedTaskId,
} from "~web/shared/store/index.js";
import { EmptyView } from "~web/shared/ui/index.js";
import { buildVerificationOverlay } from "~web/entities/task/model/timeline/verification-overlay.js";
import { findTurnForEvent } from "~web/widgets/inspector/lib/find-turn.js";
import { EventEyebrow } from "~web/widgets/inspector/tabs/inspect/EventEyebrow.js";
import { EventTitle } from "~web/widgets/inspector/tabs/inspect/EventTitle.js";
import { TurnContextSection } from "~web/widgets/inspector/tabs/inspect/TurnContextSection.js";
import { EventKvGrid } from "~web/widgets/inspector/tabs/inspect/EventKvGrid.js";
import { EventBodySection } from "~web/widgets/inspector/tabs/inspect/EventBodySection.js";
import { EventTags } from "~web/widgets/inspector/tabs/inspect/EventTags.js";
import { SubagentInsightSection } from "~web/widgets/inspector/tabs/inspect/SubagentInsightSection.js";
import { EventVerificationSection } from "~web/widgets/inspector/tabs/inspect/EventVerificationSection.js";

/** Inspect 탭 본문. */
export function InspectTab() {
  const guidance = useGuidance();
  const taskId = useSelectedTaskId();
  const eventId = useSelectedEventId();
  const { data } = useTaskDetailQuery(taskId);
  const { data: verifications } = useTaskVerificationsQuery(taskId, {
    enabled: eventId !== null,
  });

  const event: TimelineEventRecord | null = useMemo(() => {
    if (!eventId || !data) return null;
    return data.timeline.find((e) => e.id === eventId) ?? null;
  }, [eventId, data]);

  const turn = useMemo(() => {
    if (!event || !data?.turns) return undefined;
    return findTurnForEvent(event, data.turns);
  }, [event, data?.turns]);

  const verificationEntry = useMemo(() => {
    if (!eventId || !data || !verifications) return undefined;
    return buildVerificationOverlay(data.timeline, verifications).get(eventId);
  }, [data, eventId, verifications]);

  if (!event) {
    return (
      <EmptyView
        eyebrow="Inspect"
        title="Select an action to inspect."
        description={guidance.messages.inspector.selectAction}
        locale={guidance.locale}
      />
    );
  }

  return (
    <div className="px-4 py-4 border-b border-[var(--hair)]">
      <EventEyebrow event={event} />
      <EventTitle event={event} />
      <TurnContextSection turn={turn} />
      <EventVerificationSection entry={verificationEntry} />
      <EventKvGrid event={event} />
      <EventBodySection event={event} />
      <EventTags event={event} />
      {taskId && <SubagentInsightSection taskId={taskId} />}
    </div>
  );
}
