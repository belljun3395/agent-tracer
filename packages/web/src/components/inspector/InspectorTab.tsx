import type React from "react";
import { useEffect, useState } from "react";
import { getEventEvidence } from "@monitor/core";
import { buildInspectorEventTitle, evidenceTone, formatEvidenceLevel, type BookmarkRecord, type ModelSummary, type QuestionGroup, type TaskDetailResponse, type TimelineConnector, type TimelineEvent, type TodoGroup } from "@monitor/web-domain";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { QuestionGroupSection } from "./QuestionGroupSection.js";
import { TodoGroupSection } from "./TodoGroupSection.js";
import {
    DetailCaptureInfo,
    DetailConnectorEvents,
    DetailConnectorIds,
    DetailEventEvidence,
    DetailIds,
    DetailMatchList,
    DetailModelInfo,
    DetailRelatedEvents,
    DetailSection,
    DetailTags,
    DetailTaskModel,
    DetailTokenUsage,
    InspectorHeaderCard
} from "./InspectorDetails.js";

interface SelectedConnectorData {
    readonly connector: TimelineConnector;
    readonly source: TimelineEvent;
    readonly target: TimelineEvent;
}

export interface InspectorTabProps {
    readonly selectedEvent: TimelineEvent | null;
    readonly selectedConnector: SelectedConnectorData | null;
    readonly selectedEventDisplayTitle: string | null;
    readonly selectedEventDisplayTitleOverride: string | null;
    readonly canEditSelectedEventTitle: boolean;
    readonly selectedTaskBookmark?: BookmarkRecord | null;
    readonly selectedEventBookmark?: BookmarkRecord | null;
    readonly eventTime: string | null;
    readonly questionGroups: readonly QuestionGroup[];
    readonly todoGroups: readonly TodoGroup[];
    readonly relatedEvents: readonly TimelineEvent[];
    readonly selectedTag: string | null;
    readonly selectedRuleId: string | null;
    readonly onCreateTaskBookmark: () => void;
    readonly onCreateEventBookmark: () => void;
    readonly onUpdateEventDisplayTitle: (eventId: string, displayTitle: string | null) => Promise<void>;
    readonly onSelectTag: (tag: string | null) => void;
    readonly onSelectRule: (ruleId: string | null) => void;
    readonly onOpenTaskWorkspace?: () => void;
    readonly openWorkspaceLabel: string;
    readonly obsBadges: ReadonlyArray<{ key: string; label: string; value: number; tone: "accent" | "success" | "neutral" | "warning" | "danger" }>;
    readonly showInspectorSummaryFooter: boolean;
    readonly taskModelSummary?: ModelSummary | undefined;
    readonly taskDetail: TaskDetailResponse | null;
}

