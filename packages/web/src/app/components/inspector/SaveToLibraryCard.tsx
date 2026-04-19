import type React from "react";
import { useMemo, useState } from "react";
import {
    buildReusableTaskSnapshot,
    filterEventsByTurnRange,
    segmentEventsByTurn,
    type ReusableTaskSnapshot,
} from "../../../types.js";
import {
    buildQuestionGroups,
    buildTaskExtraction,
    buildTodoGroups,
    collectPlanSteps,
    collectViolationDescriptions,
    type TaskExtraction,
    type TimelineEventRecord,
} from "../../../types.js";
import { useEvaluation } from "../../../state.js";
import { TaskHandoffPanel } from "../TaskHandoffPanel.js";
import { TaskEvaluatePanel } from "../TaskEvaluatePanel.js";
import { EvaluatePromptButton } from "../EvaluatePromptButton.js";
import { Badge } from "../ui/Badge.js";
import { cn } from "../../lib/ui/cn.js";

type SaveMode = "direct" | "mcp";
type TurnRangeSelection =
    | { readonly kind: "all" }
    | { readonly kind: "turn"; readonly turnIndex: number }
    | { readonly kind: "last" };

export function buildTaskEvaluatePanelScopeKey(taskId: string, selection: TurnRangeSelection): string {
    switch (selection.kind) {
        case "all":
            return `${taskId}:all`;
        case "last":
            return `${taskId}:last`;
        case "turn":
            return `${taskId}:turn:${selection.turnIndex}`;
    }
}

export function buildWorkflowScopeKey(selection: TurnRangeSelection, lastTurnIndex?: number | null): string {
    switch (selection.kind) {
        case "all":
            return "task";
        case "last":
            return typeof lastTurnIndex === "number" && Number.isFinite(lastTurnIndex)
                ? `turn:${lastTurnIndex}`
                : "task";
        case "turn":
            return `turn:${selection.turnIndex}`;
    }
}

export interface SaveToLibraryCardProps {
    readonly taskId: string;
    readonly taskTitle: string;
    readonly taskExtraction: TaskExtraction;
    readonly taskTimeline: readonly TimelineEventRecord[];
    readonly handoffPlans: readonly string[];
    readonly handoffExploredFiles: readonly string[];
    readonly handoffModifiedFiles: readonly string[];
    readonly handoffOpenTodos: readonly string[];
    readonly handoffOpenQuestions: readonly string[];
    readonly handoffViolations: readonly string[];
    readonly handoffSnapshot: ReusableTaskSnapshot;
    readonly handoffActiveInstructions: readonly string[];
}

