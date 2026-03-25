/**
 * 이벤트 상세 정보 패널 (오른쪽 inspector 영역).
 * 분류 결과, 메타데이터, 파일 경로 등 전체 이벤트 데이터 표시.
 * 이벤트 선택 및 커넥터 선택 두 모드를 지원하며 지원 패널(규칙/태그/태스크/compact/파일)을 포함.
 */

import type React from "react";
import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  buildCompactInsight,
  buildExplorationInsight,
  buildInspectorEventTitle,
  buildMentionedFileVerifications,
  buildObservabilityStats,
  buildQuestionGroups,
  buildTagInsights,
  buildTaskExtraction,
  buildTodoGroups,
  collectExploredFiles,
  collectFileActivity,
  collectPlanSteps,
  collectViolationDescriptions,
  type CompactInsight,
  type CompactRelation,
  type DirectoryMentionVerification,
  type ExplorationInsight,
  type ExploredFileStat,
  type FileActivityStat,
  type FileMentionVerification,
  type MentionedFileVerification,
  type ModelSummary,
  type QuestionGroup,
  type TaskExtraction,
  type TagInsight,
  type TodoGroup
} from "../lib/insights.js";
import { formatRelativeTime } from "../lib/timeline.js";
import type { TimelineConnector } from "../lib/timeline.js";
import { cn } from "../lib/ui/cn.js";
import { Badge } from "./ui/Badge.js";
import { Button } from "./ui/Button.js";
import { PanelCard } from "./ui/PanelCard.js";
import { TaskHandoffPanel } from "./TaskHandoffPanel.js";
import type {
  BookmarkRecord,
  TaskDetailResponse,
  TimelineEvent
} from "../types.js";

type PanelTabId = "inspector" | "tags" | "task" | "compact" | "files" | "exploration";

type ExplorationSortKey = "recent" | "most-read" | "alpha";
type FileSortKey = "recent" | "most-active" | "writes-first" | "alpha";

function sortExploredFiles(files: readonly ExploredFileStat[], key: ExplorationSortKey): readonly ExploredFileStat[] {
  const copy = [...files];
  switch (key) {
    case "recent": return copy.sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
    case "most-read": return copy.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
    case "alpha": return copy.sort((a, b) => a.path.localeCompare(b.path));
  }
}

function sortFileActivity(files: readonly FileActivityStat[], key: FileSortKey): readonly FileActivityStat[] {
  const copy = [...files];
  switch (key) {
    case "recent": return copy.sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
    case "most-active": return copy.sort((a, b) => (b.readCount + b.writeCount) - (a.readCount + a.writeCount) || a.path.localeCompare(b.path));
    case "writes-first": return copy.sort((a, b) => b.writeCount - a.writeCount || a.path.localeCompare(b.path));
    case "alpha": return copy.sort((a, b) => a.path.localeCompare(b.path));
  }
}

const PANEL_TABS = [
  { id: "inspector",   label: "Inspector" },
  { id: "tags",        label: "Tags" },
  { id: "task",        label: "Task" },
  { id: "compact",     label: "Compact" },
  { id: "files",       label: "Files" },
  { id: "exploration", label: "Exploration" },
] as const;

const cardShell = "gap-0 overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)]";
const cardHeader = "flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]";
const cardBody = "px-4 py-4";
const innerPanel = "rounded-[12px] border border-[var(--border)] bg-[var(--bg)]";
const monoText = "font-mono text-[0.8rem] leading-6";

function SectionCard({
  title,
  action,
  children,
  bodyClassName,
  className
}: {
  readonly title: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly bodyClassName?: string;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <PanelCard className={cn(cardShell, className)}>
      <div className={cardHeader}>
        <div className="min-w-0">{title}</div>
        {action}
      </div>
      <div className={cn(cardBody, bodyClassName)}>{children}</div>
    </PanelCard>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: React.ReactNode;
  readonly action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">{eyebrow}</p>
        <h3 className="text-[0.98rem] font-semibold text-[var(--text-1)]">{title}</h3>
        <p className="mt-1 text-[0.82rem] leading-6 text-[var(--text-2)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function InspectorHeaderCard({
  eyebrow,
  title,
  description,
  actions,
  children
}: {
  readonly eyebrow: string;
  readonly title: React.ReactNode;
  readonly description: React.ReactNode;
  readonly actions: React.ReactNode;
  readonly children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <PanelCard className={cn(cardShell, "bg-[var(--surface)]")}>
      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="min-w-0">
          <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--text-3)]">{eyebrow}</p>
          {typeof title === "string"
            ? <h2 className="text-[1.02rem] font-semibold leading-6 text-[var(--text-1)]">{title}</h2>
            : <div className="text-[1.02rem] font-semibold leading-6 text-[var(--text-1)]">{title}</div>}
          <p className="mt-1 text-[0.82rem] leading-6 text-[var(--text-2)]">{description}</p>
          {children}
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </PanelCard>
  );
}

function KeyValueTable({
  rows
}: {
  readonly rows: ReadonlyArray<{
    readonly key: string;
    readonly value: React.ReactNode;
  }>;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
          <div className="pt-0.5 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[var(--text-3)]">{row.key}</div>
          <div className={cn("min-w-0 break-words text-[0.83rem] text-[var(--text-2)]", monoText)}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

interface SelectedConnectorData {
  readonly connector: TimelineConnector;
  readonly source: TimelineEvent;
  readonly target: TimelineEvent;
}

interface EventInspectorProps {
  readonly taskDetail: TaskDetailResponse | null;
  readonly selectedEvent: TimelineEvent | null;
  readonly selectedConnector: SelectedConnectorData | null;
  readonly selectedEventDisplayTitle: string | null;
  readonly selectedTaskBookmark?: BookmarkRecord | null;
  readonly selectedEventBookmark?: BookmarkRecord | null;
  readonly selectedTag: string | null;
  readonly selectedRuleId: string | null;
  readonly taskModelSummary?: ModelSummary | undefined;
  readonly isCollapsed?: boolean;
  readonly className?: string | undefined;
  readonly onToggleCollapse?: () => void;
  readonly onCreateTaskBookmark: () => void;
  readonly onCreateEventBookmark: () => void;
  readonly onUpdateEventDisplayTitle: (eventId: string, displayTitle: string | null) => Promise<void>;
  readonly onSelectTag: (tag: string | null) => void;
  readonly onSelectRule: (ruleId: string | null) => void;
}

/** DetailSection: 라벨과 내용을 가진 inspector 카드. */
function DetailSection({
  label, mono = false, resizable = false, value
}: {
  readonly label: string;
  readonly mono?: boolean;
  readonly resizable?: boolean;
  readonly value: string;
}): React.JSX.Element {
  return (
    <SectionCard title={label}>
      <pre
        className={cn(
          "m-0 max-h-[clamp(220px,28vh,300px)] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-4 py-4 text-[0.88rem] leading-7 text-[var(--text-2)]",
          mono ? monoText : "",
          mono && "text-[0.8rem] leading-6",
          resizable && "min-h-44 resize-y",
          label === "Full Context" && "max-h-[clamp(300px,36vh,420px)]",
          mono && "max-h-[clamp(260px,34vh,420px)]",
          mono && resizable && "max-h-[min(72vh,760px)]"
        )}
      >
        {value}
      </pre>
    </SectionCard>
  );
}

/** DetailIds: 이벤트 식별자(event ID, task ID, session ID, time)를 테이블로 표시. */
function DetailIds({ event }: { readonly event: TimelineEvent }): React.JSX.Element {
  return (
    <SectionCard
      title="IDs"
      bodyClassName="pt-4"
    >
      <KeyValueTable
        rows={[
          { key: "Event", value: event.id },
          { key: "Task", value: event.taskId },
          ...(event.sessionId ? [{ key: "Session", value: event.sessionId }] : []),
          { key: "Time", value: new Date(event.createdAt).toLocaleTimeString() }
        ]}
      />
    </SectionCard>
  );
}

/** DetailConnectorIds: 커넥터 식별자를 테이블로 표시. */
function DetailConnectorIds({
  connector, source, target
}: {
  readonly connector: TimelineConnector;
  readonly source: TimelineEvent;
  readonly target: TimelineEvent;
}): React.JSX.Element {
  return (
    <SectionCard
      title="IDs"
      bodyClassName="pt-4"
    >
      <KeyValueTable
        rows={[
          { key: "Path", value: connector.key },
          { key: "From", value: source.id },
          { key: "To", value: target.id },
          { key: "Time", value: new Date(target.createdAt).toLocaleTimeString() }
        ]}
      />
    </SectionCard>
  );
}

/** DetailTags: 태그 목록을 pill 형태로 표시. onSelect가 있으면 클릭 가능. */
function DetailTags({
  title, values, activeValue, onSelect
}: {
  readonly title: string;
  readonly values: readonly string[];
  readonly activeValue?: string | null;
  readonly onSelect?: (value: string) => void;
}): React.JSX.Element {
  return (
    <SectionCard title={title} bodyClassName="pt-4">
      <div className="flex flex-wrap gap-2">
        {values.length === 0
          ? <span className="text-[0.8rem] text-[var(--text-3)]">No tags</span>
          : values.map((v) => (
              onSelect ? (
                <Button
                  key={v}
                  className={cn(
                    "h-auto rounded-full border px-3.5 py-1.5 text-[0.78rem] font-semibold shadow-none transition-colors",
                    activeValue === v
                      ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-2)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]"
                  )}
                  onClick={() => onSelect(v)}
                  size="sm"
                  type="button"
                  variant="bare"
                >
                  {v}
                </Button>
              ) : (
                <Badge key={v} className="max-w-full break-words px-3 py-1.5 text-[0.78rem] font-medium">
                  {v}
                </Badge>
              )
            ))
        }
      </div>
    </SectionCard>
  );
}