export function InspectorTab({
    selectedEvent,
    selectedConnector,
    selectedEventDisplayTitle,
    selectedEventDisplayTitleOverride,
    canEditSelectedEventTitle,
    selectedTaskBookmark = null,
    selectedEventBookmark = null,
    eventTime,
    questionGroups,
    todoGroups,
    relatedEvents,
    selectedTag,
    selectedRuleId,
    onCreateTaskBookmark,
    onCreateEventBookmark,
    onUpdateEventDisplayTitle,
    onSelectTag,
    onSelectRule,
    onOpenTaskWorkspace,
    openWorkspaceLabel,
    obsBadges,
    showInspectorSummaryFooter,
    taskModelSummary,
    taskDetail,
}: InspectorTabProps): React.JSX.Element {
    const [isEditingEventTitle, setIsEditingEventTitle] = useState(false);
    const [eventTitleDraft, setEventTitleDraft] = useState("");
    const [eventTitleError, setEventTitleError] = useState<string | null>(null);
    const [isSavingEventTitle, setIsSavingEventTitle] = useState(false);

    useEffect(() => {
        setIsEditingEventTitle(false);
        setEventTitleDraft(selectedEventDisplayTitle ?? "");
        setEventTitleError(null);
        setIsSavingEventTitle(false);
    }, [selectedEventDisplayTitle]);

    const selectedEventEvidence = selectedEvent
        ? getEventEvidence(taskDetail?.task.runtimeSource, selectedEvent)
        : null;

    async function handleEventTitleSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!selectedEvent || !canEditSelectedEventTitle) {
            return;
        }
        const trimmed = eventTitleDraft.trim();
        if (!trimmed) {
            setEventTitleError("Title cannot be empty.");
            return;
        }
        setIsSavingEventTitle(true);
        setEventTitleError(null);
        try {
            await onUpdateEventDisplayTitle(selectedEvent.id, trimmed);
            setIsEditingEventTitle(false);
        }
        catch (error) {
            setEventTitleError(error instanceof Error ? error.message : "Failed to save event title.");
        }
        finally {
            setIsSavingEventTitle(false);
        }
    }

    async function handleResetEventTitle(): Promise<void> {
        if (!selectedEvent || !canEditSelectedEventTitle) {
            return;
        }
        setIsSavingEventTitle(true);
        setEventTitleError(null);
        try {
            await onUpdateEventDisplayTitle(selectedEvent.id, null);
            setIsEditingEventTitle(false);
        }
        catch (error) {
            setEventTitleError(error instanceof Error ? error.message : "Failed to reset event title.");
        }
        finally {
            setIsSavingEventTitle(false);
        }
    }

    return (<>
        <div className="px-4 pt-4">
          <InspectorHeaderCard actions={(<>
                <div className="flex flex-wrap items-center gap-2">
          <Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" onClick={onCreateTaskBookmark} size="sm" type="button" variant="ghost">
                  {selectedTaskBookmark ? "Task Saved" : "Save Task"}
                  </Button>
                  {selectedEvent && (<Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" onClick={onCreateEventBookmark} size="sm" type="button" variant="ghost">
                      {selectedEventBookmark ? "Card Saved" : "Save Card"}
                    </Button>)}
                  {selectedEvent && canEditSelectedEventTitle && !isEditingEventTitle && (<Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" onClick={() => {
                    setEventTitleDraft(selectedEventDisplayTitle ?? "");
                    setEventTitleError(null);
                    setIsEditingEventTitle(true);
                }} size="sm" type="button" variant="ghost">
                      Rename Card
                    </Button>)}
                  {selectedEvent && canEditSelectedEventTitle && selectedEventDisplayTitleOverride && !isEditingEventTitle && (<Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" onClick={() => { void handleResetEventTitle(); }} size="sm" type="button" variant="ghost">
                      Reset Title
                    </Button>)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                {selectedConnector ? (<Badge tone="neutral" size="xs" className="uppercase tracking-[0.06em]">
                    {selectedConnector.connector.isExplicit ? "relation" : "transition"} · {selectedConnector.connector.cross ? "cross-lane" : "same-lane"}
                  </Badge>) : selectedEvent ? (<Badge tone="neutral" size="xs" className="uppercase tracking-[0.06em]">{selectedEvent.kind} · {selectedEvent.lane}</Badge>) : null}
                {selectedEventEvidence && (<Badge tone={evidenceTone(selectedEventEvidence.level)} size="xs">
                    {formatEvidenceLevel(selectedEventEvidence.level)}
                  </Badge>)}
                {eventTime && <Badge tone="accent" size="xs">{eventTime}</Badge>}
                </div>
              </>)} description={selectedConnector
            ? `${selectedConnector.connector.isExplicit ? "Explicit relation" : "Fallback sequence"} linking ${selectedConnector.source.lane} to ${selectedConnector.target.lane}.`
            : selectedEvent
                ? `${selectedEvent.kind} in ${selectedEvent.lane}.`
                : "Choose an event or connector to inspect its full timeline context."} eyebrow="Inspector" title={selectedConnector
            ? `${buildInspectorEventTitle(selectedConnector.source) ?? selectedConnector.source.title} → ${buildInspectorEventTitle(selectedConnector.target) ?? selectedConnector.target.title}`
            : selectedEventDisplayTitle ?? "Select an event"}>
            {selectedEvent && canEditSelectedEventTitle && isEditingEventTitle && (<form className="mt-4 flex flex-col gap-2" onSubmit={(event) => { void handleEventTitleSubmit(event); }}>
                <input className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[0.84rem] text-[var(--text-1)] outline-none transition-colors focus:border-[var(--accent)]" disabled={isSavingEventTitle} onChange={(event) => setEventTitleDraft(event.target.value)} placeholder="Short title for this card" type="text" value={eventTitleDraft}/>
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="h-7 rounded-[var(--radius-md)] border-[var(--accent)] bg-[var(--accent-light)] px-2.5 text-[0.72rem] font-semibold text-[var(--accent)] shadow-none hover:border-[var(--accent)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]" disabled={isSavingEventTitle} size="sm" type="submit">
                    {isSavingEventTitle ? "Saving..." : "Save"}
                  </Button>
                  <Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" disabled={isSavingEventTitle} onClick={() => {
                setEventTitleDraft(selectedEventDisplayTitle ?? "");
                setEventTitleError(null);
                setIsEditingEventTitle(false);
            }} size="sm" type="button">
                    Cancel
                  </Button>
                  {selectedEventDisplayTitleOverride && (<Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" disabled={isSavingEventTitle} onClick={() => { void handleResetEventTitle(); }} size="sm" type="button">
                      Reset to Raw
                    </Button>)}
                </div>
                <p className="m-0 text-[0.76rem] text-[var(--text-3)]">
                  Raw event title is preserved. This only changes the inspector display title.
                </p>
                {eventTitleError && <p className="m-0 text-[0.76rem] font-medium text-[var(--err)]">{eventTitleError}</p>}
              </form>)}
          </InspectorHeaderCard>
        </div>

        {selectedConnector ? (<div className="flex flex-col gap-5 px-4 py-5">
            <DetailSection label="Full Context" resizable value={[
                `${selectedConnector.connector.isExplicit ? "Explicit relation" : "Fallback sequence"} from ${selectedConnector.source.lane} to ${selectedConnector.target.lane}.`,
                selectedConnector.connector.label ? `Label: ${selectedConnector.connector.label}` : undefined,
                selectedConnector.connector.explanation,
                `From: ${buildInspectorEventTitle(selectedConnector.source) ?? selectedConnector.source.title}`,
                `To: ${buildInspectorEventTitle(selectedConnector.target) ?? selectedConnector.target.title}`
            ].filter((value): value is string => Boolean(value)).join("\n")}/>
            <DetailConnectorIds connector={selectedConnector.connector} source={selectedConnector.source} target={selectedConnector.target}/>
            <DetailTags title="Transition Tags" values={[
                selectedConnector.connector.isExplicit ? "explicit" : "inferred",
                selectedConnector.connector.cross ? "cross-lane" : "same-lane",
                selectedConnector.source.lane,
                selectedConnector.target.lane,
                selectedConnector.connector.relationType ?? "relates_to"
            ]}/>
            <DetailConnectorEvents source={selectedConnector.source} target={selectedConnector.target}/>
            <DetailSection label="Metadata" mono value={JSON.stringify({
                connectorKey: selectedConnector.connector.key,
                sourceEventId: selectedConnector.source.id,
                targetEventId: selectedConnector.target.id,
                sourceLane: selectedConnector.source.lane,
                targetLane: selectedConnector.target.lane,
                relationType: selectedConnector.connector.relationType,
                relationLabel: selectedConnector.connector.label,
                relationExplanation: selectedConnector.connector.explanation,
                isExplicit: selectedConnector.connector.isExplicit,
                workItemId: selectedConnector.connector.workItemId,
                goalId: selectedConnector.connector.goalId,
                planId: selectedConnector.connector.planId,
                handoffId: selectedConnector.connector.handoffId
            }, null, 2)}/>
          </div>) : selectedEvent ? (<div className="flex flex-col gap-5 px-4 py-5">
            <DetailSection label="Full Context" resizable value={selectedEvent.body
                ?? (selectedEvent.metadata["description"] as string | undefined)
                ?? (selectedEvent.metadata["command"] as string | undefined)
                ?? (selectedEvent.metadata["result"] as string | undefined)
                ?? (selectedEvent.metadata["action"] as string | undefined)
                ?? (selectedEvent.metadata["ruleId"] as string | undefined)
                ?? "—"}/>
            <DetailIds event={selectedEvent} runtimeSessionId={taskDetail?.runtimeSessionId}/>
            <DetailEventEvidence event={selectedEvent} {...(taskDetail?.task.runtimeSource ? { runtimeSource: taskDetail.task.runtimeSource } : {})}/>
            {selectedEvent.kind === "question.logged" && (() => {
                const qId = selectedEvent.metadata["questionId"] as string | undefined;
                const group = qId ? questionGroups.find((g) => g.questionId === qId) : null;
                return group ? <QuestionGroupSection group={group}/> : null;
            })()}
            {selectedEvent.kind === "todo.logged" && (() => {
                const tId = selectedEvent.metadata["todoId"] as string | undefined;
                const group = tId ? todoGroups.find((g) => g.todoId === tId) : null;
                return group ? <TodoGroupSection group={group}/> : null;
            })()}
            {selectedEvent.lane === "coordination" && (<DetailSection label="Agent Activity" resizable value={[
                    typeof selectedEvent.metadata["activityType"] === "string"
                        ? `Activity: ${selectedEvent.metadata["activityType"]}`
                        : undefined,
                    typeof selectedEvent.metadata["agentName"] === "string"
                        ? `Agent: ${selectedEvent.metadata["agentName"]}`
                        : undefined,
                    typeof selectedEvent.metadata["skillName"] === "string"
                        ? `Skill: ${selectedEvent.metadata["skillName"]}`
                        : undefined,
                    typeof selectedEvent.metadata["skillPath"] === "string"
                        ? `Skill path: ${selectedEvent.metadata["skillPath"]}`
                        : undefined,
                    typeof selectedEvent.metadata["mcpServer"] === "string"
                        ? `MCP server: ${selectedEvent.metadata["mcpServer"]}`
                        : undefined,
                    typeof selectedEvent.metadata["mcpTool"] === "string"
                        ? `MCP tool: ${selectedEvent.metadata["mcpTool"]}`
                        : undefined
                ].filter((value): value is string => Boolean(value)).join("\n") || "No coordination metadata"}/>)}
            {relatedEvents.length > 0 && <DetailRelatedEvents events={relatedEvents}/>}
            {selectedEvent.kind === "user.message" && <DetailCaptureInfo event={selectedEvent}/>}
            {selectedEvent.kind === "assistant.response" && <DetailTokenUsage event={selectedEvent}/>}
            {(selectedEvent.metadata["modelName"] as string | undefined) && (<DetailModelInfo modelName={selectedEvent.metadata["modelName"] as string} modelProvider={selectedEvent.metadata["modelProvider"] as string | undefined}/>)}
            <DetailTags title="Tags" values={selectedEvent.classification.tags} activeValue={selectedTag} onSelect={(tag) => onSelectTag(selectedTag === tag ? null : tag)}/>
            <DetailMatchList event={selectedEvent} activeRuleId={selectedRuleId} onSelectRule={(ruleId) => {
                onSelectRule(selectedRuleId === ruleId ? null : ruleId);
            }}/>
            <DetailSection label="Metadata" mono value={JSON.stringify(selectedEvent.metadata, null, 2)}/>
          </div>) : (<div className="px-4 py-8 text-center">
            <p className="m-0 text-[0.9rem] font-medium text-[var(--text-2)]">No event selected.</p>
            <p className="mt-2 text-[0.8rem] text-[var(--text-3)]">
              As soon as the monitor records activity, the latest item appears here.
            </p>
            {onOpenTaskWorkspace && (<div className="mt-4">
                <Button className="h-8 rounded-full px-3 text-[0.76rem] font-semibold shadow-none whitespace-nowrap" onClick={onOpenTaskWorkspace} size="sm" type="button">
                  {openWorkspaceLabel}
                </Button>
              </div>)}
          </div>)}

        {showInspectorSummaryFooter && obsBadges.length > 0 && (<div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-3">
            {obsBadges.map((b) => (<Badge key={b.key} tone={b.tone} size="xs" className="gap-1 px-2.5 py-1 text-[0.68rem]">
                <strong>{b.value}</strong>
                <span>{b.label}</span>
              </Badge>))}
          </div>)}
        {showInspectorSummaryFooter && taskModelSummary && (<div className="px-4 pb-4">
            <DetailTaskModel summary={taskModelSummary}/>
          </div>)}
      </>);
}
