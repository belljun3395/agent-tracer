import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { getEventEvidence } from "~domain/evidence.js";
import { evidenceTone, formatEvidenceLevel } from "~app/lib/formatters.js";
import { buildInspectorEventTitle } from "~app/lib/insights/extraction.js";
import type { QuestionGroup, TodoGroup } from "~app/lib/insights/grouping.js";
import type { TimelineConnector } from "~app/lib/timeline.js";
import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { TaskDetailResponse } from "~domain/task-query-contracts.js";
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
    DetailRuleEnforcements,
    DetailSection,
    DetailSubagentAction,
    DetailTaskReminder,
    DetailTurnVerdict,
    InspectorHeaderCard
} from "./InspectorDetails.js";
import { inspectorHelpText } from "./helpText.js";
import { findTurnSummaryForEvent } from "./turnVerdict.js";

/**
 * True when a tool.used event (or agent.activity.logged mcp_call) was recorded
 * as a failure by the PostToolUseFailure hook — that hook sets metadata.failed
 * to `true`. We also accept an explicit status === "failed" or errored === true
 * for forward compatibility.
 */
function isFailedToolEvent(event: TimelineEventRecord): boolean {
    if (event.kind !== "tool.used" && event.kind !== "agent.activity.logged") return false;
    const md = event.metadata;
    if (md["failed"] === true) return true;
    if (md["errored"] === true) return true;
    const status = md["status"];
    if (typeof status === "string" && status.toLowerCase() === "failed") return true;
    return false;
}

/**
 * Redacted thinking blocks carry an encrypted signature but no readable body.
 * The `[redacted thinking]` placeholder has zero information value, so we skip
 * the Full Context panel entirely for these events.
 */
function isRedactedThinking(event: TimelineEventRecord): boolean {
    return event.kind === "thought.logged" && event.metadata["redacted"] === true;
}