/** DetailMatchList: 이벤트 분류 매칭 결과 목록. */
function DetailMatchList({
  event, activeRuleId, onSelectRule
}: {
  readonly event: TimelineEvent;
  readonly activeRuleId?: string | null;
  readonly onSelectRule?: (ruleId: string) => void;
}): React.JSX.Element {
  return (
    <SectionCard title="Classification Matches" bodyClassName="pt-4">
      {event.classification.matches.length === 0 ? (
        <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No classifier matched this event.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {event.classification.matches.map((match) => (
            <div
              key={`${event.id}-${match.ruleId}`}
              className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                {onSelectRule ? (
                  <button
                    className={cn(
                      "min-w-0 truncate bg-transparent p-0 text-left text-[0.95rem] font-semibold transition-colors",
                      activeRuleId === match.ruleId ? "text-[var(--accent)]" : "text-[var(--text-1)]"
                    )}
                    onClick={() => onSelectRule(match.ruleId)}
                    type="button"
                  >
                    {match.ruleId}
                  </button>
                ) : (
                  <strong className="min-w-0 truncate text-[0.95rem] text-[var(--text-1)]">{match.ruleId}</strong>
                )}
                <Badge tone="accent" size="xs">
                  {match.score} · {match.source ?? "action-registry"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {match.tags.map((tag) => (
                  <Badge key={tag} tone="neutral" size="xs" className="max-w-full break-words">
                    {tag}
                  </Badge>
                ))}
              </div>
              <ul className="mt-2 flex flex-col gap-1 pl-4 text-[0.76rem] leading-6 text-[var(--text-2)]">
                {match.reasons.map((reason) => (
                  <li key={`${reason.kind}-${reason.value}`}>
                    {reason.kind}: <span className={monoText}>{reason.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/** DetailConnectorEvents: 커넥터의 source/target 이벤트를 나란히 표시. */
function DetailConnectorEvents({
  source, target
}: {
  readonly source: TimelineEvent;
  readonly target: TimelineEvent;
}): React.JSX.Element {
  return (
    <SectionCard title="Connected Events" bodyClassName="pt-4">
      <div className="flex flex-col gap-3">
        {[source, target].map((event, index) => (
          <div key={event.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <strong className="text-[0.9rem] text-[var(--text-1)]">{index === 0 ? "From" : "To"}</strong>
              <Badge tone="neutral" size="xs">{event.lane}</Badge>
            </div>
            <p className="m-0 text-[0.82rem] leading-6 text-[var(--text-2)]">{buildInspectorEventTitle(event) ?? event.title}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function DetailRelatedEvents({
  events
}: {
  readonly events: readonly TimelineEvent[];
}): React.JSX.Element {
  return (
    <SectionCard title="Related Events" bodyClassName="pt-4">
      {events.length === 0 ? (
        <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No related events linked from metadata.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <strong className="text-[0.9rem] text-[var(--text-1)]">{buildInspectorEventTitle(event) ?? event.title}</strong>
                <Badge tone="neutral" size="xs">{event.lane}</Badge>
              </div>
              <p className="m-0 text-[0.82rem] leading-6 text-[var(--text-2)]">{summarizeDetailText(event.body ?? event.kind)}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

const QUESTION_PHASE_LABELS: Readonly<Record<string, string>> = { asked: "Asked", answered: "Answered", concluded: "Concluded" };
const TODO_STATE_LABELS: Readonly<Record<string, string>> = { added: "Added", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" };

/** DetailQuestionFlow: question.logged 이벤트를 questionId 기준으로 그룹화해 모든 단계를 표시. */
function DetailQuestionFlow({ group }: { readonly group: QuestionGroup }): React.JSX.Element {
  return (
    <SectionCard title="Question Flow" bodyClassName="pt-4">
      <div className="flex flex-col gap-2">
        {group.phases.map(({ phase, event }) => (
          <div key={event.id} className="flex flex-col gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Badge tone={phase === "concluded" ? "success" : phase === "answered" ? "accent" : "neutral"} size="xs">
              {QUESTION_PHASE_LABELS[phase] ?? phase}
            </Badge>
            <span className="min-w-0 flex-1 text-[0.84rem] font-medium text-[var(--text-1)]">{buildInspectorEventTitle(event) ?? event.title}</span>
            <span className="text-[0.76rem] font-semibold text-[var(--text-3)]">{new Date(event.createdAt).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
      {!group.isComplete && (
        <p className="mt-2 text-[0.8rem] text-[var(--text-3)]">Awaiting conclusion.</p>
      )}
    </SectionCard>
  );
}

/** DetailTodoFlow: todo.logged 이벤트를 todoId 기준으로 그룹화해 상태 전이 목록을 표시. */
function DetailTodoFlow({ group }: { readonly group: TodoGroup }): React.JSX.Element {
  return (
    <SectionCard title="Todo Lifecycle" bodyClassName="pt-4">
      <div className="flex flex-col gap-2">
        {group.transitions.map(({ state, event }) => (
          <div key={event.id} className="flex flex-col gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Badge
              tone={state === "completed" ? "success" : state === "added" ? "accent" : state === "cancelled" ? "danger" : "warning"}
              size="xs"
            >
              {TODO_STATE_LABELS[state] ?? state}
            </Badge>
            <span className="min-w-0 flex-1 text-[0.84rem] font-medium text-[var(--text-1)]">{buildInspectorEventTitle(event) ?? event.title}</span>
            <span className="text-[0.76rem] font-semibold text-[var(--text-3)]">{new Date(event.createdAt).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[0.8rem] text-[var(--text-3)]">
        Current: <strong className="text-[var(--text-2)]">{TODO_STATE_LABELS[group.currentState] ?? group.currentState}</strong>
        {group.isTerminal ? " (terminal)" : ""}
      </p>
    </SectionCard>
  );
}

/** DetailModelInfo: 이벤트에 있는 모델 식별 정보를 표시. */
function DetailModelInfo({
  modelName, modelProvider
}: {
  readonly modelName: string;
  readonly modelProvider?: string | undefined;
}): React.JSX.Element {
  return (
    <SectionCard title="Model" bodyClassName="pt-4">
      <KeyValueTable
        rows={[
          { key: "Name", value: modelName },
          ...(modelProvider ? [{ key: "Provider", value: modelProvider }] : [])
        ]}
      />
    </SectionCard>
  );
}

/** DetailTokenUsage: assistant.response 이벤트의 토큰 사용량을 표시. */
function DetailTokenUsage({ event }: { readonly event: TimelineEvent }): React.JSX.Element {
  const inputTokens       = event.metadata["inputTokens"]       as number | undefined;
  const outputTokens      = event.metadata["outputTokens"]      as number | undefined;
  const cacheReadTokens   = event.metadata["cacheReadTokens"]   as number | undefined;
  const cacheCreateTokens = event.metadata["cacheCreateTokens"] as number | undefined;
  const stopReason        = event.metadata["stopReason"]        as string | undefined;
  const rows = [
    ...(inputTokens       != null ? [{ key: "Input Tokens",        value: inputTokens.toLocaleString() }]        : []),
    ...(outputTokens      != null ? [{ key: "Output Tokens",       value: outputTokens.toLocaleString() }]       : []),
    ...(cacheReadTokens   != null ? [{ key: "Cache Read Tokens",   value: cacheReadTokens.toLocaleString() }]   : []),
    ...(cacheCreateTokens != null ? [{ key: "Cache Create Tokens", value: cacheCreateTokens.toLocaleString() }] : []),
    ...(stopReason               ? [{ key: "Stop Reason",          value: stopReason }]                          : [])
  ];
  if (rows.length === 0) return <></>;
  return (
    <SectionCard title="Token Usage" bodyClassName="pt-4">
      <KeyValueTable rows={rows} />
    </SectionCard>
  );
}

/** DetailCaptureInfo: user.message 이벤트의 캡처 메타데이터(captureMode, messageId, source, phase)를 표시. */
function DetailCaptureInfo({ event }: { readonly event: TimelineEvent }): React.JSX.Element {
  const captureMode = event.metadata["captureMode"] as string | undefined;
  const messageId   = event.metadata["messageId"]   as string | undefined;
  const source      = event.metadata["source"]      as string | undefined;
  const phase       = event.metadata["phase"]       as string | undefined;
  if (!captureMode && !messageId && !source && !phase) return <></>;
  return (
    <SectionCard title="Capture Info" bodyClassName="pt-4">
      <KeyValueTable
        rows={[
          ...(captureMode ? [{ key: "Mode", value: captureMode }] : []),
          ...(messageId ? [{ key: "Message ID", value: messageId }] : []),
          ...(source ? [{ key: "Source", value: source }] : []),
          ...(phase ? [{ key: "Phase", value: phase }] : [])
        ]}
      />
    </SectionCard>
  );
}

/** DetailTaskModel: 태스크 레벨 AI 모델 요약 카드. 작업 중 모델이 바뀌어도 전체 기록을 표시. */
function DetailTaskModel({ summary }: { readonly summary: ModelSummary }): React.JSX.Element | null {
  const entries = Object.entries(summary.modelCounts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <SectionCard title="AI Model" bodyClassName="pt-4">
      <div className="flex flex-col gap-2">
        {entries.map(([name, count]) => (
          <div key={name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <div className="min-w-0 break-words text-[0.83rem] text-[var(--text-2)]">
              <span className={cn("font-mono", name === summary.defaultModelName && "font-semibold text-[var(--text-1)]")}>{name}</span>
              {name === summary.defaultModelName && (
                <span className="ml-1.5 text-[0.72rem] font-normal text-[var(--text-3)]">default</span>
              )}
            </div>
            <div className="text-right text-[0.72rem] uppercase tracking-[0.04em] text-[var(--text-3)]">{count} events</div>
          </div>
        ))}
      </div>
      {summary.defaultModelProvider && (
        <p className="mt-2 text-[0.8rem] text-[var(--text-3)]">Provider: {summary.defaultModelProvider}</p>
      )}
    </SectionCard>
  );
}

function compactRelationLabel(relation: CompactRelation): { label: string; tone: "warning" | "success" | "accent" | "neutral" } | null {
  switch (relation) {
    case "before-compact": return { label: "pre-compact", tone: "warning" };
    case "after-compact": return { label: "post-compact", tone: "success" };
    case "across-compact": return { label: "across compact", tone: "accent" };
    case "no-compact": return null;
  }
}

const EXPLORATION_SORT_OPTIONS: ReadonlyArray<{ readonly key: ExplorationSortKey; readonly label: string }> = [
  { key: "recent",    label: "Recent" },
  { key: "most-read", label: "Most read" },
  { key: "alpha",     label: "A→Z" }
];

/** DetailExploredFiles: 탐색된 파일 목록을 접기/펼치기로 표시. compact 관계와 읽기 시간 이력 포함. */
function DetailExploredFiles({
  files, workspacePath, expanded, sortKey, onToggle, onSortChange
}: {
  readonly files: readonly ExploredFileStat[];
  readonly workspacePath?: string | undefined;
  readonly expanded: boolean;
  readonly sortKey: ExplorationSortKey;
  readonly onToggle: () => void;
  readonly onSortChange: (key: ExplorationSortKey) => void;
}): React.JSX.Element {
  const staleCount = files.filter((f) => f.compactRelation === "before-compact").length;

  return (
    <PanelCard className={cardShell}>
      <button
        className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5 text-left"
        onClick={onToggle}
        type="button"
      >
        <div>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]">Explored Files</div>
          <div className="mt-1 text-[0.82rem] text-[var(--text-2)]">
            {files.length === 0
              ? "No exploration file paths recorded yet."
              : `${files.length} files · latest ${formatRelativeTime(files[0]?.lastSeenAt ?? new Date().toISOString())}${staleCount > 0 ? ` · ${staleCount} pre-compact` : ""}`}
          </div>
        </div>
        <span className="text-[0.76rem] font-semibold text-[var(--accent)]">{expanded ? "Hide" : "Show"}</span>
      </button>
      {!expanded && files.length > 0 && (
        <div className="px-4 py-3.5">
          <div className="flex flex-wrap gap-2">
            {files.slice(0, 3).map((file) => (
              <Badge key={file.path} tone="neutral" size="xs" className="max-w-full break-words" title={file.path}>
                {summarizePath(file.path, workspacePath)}
              </Badge>
            ))}
            {files.length > 3 && (
              <Badge tone="neutral" size="xs">+{files.length - 3} more</Badge>
            )}
          </div>
        </div>
      )}
      {expanded && (
        <div className="px-4 py-4">
          {files.length === 0 ? (
            <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No exploration file paths recorded yet.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-1.5">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">Sort</span>
                {EXPLORATION_SORT_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[0.72rem] font-semibold transition-colors",
                      sortKey === key
                        ? "bg-[var(--accent-light)] text-[var(--accent)]"
                        : "text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]"
                    )}
                    onClick={() => onSortChange(key)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {files.map((file) => {
                  const compactBadge = compactRelationLabel(file.compactRelation);
                  return (
                    <div key={file.path} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <strong className={cn("block min-w-0 break-words text-[0.82rem] text-[var(--text-1)]", monoText)} title={file.path}>
                          {toRelativePath(file.path, workspacePath)}
                        </strong>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {compactBadge && (
                            <Badge tone={compactBadge.tone} size="xs">{compactBadge.label}</Badge>
                          )}
                          <Badge tone="accent" size="xs">{file.count}x</Badge>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[0.8rem] text-[var(--text-3)]">
                        <span>{dirnameLabel(file.path, workspacePath)}</span>
                        <span>
                          {file.count > 1
                            ? `First ${formatRelativeTime(file.firstSeenAt)} · Last ${formatRelativeTime(file.lastSeenAt)}`
                            : `Read ${formatRelativeTime(file.lastSeenAt)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </PanelCard>
  );
}

function FileMentionRow({
  v, workspacePath
}: {
  readonly v: FileMentionVerification;
  readonly workspacePath?: string | undefined;
}): React.JSX.Element {
  return (
    <div className={cn(
      "rounded-[12px] border px-4 py-3",
      v.wasExplored
        ? "border-[var(--border)] bg-[var(--surface-2)]"
        : "border-[color-mix(in_srgb,#f59e0b_30%,transparent)] bg-[color-mix(in_srgb,#f59e0b_5%,var(--surface-2))]"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[0.72rem] text-[var(--text-3)]">file</span>
          <strong className={cn("block min-w-0 break-words text-[0.82rem] text-[var(--text-1)]", monoText)} title={v.path}>
            {toRelativePath(v.path, workspacePath)}
          </strong>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {v.wasExplored ? (
            <>
              {!v.exploredAfterMention && (
                <Badge tone="warning" size="xs">pre-mention</Badge>
              )}
              <Badge tone="success" size="xs">
                {v.explorationCount > 1 ? `read ${v.explorationCount}x` : "read ✓"}
              </Badge>
            </>
          ) : (
            <Badge tone="warning" size="xs">not read</Badge>
          )}
        </div>
      </div>
      <div className="mt-1.5 text-[0.78rem] text-[var(--text-3)]">
        Mentioned {formatRelativeTime(v.mentionedAt)}
        {v.wasExplored && v.firstExploredAt
          ? ` · first read ${formatRelativeTime(v.firstExploredAt)}`
          : !v.wasExplored ? " · not yet explored" : ""}
      </div>
    </div>
  );
}

function DirectoryMentionRow({
  v, workspacePath
}: {
  readonly v: DirectoryMentionVerification;
  readonly workspacePath?: string | undefined;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const count = v.exploredFilesInFolder.length;

  return (
    <div className={cn(
      "rounded-[12px] border px-4 py-3",
      v.wasExplored
        ? "border-[var(--border)] bg-[var(--surface-2)]"
        : "border-[color-mix(in_srgb,#f59e0b_30%,transparent)] bg-[color-mix(in_srgb,#f59e0b_5%,var(--surface-2))]"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[0.72rem] text-[var(--text-3)]">dir</span>
          <strong className={cn("block min-w-0 break-words text-[0.82rem] text-[var(--text-1)]", monoText)} title={v.path}>
            {toRelativePath(v.path.replace(/\/$/, ""), workspacePath)}/
          </strong>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {v.wasExplored ? (
            <>
              {!v.exploredAfterMention && (
                <Badge tone="warning" size="xs">pre-mention</Badge>
              )}
              <Badge tone="success" size="xs">{count} file{count !== 1 ? "s" : ""} read</Badge>
            </>
          ) : (
            <Badge tone="warning" size="xs">none read</Badge>
          )}
        </div>
      </div>
      <div className="mt-1.5 text-[0.78rem] text-[var(--text-3)]">
        Mentioned {formatRelativeTime(v.mentionedAt)}
        {count > 0 && (
          <button
            className="ml-2 text-[var(--accent)] hover:underline"
            onClick={() => setOpen((c) => !c)}
            type="button"
          >
            {open ? "hide files" : `show ${count} file${count !== 1 ? "s" : ""}`}
          </button>
        )}
      </div>
      {open && count > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {v.exploredFilesInFolder.map((f) => (
            <div key={f.path} className="flex items-center justify-between gap-2 rounded-[8px] bg-[var(--surface)] px-3 py-1.5">
              <span className={cn("min-w-0 break-words text-[0.78rem] text-[var(--text-2)]", monoText)} title={f.path}>
                {toRelativePath(f.path, workspacePath)}
              </span>
              <Badge tone="accent" size="xs">{f.count}x</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MentionedFilesVerificationCard: 사용자가 @ 멘션한 파일·폴더의 실제 탐색 여부를 검증해 표시.
 * 멘션이 없을 때도 항상 카드를 표시 (empty state 안내 포함).
 */
function MentionedFilesVerificationCard({
  verifications, workspacePath
}: {
  readonly verifications: readonly MentionedFileVerification[];
  readonly workspacePath?: string | undefined;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const unverifiedCount = verifications.filter((v) => !v.wasExplored).length;
  const preCount = verifications.filter((v) => v.wasExplored && !v.exploredAfterMention).length;

  const summaryText = verifications.length === 0
    ? "No @ mentions detected in user messages"
    : `${verifications.length} mentioned · ${unverifiedCount} not read${preCount > 0 ? ` · ${preCount} pre-mention` : ""}`;

  return (
    <PanelCard className={cardShell}>
      <button
        className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5 text-left"
        onClick={() => setExpanded((c) => !c)}
        type="button"
      >
        <div>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]">@ Mentioned Files</div>
          <div className="mt-1 text-[0.82rem] text-[var(--text-2)]">{summaryText}</div>
        </div>
        <span className="text-[0.76rem] font-semibold text-[var(--accent)]">{expanded ? "Hide" : "Show"}</span>
      </button>

      {/* 접힌 상태: 미리보기 배지 */}
      {!expanded && verifications.length > 0 && (
        <div className="px-4 py-3.5">
          <div className="flex flex-wrap gap-2">
            {verifications.slice(0, 3).map((v) => (
              <Badge
                key={`${v.mentionedInEventId}::${v.path}`}
                tone={v.wasExplored ? "success" : "warning"}
                size="xs"
                className="max-w-full break-words"
                title={v.path}
              >
                {v.mentionType === "directory" ? "📁 " : ""}{summarizePath(v.path, workspacePath)}
              </Badge>
            ))}
            {verifications.length > 3 && (
              <Badge tone="neutral" size="xs">+{verifications.length - 3} more</Badge>
            )}
          </div>
        </div>
      )}

      {/* 펼친 상태 */}
      {expanded && (
        <div className="px-4 py-4">
          {verifications.length === 0 ? (
            <p className="m-0 text-[0.8rem] text-[var(--text-3)]">
              User messages did not contain any @ file or folder references. Mentions are captured from <code className="text-[0.78rem]">@path</code>, backtick paths, and inline path tokens.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {verifications.map((v) =>
                v.mentionType === "directory" ? (
                  <DirectoryMentionRow key={`${v.mentionedInEventId}::${v.path}`} v={v} workspacePath={workspacePath} />
                ) : (
                  <FileMentionRow key={`${v.mentionedInEventId}::${v.path}`} v={v} workspacePath={workspacePath} />
                )
              )}
            </div>
          )}
        </div>
      )}
    </PanelCard>
  );
}

const FILE_SORT_OPTIONS: ReadonlyArray<{ readonly key: FileSortKey; readonly label: string }> = [
  { key: "recent",       label: "Recent" },
  { key: "most-active",  label: "Most active" },
  { key: "writes-first", label: "Writes first" },
  { key: "alpha",        label: "A→Z" }
];

/** DetailFileActivity: 실제 파일 활동(read + write) 목록 카드. */
function DetailFileActivity({
  files, workspacePath, expanded, sortKey, onToggle, onSortChange
}: {
  readonly files: readonly FileActivityStat[];
  readonly workspacePath?: string | undefined;
  readonly expanded: boolean;
  readonly sortKey: FileSortKey;
  readonly onToggle: () => void;
  readonly onSortChange: (key: FileSortKey) => void;
}): React.JSX.Element {
  const writeFiles = files.filter((f) => f.writeCount > 0).length;
  const readOnlyFiles = files.filter((f) => f.writeCount === 0).length;

  return (
    <PanelCard className={cardShell}>
      <button
        className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5 text-left"
        onClick={onToggle}
        type="button"
      >
        <div>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]">File Activity</div>
          <div className="mt-1 text-[0.82rem] text-[var(--text-2)]">
            {files.length === 0
              ? "No file activity recorded yet."
              : `${files.length} files · ${writeFiles} modified · ${readOnlyFiles} read-only`}
          </div>
        </div>
        <span className="text-[0.76rem] font-semibold text-[var(--accent)]">{expanded ? "Hide" : "Show"}</span>
      </button>
      {!expanded && files.length > 0 && (
        <div className="px-4 py-3.5">
          <div className="flex flex-wrap gap-2">
            {files.slice(0, 4).map((file) => (
              <Badge
                key={file.path}
                tone={file.writeCount > 0 ? "accent" : "neutral"}
                size="xs"
                className="max-w-full break-words"
                title={file.path}
              >
                {file.writeCount > 0 ? "✎ " : ""}{summarizePath(file.path, workspacePath)}
              </Badge>
            ))}
            {files.length > 4 && (
              <Badge tone="neutral" size="xs">+{files.length - 4} more</Badge>
            )}
          </div>
        </div>
      )}
      {expanded && (
        <div className="px-4 py-4">
          {files.length === 0 ? (
            <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No file activity recorded yet.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-1.5">
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">Sort</span>
                {FILE_SORT_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[0.72rem] font-semibold transition-colors",
                      sortKey === key
                        ? "bg-[var(--accent-light)] text-[var(--accent)]"
                        : "text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]"
                    )}
                    onClick={() => onSortChange(key)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {files.map((file) => {
                  const total = file.readCount + file.writeCount;
                  const compactBadge = compactRelationLabel(file.compactRelation);
                  return (
                    <div key={file.path} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <strong className={cn("block min-w-0 break-words text-[0.82rem] text-[var(--text-1)]", monoText)} title={file.path}>
                          {toRelativePath(file.path, workspacePath)}
                        </strong>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {compactBadge && (
                            <Badge tone={compactBadge.tone} size="xs">{compactBadge.label}</Badge>
                          )}
                          {file.writeCount > 0 && (
                            <Badge tone="accent" size="xs">{file.writeCount} write</Badge>
                          )}
                          <Badge tone="neutral" size="xs">{file.readCount > 0 ? `${file.readCount} read` : `${total}x`}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[0.8rem] text-[var(--text-3)]">
                        <span>{dirnameLabel(file.path, workspacePath)}</span>
                        <span>
                          {total > 1
                            ? `First ${formatRelativeTime(file.firstSeenAt)} · Last ${formatRelativeTime(file.lastSeenAt)}`
                            : formatRelativeTime(file.lastSeenAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </PanelCard>
  );
}

/** ExplorationInsightCard: 탐색 통계 인사이트 대시보드 카드. */
function ExplorationInsightCard({
  insight
}: {
  readonly insight: ExplorationInsight;
}): React.JSX.Element {
  const toolEntries = Object.entries(insight.toolBreakdown).sort((a, b) => b[1] - a[1]);

  return (
    <PanelCard className={cardShell}>
      <div className={cardHeader}>
        <span>Exploration Overview</span>
      </div>
      <div className={cardBody}>
        {insight.totalExplorations === 0 ? (
          <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No exploration activity recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
              <div className={innerPanel + " p-3"}>
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Total Explorations</span>
                <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.totalExplorations}</strong>
              </div>
              <div className={innerPanel + " p-3"}>
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Unique Files</span>
                <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.uniqueFiles}</strong>
              </div>
            </div>

            {(insight.preCompactFiles > 0 || insight.postCompactFiles > 0 || insight.acrossCompactFiles > 0) && (
              <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
                <div className={innerPanel + " p-3"}>
                  <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Pre-compact</span>
                  <strong className="mt-2 block text-[1.05rem] text-[color-mix(in_srgb,#f59e0b_80%,var(--text-1))]">{insight.preCompactFiles}</strong>
                </div>
                <div className={innerPanel + " p-3"}>
                  <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Post-compact</span>
                  <strong className="mt-2 block text-[1.05rem] text-[color-mix(in_srgb,#10b981_80%,var(--text-1))]">{insight.postCompactFiles}</strong>
                </div>
                <div className={innerPanel + " p-3"}>
                  <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Across compact</span>
                  <strong className="mt-2 block text-[1.05rem] text-[var(--accent)]">{insight.acrossCompactFiles}</strong>
                </div>
              </div>
            )}

            {toolEntries.length > 0 && (
              <div>
                <div className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Tool Breakdown</div>
                <div className="flex flex-col gap-2">
                  {toolEntries.map(([tool, count]) => (
                    <div key={tool} className="flex items-center justify-between gap-3 rounded-[8px] bg-[var(--surface-2)] px-3 py-2">
                      <span className={cn("min-w-0 break-words text-[0.82rem] text-[var(--text-2)]", monoText)}>{tool}</span>
                      <Badge tone="neutral" size="xs">{count}x</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(insight.firstExplorationAt || insight.lastExplorationAt) && (
              <div className="flex flex-wrap gap-4 text-[0.78rem] text-[var(--text-3)]">
                {insight.firstExplorationAt && (
                  <span>First: {formatRelativeTime(insight.firstExplorationAt)}</span>
                )}
                {insight.lastExplorationAt && (
                  <span>Last: {formatRelativeTime(insight.lastExplorationAt)}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </PanelCard>
  );
}

/** CompactActivityCard: compact 이벤트 활동 요약 카드. */
function CompactActivityCard({
  insight, selectedTag, onSelectTag
}: {
  readonly insight: CompactInsight;
  readonly selectedTag: string | null;
  readonly onSelectTag: (tag: string) => void;
}): React.JSX.Element {
  return (
    <PanelCard className={cardShell}>
      <div className={cardHeader}>
        <span>Compact Activity</span>
        <Button
          className={cn(
            "h-auto rounded-full px-3 py-1.5 text-[0.72rem] font-semibold shadow-none",
            selectedTag === "compact"
              ? "border-[var(--planning)] bg-[color-mix(in_srgb,var(--planning)_12%,var(--surface))] text-[var(--planning)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]"
          )}
          disabled={insight.occurrences === 0 && insight.handoffCount === 0}
          onClick={() => onSelectTag("compact")}
          size="sm"
          type="button"
          variant="bare"
        >
          Focus compact
        </Button>
      </div>
      <div className={cardBody}>
        {insight.occurrences === 0 && insight.handoffCount === 0 ? (
          <p className="m-0 text-[0.8rem] text-[var(--text-3)]">
            No compact-related task activity has been recorded yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
              <div className={innerPanel + " p-3"}>
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Compacts</span>
                <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.occurrences}</strong>
              </div>
              <div className={innerPanel + " p-3"}>
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Handoffs</span>
                <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.handoffCount}</strong>
              </div>
              <div className={innerPanel + " p-3"}>
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Markers</span>
                <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.eventCount}</strong>
              </div>
            </div>
            {insight.tagFacets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {insight.tagFacets.map((tag) => (
                  <Button
                    key={tag}
                    className={cn(
                      "h-auto rounded-full border px-3.5 py-1.5 text-[0.78rem] font-semibold shadow-none",
                      selectedTag === tag
                        ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-2)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]"
                    )}
                    onClick={() => onSelectTag(tag)}
                    size="sm"
                    type="button"
                    variant="bare"
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            )}
            {(insight.latestTitle || insight.latestBody || insight.lastSeenAt) && (
              <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <strong className="min-w-0 text-[0.92rem] text-[var(--text-1)]">{insight.latestTitle ?? "Latest compact signal"}</strong>
                  {insight.lastSeenAt && (
                    <Badge tone="accent" size="xs">{formatRelativeTime(insight.lastSeenAt)}</Badge>
                  )}
                </div>
                {insight.latestBody && (
                  <p className="mt-2 text-[0.82rem] leading-6 text-[var(--text-2)]">{summarizeDetailText(insight.latestBody, 220)}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </PanelCard>
  );
}

/** TaskExtractionCard: 태스크 추출 카드. 목표, 프로세스 섹션, 검증, 파일 표시. */
function TaskExtractionCard({
  extraction, workspacePath
}: {
  readonly extraction: TaskExtraction;
  readonly workspacePath?: string | undefined;
}): React.JSX.Element {
  return (
    <PanelCard className={cardShell}>
      <div className={cardHeader}>
        <span>Task Extraction</span>
      </div>
      <div className={cardBody}>
        <div className="rounded-[14px] border border-[var(--exploration-border)] bg-[color-mix(in_srgb,var(--exploration-bg)_60%,var(--surface))] p-4">
          <strong className="block break-words text-[0.98rem] leading-6 text-[var(--text-1)] [overflow-wrap:anywhere]">{extraction.objective}</strong>
        </div>

        {extraction.sections.length > 0 && (
          <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {extraction.sections.map((section) => (
              <div key={section.lane} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                  <Badge tone="neutral" size="xs" className="uppercase tracking-[0.06em]">
                    {section.lane}
                  </Badge>
                  <strong className="min-w-0 text-[0.84rem] text-[var(--text-1)]">{section.title}</strong>
                </div>
                <div className="flex flex-col gap-2">
                  {section.items.map((item) => (
                    <p key={`${section.lane}-${item}`} className="m-0 break-words text-[0.78rem] leading-6 text-[var(--text-2)] [overflow-wrap:anywhere]">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3">
          {extraction.validations.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Validation</span>
              <div className="flex flex-wrap gap-2">
                {extraction.validations.map((item) => (
                  <Badge key={item} tone="neutral" size="xs" className="max-w-full break-words">{item}</Badge>
                ))}
              </div>
            </div>
          )}

          {extraction.files.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Files</span>
              <div className="flex flex-wrap gap-2">
                {extraction.files.slice(0, 6).map((filePath) => (
                  <Badge key={filePath} tone="neutral" size="xs" className="max-w-full break-words" title={filePath}>
                    {summarizePath(filePath, workspacePath)}
                  </Badge>
                ))}
                {extraction.files.length > 6 && (
                  <Badge tone="neutral" size="xs">+{extraction.files.length - 6} more</Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelCard>
  );
}

/** TagExplorerCard: 태그 탐색 인사이트 카드. */
function TagExplorerCard({
  tags, selectedTag, onSelectTag
}: {
  readonly tags: readonly TagInsight[];
  readonly selectedTag: string | null;
  readonly onSelectTag: (tag: string) => void;
}): React.JSX.Element {
  const selectedInsight = selectedTag
    ? tags.find((tag) => tag.tag === selectedTag) ?? null
    : null;

  return (
    <PanelCard className={cardShell}>
      <div className={cardBody}>
        <SectionTitle
          action={selectedTag ? (
            <Button
              className="h-auto rounded-full px-3 py-1.5 text-[0.72rem] font-semibold"
              onClick={() => onSelectTag(selectedTag)}
              size="sm"
              type="button"
              variant="bare"
            >
              Clear
            </Button>
          ) : undefined}
          description={`${tags.length} distinct tags across the selected task`}
          eyebrow="Tags"
          title="Tag Explorer"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.length === 0 ? (
            <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No tags observed yet.</p>
          ) : (
            tags.map((tag) => (
              <Button
                key={tag.tag}
                className={cn(
                  "h-auto rounded-full border px-3.5 py-1.5 text-[0.78rem] font-semibold shadow-none",
                  selectedTag === tag.tag
                    ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-2)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]"
                )}
                onClick={() => onSelectTag(tag.tag)}
                size="sm"
                type="button"
                variant="bare"
              >
                <span className="font-mono">{tag.tag}</span>
                <span className="ml-2 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--text-3)]">{tag.count}</span>
              </Button>
            ))
          )}
        </div>
        <div className="mt-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
          {selectedInsight ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <strong className="font-mono text-[0.9rem] text-[var(--text-1)]">{selectedInsight.tag}</strong>
                <Badge tone="accent" size="xs">{selectedInsight.count} events</Badge>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Lanes</div>
                  <div className="mt-1 text-[0.82rem] text-[var(--text-2)]">{selectedInsight.lanes.join(" · ")}</div>
                </div>
                <div>
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Rules</div>
                  <div className="mt-1 text-[0.82rem] text-[var(--text-2)]">
                    {selectedInsight.ruleIds.length > 0 ? selectedInsight.ruleIds.join(", ") : "No linked rule"}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="m-0 text-[0.8rem] text-[var(--text-3)]">
              Pick a tag chip to focus the timeline and inspect where that signal appears.
            </p>
          )}
        </div>
      </div>
    </PanelCard>
  );
}

function toRelativePath(filePath: string, workspacePath?: string): string {
  if (!workspacePath) {
    return filePath;
  }

  const normalizedWorkspacePath = workspacePath.endsWith("/") ? workspacePath : `${workspacePath}/`;

  if (filePath.startsWith(normalizedWorkspacePath)) {
    return filePath.slice(normalizedWorkspacePath.length);
  }

  // leading slash가 누락된 절대 경로 처리 (e.g. file watcher 버그로 "Users/..." 형태로 저장된 경우)
  const withSlash = filePath.startsWith("/") ? filePath : `/${filePath}`;
  if (withSlash.startsWith(normalizedWorkspacePath)) {
    return withSlash.slice(normalizedWorkspacePath.length);
  }

  return filePath;
}

function summarizePath(filePath: string, workspacePath?: string): string {
  const relative = toRelativePath(filePath, workspacePath);
  if (relative.length <= 42) {
    return relative;
  }

  const parts = relative.split("/");
  const shortened = parts.length > 3 ? parts.slice(-3).join("/") : relative;
  return shortened.length > 42 ? `…${shortened.slice(-(42 - 1))}` : shortened;
}

function dirnameLabel(filePath: string, workspacePath?: string): string {
  const relative = toRelativePath(filePath, workspacePath);
  const segments = relative.split("/");

  if (segments.length <= 1) {
    return "Workspace root";
  }

  return segments.slice(0, -1).join("/");
}

function summarizeDetailText(value: string, limit = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1)}…`;
}

/**
 * 이벤트 상세 정보 및 지원 패널 전체를 담당하는 inspector 컴포넌트.
 * 이벤트 또는 커넥터 선택에 따라 primary 섹션 내용이 변경됨.
 * secondary 섹션에는 규칙/태그/태스크/compact/파일 탭이 있음.
 */
export function EventInspector({
  taskDetail,
  selectedEvent,
  selectedConnector,
  selectedEventDisplayTitle,
  selectedTaskBookmark = null,
  selectedEventBookmark = null,
  selectedTag,
  selectedRuleId,
  taskModelSummary,
  isCollapsed = false,
  className,
  onToggleCollapse,
  onCreateTaskBookmark,
  onCreateEventBookmark,
  onUpdateEventDisplayTitle,
  onSelectTag,
  onSelectRule
}: EventInspectorProps): React.JSX.Element {
  const [activeTab, setActiveTab]                   = useState<PanelTabId>("inspector");
  const [isExploredFilesExpanded, setIsExploredFilesExpanded] = useState(true);
  const [isFileActivityExpanded, setIsFileActivityExpanded]   = useState(true);
  const [explorationSortKey, setExplorationSortKey] = useState<ExplorationSortKey>("recent");
  const [fileSortKey, setFileSortKey]               = useState<FileSortKey>("recent");
  const [isEditingEventTitle, setIsEditingEventTitle] = useState(false);
  const [eventTitleDraft, setEventTitleDraft] = useState("");
  const [eventTitleError, setEventTitleError] = useState<string | null>(null);
  const [isSavingEventTitle, setIsSavingEventTitle] = useState(false);

  const taskTimeline = taskDetail?.timeline ?? [];

  const exploredFiles = useMemo(
    () => collectExploredFiles(taskTimeline),
    [taskTimeline]
  );
  const fileActivity = useMemo(
    () => collectFileActivity(taskTimeline),
    [taskTimeline]
  );

  const sortedExploredFiles = useMemo(
    () => sortExploredFiles(exploredFiles, explorationSortKey),
    [exploredFiles, explorationSortKey]
  );
  const sortedFileActivity = useMemo(
    () => sortFileActivity(fileActivity, fileSortKey),
    [fileActivity, fileSortKey]
  );
  const explorationInsight = useMemo(
    () => buildExplorationInsight(taskTimeline, exploredFiles),
    [exploredFiles, taskTimeline]
  );
  const compactInsight = useMemo(
    () => buildCompactInsight(taskTimeline),
    [taskTimeline]
  );
  const taskExtraction = useMemo(
    () => buildTaskExtraction(taskDetail?.task, taskTimeline, exploredFiles),
    [exploredFiles, taskDetail?.task, taskTimeline]
  );
  const observabilityStats = useMemo(
    () => buildObservabilityStats(taskTimeline, exploredFiles.length, compactInsight.occurrences),
    [compactInsight.occurrences, exploredFiles.length, taskTimeline]
  );
  const tagInsights = useMemo(
    () => buildTagInsights(taskTimeline),
    [taskTimeline]
  );
  const questionGroups = useMemo(
    () => buildQuestionGroups(taskTimeline),
    [taskTimeline]
  );
  const todoGroups = useMemo(
    () => buildTodoGroups(taskTimeline),
    [taskTimeline]
  );
  const mentionedVerifications = useMemo(
    () => buildMentionedFileVerifications(taskTimeline, exploredFiles, taskDetail?.task.workspacePath),
    [exploredFiles, taskDetail?.task.workspacePath, taskTimeline]
  );

  // ── Handoff panel data ──
  const handoffExploredFiles = useMemo(
    () => collectExploredFiles(taskTimeline).map(f => f.path),
    [taskTimeline]
  );
  const handoffModifiedFiles = useMemo(
    () => collectFileActivity(taskTimeline).filter(f => f.writeCount > 0).map(f => f.path),
    [taskTimeline]
  );
  const handoffOpenTodos = useMemo(
    () => todoGroups.filter(g => !g.isTerminal).map(g => g.title),
    [todoGroups]
  );
  const handoffOpenQuestions = useMemo(
    () => questionGroups
      .filter(g => !g.isComplete)
      .flatMap(g => g.phases)
      .filter(p => p.phase === "asked")
      .map(p => p.event.body ?? p.event.title ?? "")
      .filter(Boolean),
    [questionGroups]
  );
  const handoffViolations = useMemo(
    () => collectViolationDescriptions(taskTimeline),
    [taskTimeline]
  );
  const handoffPlans = useMemo(
    () => collectPlanSteps(taskTimeline),
    [taskTimeline]
  );

  const relatedEvents = useMemo(() => {
    if (!selectedEvent) {
      return [];
    }

    const relatedIds = new Set<string>();
    const parentEventId = selectedEvent.metadata["parentEventId"];
    if (typeof parentEventId === "string") {
      relatedIds.add(parentEventId);
    }

    const relationIds = selectedEvent.metadata["relatedEventIds"];
    if (Array.isArray(relationIds)) {
      for (const value of relationIds) {
        if (typeof value === "string") {
          relatedIds.add(value);
        }
      }
    }

    return taskTimeline.filter((event) => relatedIds.has(event.id));
  }, [selectedEvent, taskTimeline]);

  const eventTime = selectedEvent
    ? new Date(selectedEvent.createdAt).toLocaleTimeString()
    : null;
  const selectedEventDisplayTitleOverride = selectedEvent && typeof selectedEvent.metadata["displayTitle"] === "string"
    ? selectedEvent.metadata["displayTitle"].trim()
    : null;
  const canEditSelectedEventTitle = Boolean(selectedEvent && selectedEvent.kind !== "task.start");

  const obsBadges = taskDetail ? [
    { key: "actions",    label: "Actions",    value: observabilityStats.actions,       tone: "accent" as const },
    { key: "coordination", label: "Coordination", value: observabilityStats.coordinationActivities, tone: "success" as const },
    { key: "files",      label: "Files",      value: observabilityStats.exploredFiles, tone: "neutral" as const },
    { key: "compacts",   label: "Compact",    value: observabilityStats.compactions,   tone: "warning" as const },
    { key: "checks",     label: "Check",      value: observabilityStats.checks,        tone: "accent" as const },
    { key: "violations", label: "Violation",  value: observabilityStats.violations,    tone: "danger" as const },
    { key: "passes",     label: "Pass",       value: observabilityStats.passes,        tone: "success" as const },
  ].filter((b) => b.value > 0) : [];

  useEffect(() => {
    setIsEditingEventTitle(false);
    setEventTitleDraft(selectedEventDisplayTitle ?? "");
    setEventTitleError(null);
    setIsSavingEventTitle(false);
  }, [selectedEvent?.id, selectedEventDisplayTitle]);

  async function handleEventTitleSubmit(
    event: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> {
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
    } catch (error) {
      setEventTitleError(error instanceof Error ? error.message : "Failed to save event title.");
    } finally {
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
    } catch (error) {
      setEventTitleError(error instanceof Error ? error.message : "Failed to reset event title.");
    } finally {
      setIsSavingEventTitle(false);
    }
  }

  return (
    <aside className={cn("detail-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]", className)}>
      {/* ── Tab bar ── */}
      <div className="panel-tab-bar flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2" aria-label="Inspector panels" role="tablist">
        <button
          aria-label={isCollapsed ? "Expand inspector" : "Collapse inspector"}
          className="inspector-toggle-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[0.95rem] font-semibold text-[var(--text-2)] shadow-sm transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand inspector" : "Collapse inspector"}
          type="button"
        >
          {isCollapsed ? "‹" : "›"}
        </button>
        {PANEL_TABS.map((tab) => (
          <button
            key={tab.id}
            aria-selected={activeTab === tab.id}
            className={cn(
              "panel-tab inline-flex h-8 items-center rounded-[8px] border px-3 text-[0.76rem] font-semibold transition-colors",
              activeTab === tab.id
                ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                : "border-transparent bg-transparent text-[var(--text-3)] hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]"
            )}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div
        className={cn(
          "panel-tab-content flex min-h-0 flex-1 flex-col overflow-y-auto"
        )}
        role="tabpanel"
      >

        {activeTab === "inspector" ? (
          <>
            <div className="px-4 pt-4">
              <InspectorHeaderCard
                actions={(
                  <>
                    <Button className="h-auto rounded-full px-3 py-1.5 text-[0.72rem] font-semibold" onClick={onCreateTaskBookmark} size="sm" type="button" variant="ghost">
                      {selectedTaskBookmark ? "Task Saved" : "Save Task"}
                    </Button>
                    {selectedEvent && (
                      <Button className="h-auto rounded-full px-3 py-1.5 text-[0.72rem] font-semibold" onClick={onCreateEventBookmark} size="sm" type="button" variant="ghost">
                        {selectedEventBookmark ? "Card Saved" : "Save Card"}
                      </Button>
                    )}
                    {selectedConnector ? (
                      <Badge tone="neutral" size="xs" className="uppercase tracking-[0.06em]">
                        {selectedConnector.connector.isExplicit ? "relation" : "transition"} · {selectedConnector.connector.cross ? "cross-lane" : "same-lane"}
                      </Badge>
                    ) : selectedEvent ? (
                      <Badge tone="neutral" size="xs" className="uppercase tracking-[0.06em]">{selectedEvent.kind} · {selectedEvent.lane}</Badge>
                    ) : null}
                    {eventTime && <Badge tone="accent" size="xs">{eventTime}</Badge>}
                    {selectedEvent && canEditSelectedEventTitle && !isEditingEventTitle && (
                      <Button
                        className="h-auto rounded-full px-3 py-1.5 text-[0.72rem] font-semibold"
                        onClick={() => {
                          setEventTitleDraft(selectedEventDisplayTitle ?? "");
                          setEventTitleError(null);
                          setIsEditingEventTitle(true);
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Rename Card
                      </Button>
                    )}
                    {selectedEvent && canEditSelectedEventTitle && selectedEventDisplayTitleOverride && !isEditingEventTitle && (
                      <Button
                        className="h-auto rounded-full px-3 py-1.5 text-[0.72rem] font-semibold"
                        onClick={() => { void handleResetEventTitle(); }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Reset Title
                      </Button>
                    )}
                  </>
                )}
                description={
                  selectedConnector
                    ? `${selectedConnector.connector.isExplicit ? "Explicit relation" : "Fallback sequence"} linking ${selectedConnector.source.lane} to ${selectedConnector.target.lane}.`
                    : selectedEvent
                      ? `${selectedEvent.kind} in ${selectedEvent.lane}.`
                      : "Choose an event or connector to inspect its full timeline context."
                }
                eyebrow="Inspector"
                title={
                  selectedConnector
                    ? `${buildInspectorEventTitle(selectedConnector.source) ?? selectedConnector.source.title} → ${buildInspectorEventTitle(selectedConnector.target) ?? selectedConnector.target.title}`
                    : selectedEventDisplayTitle ?? "Select an event"
                }
              >
                {selectedEvent && canEditSelectedEventTitle && isEditingEventTitle && (
                  <form className="mt-4 flex flex-col gap-2" onSubmit={(event) => { void handleEventTitleSubmit(event); }}>
                    <input
                      className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[0.84rem] text-[var(--text-1)] outline-none transition-colors focus:border-[var(--accent)]"
                      disabled={isSavingEventTitle}
                      onChange={(event) => setEventTitleDraft(event.target.value)}
                      placeholder="Short title for this card"
                      type="text"
                      value={eventTitleDraft}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        className="h-7 rounded-full border-[var(--accent)] bg-[var(--accent-light)] px-3 text-[0.72rem] font-semibold text-[var(--accent)] shadow-none hover:border-[var(--accent)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
                        disabled={isSavingEventTitle}
                        size="sm"
                        type="submit"
                      >
                        {isSavingEventTitle ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        className="h-7 rounded-full px-3 text-[0.72rem] font-semibold shadow-none"
                        disabled={isSavingEventTitle}
                        onClick={() => {
                          setEventTitleDraft(selectedEventDisplayTitle ?? "");
                          setEventTitleError(null);
                          setIsEditingEventTitle(false);
                        }}
                        size="sm"
                        type="button"
                      >
                        Cancel
                      </Button>
                      {selectedEventDisplayTitleOverride && (
                        <Button
                          className="h-7 rounded-full px-3 text-[0.72rem] font-semibold shadow-none"
                          disabled={isSavingEventTitle}
                          onClick={() => { void handleResetEventTitle(); }}
                          size="sm"
                          type="button"
                        >
                          Reset to Raw
                        </Button>
                      )}
                    </div>
                    <p className="m-0 text-[0.76rem] text-[var(--text-3)]">
                      Raw event title is preserved. This only changes the inspector display title.
                    </p>
                    {eventTitleError && <p className="m-0 text-[0.76rem] font-medium text-[var(--danger)]">{eventTitleError}</p>}
                  </form>
                )}
              </InspectorHeaderCard>
            </div>

            {selectedConnector ? (
              <div className="flex flex-col gap-5 px-4 py-5">
                <DetailSection
                  label="Full Context"
                  resizable
                  value={[
                    `${selectedConnector.connector.isExplicit ? "Explicit relation" : "Fallback sequence"} from ${selectedConnector.source.lane} to ${selectedConnector.target.lane}.`,
                    selectedConnector.connector.label ? `Label: ${selectedConnector.connector.label}` : undefined,
                    selectedConnector.connector.explanation,
                    `From: ${buildInspectorEventTitle(selectedConnector.source) ?? selectedConnector.source.title}`,
                    `To: ${buildInspectorEventTitle(selectedConnector.target) ?? selectedConnector.target.title}`
                  ].filter((value): value is string => Boolean(value)).join("\n")}
                />
                <DetailConnectorIds connector={selectedConnector.connector} source={selectedConnector.source} target={selectedConnector.target} />
                <DetailTags
                  title="Transition Tags"
                  values={[
                    selectedConnector.connector.isExplicit ? "explicit" : "inferred",
                    selectedConnector.connector.cross ? "cross-lane" : "same-lane",
                    selectedConnector.source.lane,
                    selectedConnector.target.lane,
                    selectedConnector.connector.relationType ?? "relates_to"
                  ]}
                />
                <DetailConnectorEvents source={selectedConnector.source} target={selectedConnector.target} />
                <DetailSection
                  label="Metadata"
                  mono
                  value={JSON.stringify({
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
                  }, null, 2)}
                />
              </div>
            ) : selectedEvent ? (
              <div className="flex flex-col gap-5 px-4 py-5">
                <DetailSection
                  label="Full Context"
                  resizable
                  value={
                    selectedEvent.body
                    ?? (selectedEvent.metadata?.description as string | undefined)
                    ?? (selectedEvent.metadata?.command as string | undefined)
                    ?? (selectedEvent.metadata?.result as string | undefined)
                    ?? (selectedEvent.metadata?.action as string | undefined)
                    ?? (selectedEvent.metadata?.ruleId as string | undefined)
                    ?? "—"
                  }
                />
                <DetailIds event={selectedEvent} />
                {selectedEvent.kind === "question.logged" && (() => {
                  const qId = selectedEvent.metadata["questionId"] as string | undefined;
                  const group = qId ? questionGroups.find((g) => g.questionId === qId) : null;
                  return group ? <DetailQuestionFlow group={group} /> : null;
                })()}
                {selectedEvent.kind === "todo.logged" && (() => {
                  const tId = selectedEvent.metadata["todoId"] as string | undefined;
                  const group = tId ? todoGroups.find((g) => g.todoId === tId) : null;
                  return group ? <DetailTodoFlow group={group} /> : null;
                })()}
                {selectedEvent.lane === "coordination" && (
                  <DetailSection
                    label="Agent Activity"
                    resizable
                    value={[
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
                    ].filter((value): value is string => Boolean(value)).join("\n") || "No coordination metadata"}
                  />
                )}
                {relatedEvents.length > 0 && <DetailRelatedEvents events={relatedEvents} />}
                {selectedEvent.kind === "user.message" && <DetailCaptureInfo event={selectedEvent} />}
                {selectedEvent.kind === "assistant.response" && <DetailTokenUsage event={selectedEvent} />}
                {(selectedEvent.metadata["modelName"] as string | undefined) && (
                  <DetailModelInfo
                    modelName={selectedEvent.metadata["modelName"] as string}
                    modelProvider={selectedEvent.metadata["modelProvider"] as string | undefined}
                  />
                )}
                <DetailTags
                  title="Tags"
                  values={selectedEvent.classification.tags}
                  activeValue={selectedTag}
                  onSelect={(tag) => onSelectTag(selectedTag === tag ? null : tag)}
                />
                <DetailMatchList
                  event={selectedEvent}
                  activeRuleId={selectedRuleId}
                  onSelectRule={(ruleId) => {
                    onSelectRule(selectedRuleId === ruleId ? null : ruleId);
                  }}
                />
                <DetailSection label="Metadata" mono value={JSON.stringify(selectedEvent.metadata, null, 2)} />
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="m-0 text-[0.9rem] font-medium text-[var(--text-2)]">No event selected.</p>
                <p className="mt-2 text-[0.8rem] text-[var(--text-3)]">
                  As soon as the monitor records activity, the latest item appears here.
                </p>
              </div>
            )}

            {obsBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-3">
                {obsBadges.map((b) => (
                  <Badge key={b.key} tone={b.tone} size="xs" className="gap-1 px-2.5 py-1 text-[0.68rem]">
                    <strong>{b.value}</strong>
                    <span>{b.label}</span>
                  </Badge>
                ))}
              </div>
            )}
            {taskModelSummary && (
              <div className="px-4 pb-4">
                <DetailTaskModel summary={taskModelSummary} />
              </div>
            )}
          </>

        ) : activeTab === "tags" ? (
          <div className="panel-tab-inner flex flex-col gap-5 p-4">
            <TagExplorerCard
              tags={tagInsights}
              selectedTag={selectedTag}
              onSelectTag={(tag) => onSelectTag(selectedTag === tag ? null : tag)}
            />
          </div>

        ) : activeTab === "task" ? (
          <div className="panel-tab-inner flex flex-col gap-5 p-4">
            <TaskExtractionCard
              extraction={taskExtraction}
              workspacePath={taskDetail?.task.workspacePath}
            />
            {taskExtraction.objective && (
              <TaskHandoffPanel
                objective={taskExtraction.objective}
                summary={taskExtraction.summary}
                plans={handoffPlans}
                sections={taskExtraction.sections}
                exploredFiles={handoffExploredFiles}
                modifiedFiles={handoffModifiedFiles}
                openTodos={handoffOpenTodos}
                openQuestions={handoffOpenQuestions}
                violations={handoffViolations}
              />
            )}
          </div>

        ) : activeTab === "compact" ? (
          <div className="panel-tab-inner flex flex-col gap-5 p-4">
            <CompactActivityCard
              insight={compactInsight}
              selectedTag={selectedTag}
              onSelectTag={(tag) => onSelectTag(selectedTag === tag ? null : tag)}
            />
          </div>

        ) : activeTab === "files" ? (
          <div className="panel-tab-inner flex flex-col gap-5 p-4">
            <DetailFileActivity
              files={sortedFileActivity}
              workspacePath={taskDetail?.task.workspacePath}
              expanded={isFileActivityExpanded}
              sortKey={fileSortKey}
              onToggle={() => setIsFileActivityExpanded((current) => !current)}
              onSortChange={setFileSortKey}
            />
          </div>

        ) : (
          <div className="panel-tab-inner flex flex-col gap-5 p-4">
            <ExplorationInsightCard insight={explorationInsight} />
            <DetailExploredFiles
              files={sortedExploredFiles}
              workspacePath={taskDetail?.task.workspacePath}
              expanded={isExploredFilesExpanded}
              sortKey={explorationSortKey}
              onToggle={() => setIsExploredFilesExpanded((current) => !current)}
              onSortChange={setExplorationSortKey}
            />
            <MentionedFilesVerificationCard
              verifications={mentionedVerifications}
              workspacePath={taskDetail?.task.workspacePath}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