export function SaveToLibraryCard({
    taskId,
    taskTitle,
    taskExtraction,
    taskTimeline,
    handoffPlans,
    handoffExploredFiles,
    handoffModifiedFiles,
    handoffOpenTodos,
    handoffOpenQuestions,
    handoffViolations,
    handoffSnapshot,
    handoffActiveInstructions,
}: SaveToLibraryCardProps): React.JSX.Element {
    const [mode, setMode] = useState<SaveMode>("direct");
    const [selection, setSelection] = useState<TurnRangeSelection>({ kind: "all" });

    const segments = useMemo(() => segmentEventsByTurn(taskTimeline), [taskTimeline]);
    const selectableTurns = useMemo(() => segments.filter((segment) => !segment.isPrelude), [segments]);
    const hasMultipleTurns = selectableTurns.length > 1;

    const turnRange = useMemo(() => {
        if (selection.kind === "all") {
            return { from: null as number | null, to: null as number | null };
        }
        if (selection.kind === "turn") {
            return { from: selection.turnIndex, to: selection.turnIndex };
        }
        const last = selectableTurns[selectableTurns.length - 1];
        const lastIndex = last?.turnIndex ?? null;
        return { from: lastIndex, to: lastIndex };
    }, [selectableTurns, selection]);

    const scopedTimeline = useMemo(
        () => filterEventsByTurnRange(taskTimeline, turnRange),
        [taskTimeline, turnRange],
    );

    const scopedSnapshot = useMemo<ReusableTaskSnapshot>(() => {
        if (selection.kind === "all") {
            return handoffSnapshot;
        }
        return buildReusableTaskSnapshot({
            objective: taskExtraction.objective || taskTitle,
            events: scopedTimeline,
        });
    }, [handoffSnapshot, scopedTimeline, selection.kind, taskExtraction.objective, taskTitle]);

    const selectionLabel = useMemo(() => {
        if (selection.kind === "all") return "Whole task";
        if (selection.kind === "turn") return `Turn ${selection.turnIndex}`;
        return "Last turn";
    }, [selection]);
    const workflowScopeKey = useMemo(
        () => buildWorkflowScopeKey(selection, turnRange.to),
        [selection, turnRange.to],
    );
    const taskEvaluatePanelScopeKey = useMemo(
        () => buildTaskEvaluatePanelScopeKey(taskId, selection),
        [selection, taskId],
    );
    const {
        evaluation,
        isSaving: isSavingEvaluation,
        isSaved: isSavedEvaluation,
        saveEvaluation: saveEvaluationForScope,
    } = useEvaluation(taskId, workflowScopeKey);

    const scopedEventCount = scopedTimeline.length;
    const scopedExtraction = useMemo(
        () => buildTaskExtraction(undefined, scopedTimeline, []),
        [scopedTimeline],
    );
    const scopedHandoffPlans = useMemo(() => collectPlanSteps(scopedTimeline), [scopedTimeline]);
    const scopedTodoGroups = useMemo(() => buildTodoGroups(scopedTimeline), [scopedTimeline]);
    const scopedQuestionGroups = useMemo(() => buildQuestionGroups(scopedTimeline), [scopedTimeline]);
    const scopedHandoffOpenTodos = useMemo(
        () => scopedTodoGroups.filter((group) => !group.isTerminal).map((group) => group.title),
        [scopedTodoGroups],
    );
    const scopedHandoffOpenQuestions = useMemo(
        () => scopedQuestionGroups
            .filter((group) => !group.isAnswered)
            .flatMap((group) => group.phases)
            .filter((phase) => phase.phase === "asked")
            .map((phase) => phase.event.body ?? phase.event.title)
            .filter((value): value is string => Boolean(value)),
        [scopedQuestionGroups],
    );
    const scopedHandoffViolations = useMemo(() => collectViolationDescriptions(scopedTimeline), [scopedTimeline]);
    const scopedExploredFiles = useMemo(() => scopedSnapshot.keyFiles, [scopedSnapshot]);
    const scopedModifiedFiles = useMemo(() => scopedSnapshot.modifiedFiles, [scopedSnapshot]);

    return (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <header className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[0.88rem] font-semibold text-[var(--text-1)]">Save to Library</span>
                        <Badge tone="neutral" size="xs">
                            {scopedEventCount} events
                        </Badge>
                    </div>
                    <span className="text-[0.7rem] text-[var(--text-3)]">{selectionLabel}</span>
                </div>
                <p className="m-0 text-[0.76rem] leading-relaxed text-[var(--text-2)]">
                    Choose which conversation turn to archive as a reusable workflow.
                </p>
            </header>

            {hasMultipleTurns && (
                <div className="flex flex-col gap-1.5">
                    <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">
                        Turn range
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        <TurnChip
                            active={selection.kind === "all"}
                            onClick={() => setSelection({ kind: "all" })}
                        >
                            All ({selectableTurns.length})
                        </TurnChip>
                        <TurnChip
                            active={selection.kind === "last"}
                            onClick={() => setSelection({ kind: "last" })}
                        >
                            Last
                        </TurnChip>
                        {selectableTurns.map((segment) => {
                            const chipProps = {
                                active: selection.kind === "turn" && selection.turnIndex === segment.turnIndex,
                                onClick: () => setSelection({ kind: "turn", turnIndex: segment.turnIndex }),
                                ...(segment.requestPreview ? { title: segment.requestPreview } : {}),
                            };
                            return (
                                <TurnChip key={segment.turnIndex} {...chipProps}>
                                    Turn {segment.turnIndex}
                                </TurnChip>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex items-center gap-1.5 self-start rounded-[999px] border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
                <ModeTab active={mode === "direct"} onClick={() => setMode("direct")}>
                    Direct
                </ModeTab>
                <ModeTab active={mode === "mcp"} onClick={() => setMode("mcp")}>
                    via Claude (MCP)
                </ModeTab>
            </div>

            {mode === "direct" ? (
                <TaskEvaluatePanel
                    key={taskEvaluatePanelScopeKey}
                    taskId={taskId}
                    scopeKey={workflowScopeKey}
                    taskTitle={taskTitle}
                    taskTimeline={scopedTimeline}
                    evaluation={evaluation}
                    isSaving={isSavingEvaluation}
                    isSaved={isSavedEvaluation}
                    onSave={saveEvaluationForScope}
                />
            ) : (
                <EvaluatePromptButton
                    taskId={taskId}
                    objective={taskExtraction.objective}
                    summary={taskExtraction.summary}
                    sections={taskExtraction.sections}
                    plans={handoffPlans}
                    exploredFiles={handoffExploredFiles}
                    modifiedFiles={handoffModifiedFiles}
                    openTodos={handoffOpenTodos}
                    openQuestions={handoffOpenQuestions}
                    violations={handoffViolations}
                    snapshot={scopedSnapshot}
                    activeInstructions={handoffActiveInstructions}
                />
            )}

            <TaskHandoffPanel
                taskId={taskId}
                scopeKey={workflowScopeKey}
                objective={scopedExtraction.objective}
                summary={scopedExtraction.summary}
                plans={scopedHandoffPlans}
                sections={scopedExtraction.sections}
                exploredFiles={scopedExploredFiles}
                modifiedFiles={scopedModifiedFiles}
                openTodos={scopedHandoffOpenTodos}
                openQuestions={scopedHandoffOpenQuestions}
                violations={scopedHandoffViolations}
                snapshot={scopedSnapshot}
            />
        </section>
    );
}

function TurnChip({
    active,
    children,
    onClick,
    title,
}: {
    readonly active: boolean;
    readonly children: React.ReactNode;
    readonly onClick: () => void;
    readonly title?: string;
}): React.JSX.Element {
    return (
        <button
            type="button"
            title={title}
            className={cn(
                "rounded-[999px] border px-2.5 py-1 text-[0.72rem] font-semibold transition-colors",
                active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[#fff]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text-1)]",
            )}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function ModeTab({
    active,
    children,
    onClick,
}: {
    readonly active: boolean;
    readonly children: React.ReactNode;
    readonly onClick: () => void;
}): React.JSX.Element {
    return (
        <button
            type="button"
            className={cn(
                "rounded-[999px] px-3 py-1 text-[0.74rem] font-semibold transition-colors",
                active
                    ? "bg-[var(--surface)] text-[var(--text-1)] shadow-sm"
                    : "text-[var(--text-3)] hover:text-[var(--text-1)]",
            )}
            onClick={onClick}
        >
            {children}
        </button>
    );
}