function recordValue(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(record: Record<string, unknown>, key: string): number | undefined {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatTokenUsage(event: TimelineEventRecord): string {
    const inputTokens = numberValue(event.metadata, "inputTokens") ?? 0;
    const outputTokens = numberValue(event.metadata, "outputTokens") ?? 0;
    const cacheReadTokens = numberValue(event.metadata, "cacheReadTokens") ?? 0;
    const cacheCreateTokens = numberValue(event.metadata, "cacheCreateTokens") ?? 0;
    const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreateTokens;
    const costUsd = numberValue(event.metadata, "costUsd");
    const durationMs = numberValue(event.metadata, "durationMs");
    const model = stringValue(event.metadata, "model");
    const promptId = stringValue(event.metadata, "promptId");
    return [
        `Input tokens: ${inputTokens.toLocaleString()}`,
        `Output tokens: ${outputTokens.toLocaleString()}`,
        `Cache read tokens: ${cacheReadTokens.toLocaleString()}`,
        `Cache create tokens: ${cacheCreateTokens.toLocaleString()}`,
        `Total tokens: ${totalTokens.toLocaleString()}`,
        costUsd !== undefined ? `Cost: $${costUsd.toFixed(4)}` : undefined,
        durationMs !== undefined ? `Duration: ${Math.round(durationMs)}ms` : undefined,
        model ? `Model: ${model}` : undefined,
        promptId ? `Prompt: ${promptId}` : undefined,
    ].filter((value): value is string => Boolean(value)).join("\n");
}

function formatCommandAnalysis(value: unknown): string | null {
    const analysis = recordValue(value);
    if (!analysis) return null;
    const lines = [
        `Structure: ${stringValue(analysis, "structure") ?? "unknown"}`,
        `Overall effect: ${stringValue(analysis, "overallEffect") ?? "unknown"}`,
        `Confidence: ${stringValue(analysis, "confidence") ?? "unknown"}`,
    ];
    if (analysis["failureMasked"] === true) lines.push("Failure masked: true");
    const steps = Array.isArray(analysis["steps"]) ? analysis["steps"] : [];
    if (steps.length > 0) lines.push("", "Steps:");
    for (const [index, stepValue] of steps.entries()) {
        const step = recordValue(stepValue);
        if (!step) continue;
        lines.push(...formatCommandStep(step, index + 1, ""));
    }
    return lines.join("\n");
}

function formatCommandStep(step: Record<string, unknown>, index: number, prefix: string): readonly string[] {
    const commandName = stringValue(step, "commandName") ?? "command";
    const operation = stringValue(step, "operation") ?? "unknown";
    const effect = stringValue(step, "effect") ?? "unknown";
    const operator = stringValue(step, "operatorFromPrevious");
    const workspace = stringValue(step, "workspace");
    const scriptName = stringValue(step, "scriptName");
    const targets = Array.isArray(step["targets"]) ? step["targets"].map(formatCommandTarget).filter((target): target is string => Boolean(target)) : [];
    const header = `${prefix}${index}. ${operator ? `${operator} ` : ""}${commandName} · ${operation} · ${effect}`;
    const lines = [header];
    if (workspace) lines.push(`${prefix}   workspace: ${workspace}`);
    if (scriptName) lines.push(`${prefix}   script: ${scriptName}`);
    if (targets.length > 0) lines.push(`${prefix}   targets: ${targets.join(", ")}`);
    const pipeline = Array.isArray(step["pipeline"]) ? step["pipeline"] : [];
    if (pipeline.length > 0) {
        lines.push(`${prefix}   pipeline:`);
        for (const [pipelineIndex, pipelineStep] of pipeline.entries()) {
            const nested = recordValue(pipelineStep);
            if (nested) lines.push(...formatCommandStep(nested, pipelineIndex + 1, `${prefix}     `));
        }
    }
    return lines;
}

function formatCommandTarget(value: unknown): string | null {
    const target = recordValue(value);
    if (!target) return null;
    const type = stringValue(target, "type") ?? "target";
    const targetValue = stringValue(target, "value");
    return targetValue ? `${type}:${targetValue}` : null;
}

interface SelectedConnectorData {
    readonly connector: TimelineConnector;
    readonly source: TimelineEventRecord;
    readonly target: TimelineEventRecord;
}

export interface InspectorTabProps {
    readonly selectedEvent: TimelineEventRecord | null;
    readonly selectedConnector: SelectedConnectorData | null;
    readonly selectedEventDisplayTitle: string | null;
    readonly selectedEventDisplayTitleOverride: string | null;
    readonly canEditSelectedEventTitle: boolean;
    readonly eventTime: string | null;
    readonly questionGroups: readonly QuestionGroup[];
    readonly todoGroups: readonly TodoGroup[];
    readonly relatedEvents: readonly TimelineEventRecord[];
    readonly selectedRuleId: string | null;
    readonly onUpdateEventDisplayTitle: (eventId: string, displayTitle: string | null) => Promise<void>;
    readonly onSelectRule: (ruleId: string | null) => void;
    readonly taskDetail: TaskDetailResponse | null;
}

export function InspectorTab({
    selectedEvent,
    selectedConnector,
    selectedEventDisplayTitle,
    selectedEventDisplayTitleOverride,
    canEditSelectedEventTitle,
    eventTime,
    questionGroups,
    todoGroups,
    relatedEvents,
    selectedRuleId,
    onUpdateEventDisplayTitle,
    onSelectRule,
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
    const selectedTurnSummary = useMemo(
        () => findTurnSummaryForEvent(selectedEvent, taskDetail?.turns ?? []),
        [selectedEvent, taskDetail],
    );

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
          {selectedEvent && canEditSelectedEventTitle && !isEditingEventTitle && (<Button onClick={() => {
                    setEventTitleDraft(selectedEventDisplayTitle ?? "");
                    setEventTitleError(null);
                    setIsEditingEventTitle(true);
                }} size="sm" variant="ghost">
                      Rename Card
                    </Button>)}
                  {selectedEvent && canEditSelectedEventTitle && selectedEventDisplayTitleOverride && !isEditingEventTitle && (<Button onClick={() => { void handleResetEventTitle(); }} size="sm" variant="ghost">
                      Reset Title
                    </Button>)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                {selectedConnector ? (<Badge tone="neutral" size="xs" className="uppercase tracking-[0.06em]">
                    {selectedConnector.connector.isExplicit ? "relation" : "transition"} · {selectedConnector.connector.cross ? "cross-lane" : "same-lane"}
                  </Badge>) : selectedEvent ? (<Badge tone="neutral" size="xs" className="uppercase tracking-[0.06em]">{selectedEvent.kind} · {selectedEvent.lane}</Badge>) : null}
                {selectedEvent && isFailedToolEvent(selectedEvent) && (
                  <Badge tone="danger" size="xs" className="gap-1 uppercase tracking-[0.06em]">
                    <span aria-hidden="true">✕</span>
                    <span>failed</span>
                  </Badge>
                )}
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
                  <Button disabled={isSavingEventTitle} size="sm" type="submit" variant="accent">
                    {isSavingEventTitle ? "Saving..." : "Save"}
                  </Button>
                  <Button disabled={isSavingEventTitle} onClick={() => {
                setEventTitleDraft(selectedEventDisplayTitle ?? "");
                setEventTitleError(null);
                setIsEditingEventTitle(false);
            }} size="sm">
                    Cancel
                  </Button>
                  {selectedEventDisplayTitleOverride && (<Button disabled={isSavingEventTitle} onClick={() => { void handleResetEventTitle(); }} size="sm">
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
            <DetailSection label="Full Context" helpText={inspectorHelpText.fullContext} resizable value={[
                `${selectedConnector.connector.isExplicit ? "Explicit relation" : "Fallback sequence"} from ${selectedConnector.source.lane} to ${selectedConnector.target.lane}.`,
                selectedConnector.connector.label ? `Label: ${selectedConnector.connector.label}` : undefined,
                selectedConnector.connector.explanation,
                `From: ${buildInspectorEventTitle(selectedConnector.source) ?? selectedConnector.source.title}`,
                `To: ${buildInspectorEventTitle(selectedConnector.target) ?? selectedConnector.target.title}`
            ].filter((value): value is string => Boolean(value)).join("\n")}/>
            <DetailConnectorIds connector={selectedConnector.connector} source={selectedConnector.source} target={selectedConnector.target}/>
            <DetailConnectorEvents source={selectedConnector.source} target={selectedConnector.target}/>
            <DetailSection label="Metadata" helpText={inspectorHelpText.metadata} mono value={JSON.stringify({
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
            {/* Common: applies to every event, in a stable top-of-panel order. */}
            {!isRedactedThinking(selectedEvent) && (
              <DetailSection label="Full Context" helpText={inspectorHelpText.fullContext} resizable value={selectedEvent.body
                ?? (selectedEvent.metadata["description"] as string | undefined)
                ?? (selectedEvent.metadata["command"] as string | undefined)
                ?? (selectedEvent.metadata["result"] as string | undefined)
                ?? (selectedEvent.metadata["action"] as string | undefined)
                ?? (selectedEvent.metadata["ruleId"] as string | undefined)
                ?? "—"}/>
            )}
            <DetailIds event={selectedEvent} runtimeSessionId={taskDetail?.runtimeSessionId}/>
            <DetailEventEvidence event={selectedEvent} {...(taskDetail?.task.runtimeSource ? { runtimeSource: taskDetail.task.runtimeSource } : {})}/>
            <DetailTurnVerdict turn={selectedTurnSummary}/>
            <DetailMatchList event={selectedEvent} activeRuleId={selectedRuleId} onSelectRule={(ruleId) => {
                onSelectRule(selectedRuleId === ruleId ? null : ruleId);
            }}/>
            <DetailRuleEnforcements event={selectedEvent} activeRuleId={selectedRuleId} onSelectRule={(ruleId) => {
                onSelectRule(selectedRuleId === ruleId ? null : ruleId);
            }}/>

            {/* Card-specific: gated by event kind / lane. */}
            <DetailTaskReminder event={selectedEvent}/>
            <DetailSubagentAction event={selectedEvent}/>
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
            {selectedEvent.kind === "user.message" && <DetailCaptureInfo event={selectedEvent}/>}
            {selectedEvent.kind === "terminal.command" && formatCommandAnalysis(selectedEvent.metadata["commandAnalysis"]) && (
                <DetailSection label="Command Analysis" helpText="Parsed shell structure, command intent, targets, and effect inferred from the terminal command." mono value={formatCommandAnalysis(selectedEvent.metadata["commandAnalysis"]) ?? ""}/>
            )}
            {selectedEvent.kind === "token.usage" && (
                <DetailSection label="Token Usage" helpText="Token accounting captured from runtime telemetry." mono value={formatTokenUsage(selectedEvent)}/>
            )}
            {(selectedEvent.metadata["modelName"] as string | undefined) && (<DetailModelInfo modelName={selectedEvent.metadata["modelName"] as string} modelProvider={selectedEvent.metadata["modelProvider"] as string | undefined}/>)}
            {selectedEvent.lane === "coordination" && (<DetailSection label="Agent Activity" helpText={inspectorHelpText.agentActivity} resizable value={[
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

            {/* Raw payload — always last. */}
            <DetailSection label="Metadata" helpText={inspectorHelpText.metadata} mono value={JSON.stringify(selectedEvent.metadata, null, 2)}/>
          </div>) : (<div className="px-4 py-8 text-center">
            <p className="m-0 text-[0.9rem] font-medium text-[var(--text-2)]">No event selected.</p>
            <p className="mt-2 text-[0.8rem] text-[var(--text-3)]">
              As soon as the monitor records activity, the latest item appears here.
            </p>
          </div>)}
      </>);
}
