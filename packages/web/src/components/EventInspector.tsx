/**
 * 이벤트 상세 정보 패널 (오른쪽 inspector 영역).
 * 분류 결과, 메타데이터, 파일 경로 등 전체 이벤트 데이터 표시.
 * 이벤트 선택 및 커넥터 선택 두 모드를 지원하며 지원 패널(규칙/태그/태스크/compact/파일)을 포함.
 */

import type React from "react";
import {
  useMemo,
  useState
} from "react";

import {
  buildCompactInsight,
  buildObservabilityStats,
  buildQuestionGroups,
  buildRuleCoverage,
  buildTagInsights,
  buildTaskExtraction,
  buildTodoGroups,
  collectExploredFiles,
  eventHasRuleGap,
  type CompactInsight,
  type ExploredFileStat,
  type ModelSummary,
  type QuestionGroup,
  type RuleCoverageStat,
  type TaskExtraction,
  type TagInsight,
  type TodoGroup
} from "../lib/insights.js";
import {
  formatCount,
  formatDuration,
  formatPhaseLabel,
  formatRate
} from "../lib/observability.js";
import { formatRelativeTime } from "../lib/timeline.js";
import type { TimelineConnector } from "../lib/timeline.js";
import { useDragScroll } from "../lib/useDragScroll.js";
import type {
  BookmarkRecord,
  OverviewResponse,
  TaskObservabilityResponse,
  TaskDetailResponse,
  TimelineEvent
} from "../types.js";

type PanelTabId = "inspector" | "flow" | "health" | "rules" | "tags" | "task" | "compact" | "files";

const PANEL_TABS = [
  { id: "inspector", label: "Inspector" },
  { id: "flow",      label: "Flow" },
  { id: "health",    label: "Health" },
  { id: "rules",     label: "Rules" },
  { id: "tags",      label: "Tags" },
  { id: "task",      label: "Task" },
  { id: "compact",   label: "Compact" },
  { id: "files",     label: "Files" },
] as const;

interface SelectedConnectorData {
  readonly connector: TimelineConnector;
  readonly source: TimelineEvent;
  readonly target: TimelineEvent;
}

interface EventInspectorProps {
  readonly taskDetail: TaskDetailResponse | null;
  readonly overview: OverviewResponse | null;
  readonly taskObservability?: TaskObservabilityResponse | null;
  readonly selectedEvent: TimelineEvent | null;
  readonly selectedConnector: SelectedConnectorData | null;
  readonly selectedEventDisplayTitle: string | null;
  readonly selectedTaskBookmark?: BookmarkRecord | null;
  readonly selectedEventBookmark?: BookmarkRecord | null;
  readonly selectedTag: string | null;
  readonly selectedRuleId: string | null;
  readonly showRuleGapsOnly: boolean;
  readonly taskModelSummary?: ModelSummary | undefined;
  readonly isCollapsed?: boolean;
  readonly onToggleCollapse?: () => void;
  readonly onCreateTaskBookmark: () => void;
  readonly onCreateEventBookmark: () => void;
  readonly onSelectTag: (tag: string | null) => void;
  readonly onSelectRule: (ruleId: string | null) => void;
  readonly onToggleRuleGaps: () => void;
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
    <div className="detail-card">
      <div className="detail-card-head">{label}</div>
      <div className="detail-card-body">
        <pre className={`detail-value${mono ? " mono" : ""}${resizable ? " resizable" : ""}`}>{value}</pre>
      </div>
    </div>
  );
}

/** DetailIds: 이벤트 식별자(event ID, task ID, session ID, time)를 테이블로 표시. */
function DetailIds({ event }: { readonly event: TimelineEvent }): React.JSX.Element {
  return (
    <div className="detail-card">
      <div className="detail-card-head">IDs</div>
      <div className="detail-card-body">
        <table className="ids-table">
          <tbody>
            <tr>
              <td className="ids-key muted small">Event</td>
              <td className="ids-val mono">{event.id}</td>
            </tr>
            <tr>
              <td className="ids-key muted small">Task</td>
              <td className="ids-val mono">{event.taskId}</td>
            </tr>
            {event.sessionId && (
              <tr>
                <td className="ids-key muted small">Session</td>
                <td className="ids-val mono">{event.sessionId}</td>
              </tr>
            )}
            <tr>
              <td className="ids-key muted small">Time</td>
              <td className="ids-val mono">{new Date(event.createdAt).toLocaleTimeString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
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
    <div className="detail-card">
      <div className="detail-card-head">IDs</div>
      <div className="detail-card-body">
        <table className="ids-table">
          <tbody>
            <tr>
              <td className="ids-key muted small">Path</td>
              <td className="ids-val mono">{connector.key}</td>
            </tr>
            <tr>
              <td className="ids-key muted small">From</td>
              <td className="ids-val mono">{source.id}</td>
            </tr>
            <tr>
              <td className="ids-key muted small">To</td>
              <td className="ids-val mono">{target.id}</td>
            </tr>
            <tr>
              <td className="ids-key muted small">Time</td>
              <td className="ids-val mono">{new Date(target.createdAt).toLocaleTimeString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
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
    <div className="detail-card">
      <div className="detail-card-head">{title}</div>
      <div className="detail-card-body">
        <div className="tag-row">
          {values.length === 0
            ? <span className="muted small">No tags</span>
            : values.map((v) => (
                onSelect ? (
                  <button
                    key={v}
                    className={`tag-pill-button${activeValue === v ? " active" : ""}`}
                    onClick={() => onSelect(v)}
                    type="button"
                  >
                    {v}
                  </button>
                ) : (
                  <span key={v} className="tag-pill">{v}</span>
                )
              ))
          }
        </div>
      </div>
    </div>
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
    <div className="detail-card">
      <div className="detail-card-head">Classification Matches</div>
      <div className="detail-card-body">
        {event.classification.matches.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No classifier matched this event.</p>
        ) : (
          <div className="match-list">
            {event.classification.matches.map((match) => (
              <div key={`${event.id}-${match.ruleId}`} className="match-item">
                <div className="match-header">
                  {onSelectRule ? (
                    <button
                      className={`match-link${activeRuleId === match.ruleId ? " active" : ""}`}
                      onClick={() => onSelectRule(match.ruleId)}
                      type="button"
                    >
                      {match.ruleId}
                    </button>
                  ) : (
                    <strong>{match.ruleId}</strong>
                  )}
                  <span className="match-score">{match.score} · {match.source ?? "rules-index"}</span>
                </div>
                <div className="tag-row">
                  {match.tags.map((tag) => (
                    <span key={tag} className="tag-pill">{tag}</span>
                  ))}
                </div>
                <ul className="reason-list">
                  {match.reasons.map((reason) => (
                    <li key={`${reason.kind}-${reason.value}`}>
                      {reason.kind}: <span className="mono">{reason.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
    <div className="detail-card">
      <div className="detail-card-head">Connected Events</div>
      <div className="detail-card-body">
        <div className="match-list">
          {[source, target].map((event, index) => (
            <div key={event.id} className="match-item">
              <div className="match-header">
                <strong>{index === 0 ? "From" : "To"}</strong>
                <span className="match-score">{event.lane}</span>
              </div>
              <p className="muted small" style={{ margin: 0 }}>{event.title}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailRelatedEvents({
  events
}: {
  readonly events: readonly TimelineEvent[];
}): React.JSX.Element {
  return (
    <div className="detail-card">
      <div className="detail-card-head">Related Events</div>
      <div className="detail-card-body">
        {events.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No related events linked from metadata.</p>
        ) : (
          <div className="match-list">
            {events.map((event) => (
              <div key={event.id} className="match-item">
                <div className="match-header">
                  <strong>{event.title}</strong>
                  <span className="match-score">{event.lane}</span>
                </div>
                <p className="muted small" style={{ margin: 0 }}>{summarizeDetailText(event.body ?? event.kind)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ObservabilityMetricGrid({
  items
}: {
  readonly items: readonly {
    readonly label: string;
    readonly value: string;
    readonly note?: string | undefined;
    readonly tone?: "accent" | "ok" | "warn" | "muted" | undefined;
  }[];
}): React.JSX.Element {
  return (
    <div className="observability-metric-grid">
      {items.map((item) => (
        <div key={item.label} className={`observability-metric-tile${item.tone ? ` tone-${item.tone}` : ""}`}>
          <span className="observability-metric-label">{item.label}</span>
          <strong className="observability-metric-value">{item.value}</strong>
          {item.note && <span className="observability-metric-note">{item.note}</span>}
        </div>
      ))}
    </div>
  );
}

function ObservabilityListCard({
  title,
  items,
  emptyLabel = "None"
}: {
  readonly title: string;
  readonly items: readonly {
    readonly label: string;
    readonly value: string;
    readonly note?: string | undefined;
  }[];
  readonly emptyLabel?: string;
}): React.JSX.Element {
  return (
    <div className="detail-card">
      <div className="detail-card-head">{title}</div>
      <div className="detail-card-body">
        {items.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>{emptyLabel}</p>
        ) : (
          <div className="match-list">
            {items.map((item) => (
              <div key={`${title}-${item.label}-${item.value}`} className="match-item">
                <div className="match-header">
                  <strong>{item.label}</strong>
                  <span className="match-score">{item.value}</span>
                </div>
                {item.note && <p className="muted small" style={{ margin: 0 }}>{item.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ObservabilityPhaseCard({
  phases
}: {
  readonly phases: readonly {
    readonly phase: string;
    readonly durationMs: number;
    readonly share: number;
  }[];
}): React.JSX.Element {
  return (
    <div className="detail-card">
      <div className="detail-card-head">Phase Breakdown</div>
      <div className="detail-card-body">
        {phases.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No phase data yet.</p>
        ) : (
          <div className="observability-phase-list">
            {phases.map((phase) => {
              const share = phase.share > 1 ? phase.share / 100 : phase.share;
              return (
                <div key={phase.phase} className="observability-phase-row">
                  <div className="observability-phase-head">
                    <strong>{formatPhaseLabel(phase.phase)}</strong>
                    <span className="match-score">{formatRate(phase.share)}</span>
                  </div>
                  <div className="observability-phase-track">
                    <span
                      className="observability-phase-fill"
                      style={{ width: `${Math.max(4, share * 100)}%` }}
                    />
                  </div>
                  <div className="observability-phase-meta">{formatDuration(phase.durationMs)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ObservabilityFocusCard({
  title,
  values,
  emptyLabel = "None"
}: {
  readonly title: string;
  readonly values: readonly string[];
  readonly emptyLabel?: string;
}): React.JSX.Element {
  return (
    <div className="observability-focus-section">
      <div className="observability-focus-section-head">{title}</div>
      {values.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>{emptyLabel}</p>
      ) : (
        <div className="tag-row">
          {values.map((value) => (
            <span key={value} className="tag-pill">{value}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const QUESTION_PHASE_LABELS: Readonly<Record<string, string>> = { asked: "Asked", answered: "Answered", concluded: "Concluded" };
const TODO_STATE_LABELS: Readonly<Record<string, string>> = { added: "Added", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" };

/** DetailQuestionFlow: question.logged 이벤트를 questionId 기준으로 그룹화해 모든 단계를 표시. */
function DetailQuestionFlow({ group }: { readonly group: QuestionGroup }): React.JSX.Element {
  return (
    <div className="detail-card">
      <div className="detail-card-head">Question Flow</div>
      <div className="detail-card-body">
        <div className="semantic-flow-list">
          {group.phases.map(({ phase, event }) => (
            <div key={event.id} className="semantic-flow-item">
              <span className={`semantic-phase-badge phase-${phase}`}>{QUESTION_PHASE_LABELS[phase] ?? phase}</span>
              <span className="semantic-flow-title">{event.title}</span>
              <span className="match-score">{new Date(event.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
        {!group.isComplete && (
          <p className="muted small" style={{ margin: "8px 0 0" }}>Awaiting conclusion.</p>
        )}
      </div>
    </div>
  );
}

/** DetailTodoFlow: todo.logged 이벤트를 todoId 기준으로 그룹화해 상태 전이 목록을 표시. */
function DetailTodoFlow({ group }: { readonly group: TodoGroup }): React.JSX.Element {
  return (
    <div className="detail-card">
      <div className="detail-card-head">Todo Lifecycle</div>
      <div className="detail-card-body">
        <div className="semantic-flow-list">
          {group.transitions.map(({ state, event }) => (
            <div key={event.id} className="semantic-flow-item">
              <span className={`semantic-state-badge state-${state.replace("_", "-")}`}>{TODO_STATE_LABELS[state] ?? state}</span>
              <span className="semantic-flow-title">{event.title}</span>
              <span className="match-score">{new Date(event.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
        <p className="muted small" style={{ margin: "8px 0 0" }}>
          Current: <strong>{TODO_STATE_LABELS[group.currentState] ?? group.currentState}</strong>
          {group.isTerminal ? " (terminal)" : ""}
        </p>
      </div>
    </div>
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
    <div className="detail-card">
      <div className="detail-card-head">Model</div>
      <div className="detail-card-body">
        <table className="ids-table">
          <tbody>
            <tr>
              <td className="ids-key muted small">Name</td>
              <td className="ids-val mono">{modelName}</td>
            </tr>
            {modelProvider && (
              <tr>
                <td className="ids-key muted small">Provider</td>
                <td className="ids-val mono">{modelProvider}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
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
    <div className="detail-card">
      <div className="detail-card-head">Capture Info</div>
      <div className="detail-card-body">
        <table className="ids-table">
          <tbody>
            {captureMode && <tr><td className="ids-key muted small">Mode</td><td className="ids-val mono">{captureMode}</td></tr>}
            {messageId   && <tr><td className="ids-key muted small">Message ID</td><td className="ids-val mono">{messageId}</td></tr>}
            {source      && <tr><td className="ids-key muted small">Source</td><td className="ids-val mono">{source}</td></tr>}
            {phase       && <tr><td className="ids-key muted small">Phase</td><td className="ids-val mono">{phase}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** DetailTaskModel: 태스크 레벨 AI 모델 요약 카드. 작업 중 모델이 바뀌어도 전체 기록을 표시. */
function DetailTaskModel({ summary }: { readonly summary: ModelSummary }): React.JSX.Element | null {
  const entries = Object.entries(summary.modelCounts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div className="detail-card">
      <div className="detail-card-head">AI Model</div>
      <div className="detail-card-body">
        <table className="ids-table">
          <tbody>
            {entries.map(([name, count]) => (
              <tr key={name}>
                <td className="ids-val mono" style={{ fontWeight: name === summary.defaultModelName ? 600 : undefined }}>
                  {name}
                  {name === summary.defaultModelName && (
                    <span className="muted small" style={{ marginLeft: 6, fontWeight: 400 }}>default</span>
                  )}
                </td>
                <td className="ids-key muted small" style={{ textAlign: "right" }}>{count} events</td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.defaultModelProvider && (
          <p className="muted small" style={{ margin: "6px 0 0" }}>Provider: {summary.defaultModelProvider}</p>
        )}
      </div>
    </div>
  );
}

/** DetailExploredFiles: 탐색된 파일 목록을 접기/펼치기로 표시. */
function DetailExploredFiles({
  files, workspacePath, expanded, onToggle
}: {
  readonly files: readonly ExploredFileStat[];
  readonly workspacePath?: string | undefined;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}): React.JSX.Element {
  return (
    <div className="detail-card">
      <button className="detail-card-toggle" onClick={onToggle} type="button">
        <div>
          <div className="detail-card-toggle-title">Explored Files</div>
          <div className="detail-card-toggle-meta">
            {files.length === 0
              ? "No exploration file paths recorded yet."
              : `${files.length} files · latest ${formatRelativeTime(files[0]?.lastSeenAt ?? new Date().toISOString())}`}
          </div>
        </div>
        <span className="detail-card-toggle-action">{expanded ? "Hide" : "Show"}</span>
      </button>
      {!expanded && files.length > 0 && (
        <div className="detail-card-body compact">
          <div className="explored-preview">
            {files.slice(0, 3).map((file) => (
              <span key={file.path} className="explored-file-pill" title={file.path}>
                {summarizePath(file.path, workspacePath)}
              </span>
            ))}
            {files.length > 3 && (
              <span className="explored-file-pill muted">+{files.length - 3} more</span>
            )}
          </div>
        </div>
      )}
      {expanded && (
        <div className="detail-card-body">
        {files.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No exploration file paths recorded yet.</p>
        ) : (
          <div className="explored-file-list">
            {files.map((file) => (
              <div key={file.path} className="explored-file-item">
                <div className="explored-file-top">
                  <strong className="explored-file-path mono" title={file.path}>
                    {toRelativePath(file.path, workspacePath)}
                  </strong>
                  <span className="match-score">{file.count}x</span>
                </div>
                <div className="explored-file-meta">
                  <span className="muted small">{dirnameLabel(file.path, workspacePath)}</span>
                  <span className="muted small">Last seen {formatRelativeTime(file.lastSeenAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
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
    <div className="detail-card">
      <div className="detail-card-head detail-card-head-with-action">
        <span>Compact Activity</span>
        <button
          className={`compact-focus-button${selectedTag === "compact" ? " active" : ""}`}
          disabled={insight.occurrences === 0 && insight.handoffCount === 0}
          onClick={() => onSelectTag("compact")}
          type="button"
        >
          Focus compact
        </button>
      </div>
      <div className="detail-card-body">
        {insight.occurrences === 0 && insight.handoffCount === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            No compact-related task activity has been recorded yet.
          </p>
        ) : (
          <div className="compact-card-stack">
            <div className="compact-metric-row">
              <div className="compact-metric">
                <span className="compact-metric-label">Compacts</span>
                <strong>{insight.occurrences}</strong>
              </div>
              <div className="compact-metric">
                <span className="compact-metric-label">Handoffs</span>
                <strong>{insight.handoffCount}</strong>
              </div>
              <div className="compact-metric">
                <span className="compact-metric-label">Markers</span>
                <strong>{insight.eventCount}</strong>
              </div>
            </div>
            {insight.tagFacets.length > 0 && (
              <div className="tag-row">
                {insight.tagFacets.map((tag) => (
                  <button
                    key={tag}
                    className={`tag-pill-button${selectedTag === tag ? " active" : ""}`}
                    onClick={() => onSelectTag(tag)}
                    type="button"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            {(insight.latestTitle || insight.latestBody || insight.lastSeenAt) && (
              <div className="compact-latest">
                <div className="compact-latest-head">
                  <strong>{insight.latestTitle ?? "Latest compact signal"}</strong>
                  {insight.lastSeenAt && (
                    <span className="match-score">{formatRelativeTime(insight.lastSeenAt)}</span>
                  )}
                </div>
                {insight.latestBody && (
                  <p className="compact-latest-body">{summarizeDetailText(insight.latestBody, 220)}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** TaskExtractionCard: 태스크 추출 카드. 재사용 가능한 브리프와 마크다운 복사 기능 포함. */
function TaskExtractionCard({
  extraction, workspacePath, copiedState, onCopyBrief, onCopyProcess
}: {
  readonly extraction: TaskExtraction;
  readonly workspacePath?: string | undefined;
  readonly copiedState: "brief" | "process" | null;
  readonly onCopyBrief: () => void;
  readonly onCopyProcess: () => void;
}): React.JSX.Element {
  return (
    <div className="detail-card">
      <div className="detail-card-head detail-card-head-with-action">
        <span>Task Extraction</span>
        <div className="detail-card-head-actions">
          <button className="compact-focus-button" onClick={onCopyBrief} type="button">
            {copiedState === "brief" ? "Copied brief" : "Copy brief"}
          </button>
          <button className="compact-focus-button" onClick={onCopyProcess} type="button">
            {copiedState === "process" ? "Copied process" : "Copy process"}
          </button>
        </div>
      </div>
      <div className="detail-card-body">
        <div className="task-extraction-hero">
          <span className="task-extraction-eyebrow">Reusable Task</span>
          <strong>{extraction.objective}</strong>
          <p>{extraction.summary}</p>
        </div>

        {extraction.sections.length > 0 && (
          <div className="task-extraction-grid">
            {extraction.sections.map((section) => (
              <div key={section.lane} className="task-extraction-section">
                <div className="task-extraction-section-head">
                  <span className={`rule-lane-pill ${section.lane}`}>{section.lane}</span>
                  <strong>{section.title}</strong>
                </div>
                <div className="task-extraction-section-list">
                  {section.items.map((item) => (
                    <p key={`${section.lane}-${item}`}>{item}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="task-extraction-foot">
          {extraction.validations.length > 0 && (
            <div className="task-extraction-meta">
              <span className="task-extraction-meta-label">Validation</span>
              <div className="task-extraction-chip-list">
                {extraction.validations.map((item) => (
                  <span key={item} className="explored-file-pill">{item}</span>
                ))}
              </div>
            </div>
          )}

          {extraction.rules.length > 0 && (
            <div className="task-extraction-meta">
              <span className="task-extraction-meta-label">Rules</span>
              <div className="task-extraction-chip-list">
                {extraction.rules.map((ruleId) => (
                  <span key={ruleId} className="explored-file-pill">{ruleId}</span>
                ))}
              </div>
            </div>
          )}

          {extraction.files.length > 0 && (
            <div className="task-extraction-meta">
              <span className="task-extraction-meta-label">Files</span>
              <div className="task-extraction-chip-list">
                {extraction.files.map((filePath) => (
                  <span key={filePath} className="explored-file-pill" title={filePath}>
                    {summarizePath(filePath, workspacePath)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** RuleCoverageCard: 규칙 커버리지 인사이트 카드. */
function RuleCoverageCard({
  rules, selectedRuleId, showRuleGapsOnly, unmatchedRuleEvents, onSelectRule, onToggleRuleGaps
}: {
  readonly rules: readonly RuleCoverageStat[];
  readonly selectedRuleId: string | null;
  readonly showRuleGapsOnly: boolean;
  readonly unmatchedRuleEvents: number;
  readonly onSelectRule: (ruleId: string) => void;
  readonly onToggleRuleGaps: () => void;
}): React.JSX.Element {
  const configuredRules = rules.filter((rule) => rule.configured);
  const matchedConfiguredRules = configuredRules.filter((rule) => rule.matchCount > 0 || rule.ruleEventCount > 0);
  const runtimeRules = rules.filter((rule) => !rule.configured);

  return (
    <section className="insight-card">
      <div className="insight-head">
        <div>
          <p className="eyebrow">Rules</p>
          <h3>Rule Coverage</h3>
          <p className="muted small">
            {matchedConfiguredRules.length}/{configuredRules.length} configured rules observed
          </p>
        </div>
        <button
          className={`insight-callout${showRuleGapsOnly ? " active warning" : ""}`}
          disabled={unmatchedRuleEvents === 0}
          onClick={onToggleRuleGaps}
          type="button"
        >
          Gap {unmatchedRuleEvents}
        </button>
      </div>
      <div className="insight-summary-row">
        <div className="insight-summary-tile">
          <span className="insight-summary-label">Configured</span>
          <strong>{configuredRules.length}</strong>
        </div>
        <div className="insight-summary-tile">
          <span className="insight-summary-label">Observed</span>
          <strong>{matchedConfiguredRules.length}</strong>
        </div>
        <div className="insight-summary-tile">
          <span className="insight-summary-label">Runtime-only</span>
          <strong>{runtimeRules.length}</strong>
        </div>
      </div>
      <div className="rule-row-list">
        {rules.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No rules loaded yet.</p>
        ) : (
          rules.map((rule) => (
            <button
              key={rule.ruleId}
              className={`rule-row${selectedRuleId === rule.ruleId ? " active" : ""}`}
              onClick={() => onSelectRule(rule.ruleId)}
              type="button"
            >
              <div className="rule-row-head">
                <div className="rule-row-title">
                  <strong>{rule.title}</strong>
                  <span className="rule-row-id mono">{rule.ruleId}</span>
                </div>
                <span className={`rule-state-badge ${rule.configured ? "configured" : "runtime"}`}>
                  {rule.configured ? "configured" : "runtime"}
                </span>
              </div>
              <div className="rule-row-metrics">
                <span className="rule-metric"><strong>{rule.matchCount}</strong>match</span>
                <span className="rule-metric"><strong>{rule.violationCount}</strong>violation</span>
                <span className="rule-metric"><strong>{rule.passCount}</strong>pass</span>
                {rule.lane && <span className="rule-lane-pill">{rule.lane}</span>}
              </div>
              {rule.tags.length > 0 && (
                <div className="rule-row-tags">
                  {rule.tags.slice(0, 4).map((tag) => (
                    <span key={`${rule.ruleId}-${tag}`} className="insight-mini-pill">{tag}</span>
                  ))}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </section>
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
    <section className="insight-card">
      <div className="insight-head">
        <div>
          <p className="eyebrow">Tags</p>
          <h3>Tag Explorer</h3>
          <p className="muted small">{tags.length} distinct tags across the selected task</p>
        </div>
        {selectedTag && (
          <button className="text-button" onClick={() => onSelectTag(selectedTag)} type="button">
            Clear
          </button>
        )}
      </div>
      <div className="tag-chip-grid">
        {tags.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No tags observed yet.</p>
        ) : (
          tags.map((tag) => (
            <button
              key={tag.tag}
              className={`tag-explorer-chip${selectedTag === tag.tag ? " active" : ""}`}
              onClick={() => onSelectTag(tag.tag)}
              type="button"
            >
              <span className="tag-explorer-label mono">{tag.tag}</span>
              <span className="tag-explorer-count">{tag.count}</span>
            </button>
          ))
        )}
      </div>
      <div className="tag-detail-panel">
        {selectedInsight ? (
          <>
            <div className="tag-detail-head">
              <strong className="mono">{selectedInsight.tag}</strong>
              <span className="match-score">{selectedInsight.count} events</span>
            </div>
            <div className="tag-detail-grid">
              <div>
                <div className="insight-summary-label">Lanes</div>
                <div className="tag-detail-text">{selectedInsight.lanes.join(" · ")}</div>
              </div>
              <div>
                <div className="insight-summary-label">Rules</div>
                <div className="tag-detail-text">
                  {selectedInsight.ruleIds.length > 0 ? selectedInsight.ruleIds.join(", ") : "No linked rule"}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>
            Pick a tag chip to focus the timeline and inspect where that signal appears.
          </p>
        )}
      </div>
    </section>
  );
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return copyTextFallback(value);
    }
  }

  return copyTextFallback(value);
}

function copyTextFallback(value: string): boolean {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textArea);
  }
}

function toRelativePath(filePath: string, workspacePath?: string): string {
  if (!workspacePath) {
    return filePath;
  }

  const normalizedWorkspacePath = workspacePath.endsWith("/") ? workspacePath : `${workspacePath}/`;
  return filePath.startsWith(normalizedWorkspacePath)
    ? filePath.slice(normalizedWorkspacePath.length)
    : filePath;
}

function summarizePath(filePath: string, workspacePath?: string): string {
  const relative = toRelativePath(filePath, workspacePath);
  if (relative.length <= 42) {
    return relative;
  }

  const parts = relative.split("/");
  return parts.length > 3 ? parts.slice(-3).join("/") : relative;
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
  overview,
  taskObservability = null,
  selectedEvent,
  selectedConnector,
  selectedEventDisplayTitle,
  selectedTaskBookmark = null,
  selectedEventBookmark = null,
  selectedTag,
  selectedRuleId,
  showRuleGapsOnly,
  taskModelSummary,
  isCollapsed = false,
  onToggleCollapse,
  onCreateTaskBookmark,
  onCreateEventBookmark,
  onSelectTag,
  onSelectRule,
  onToggleRuleGaps
}: EventInspectorProps): React.JSX.Element {
  const [activeTab, setActiveTab]                   = useState<PanelTabId>("inspector");
  const [isExploredFilesExpanded, setIsExploredFilesExpanded] = useState(true);
  const [copiedExtraction, setCopiedExtraction]     = useState<"brief" | "process" | null>(null);
  const inspectorDragScroll = useDragScroll({ axis: "y" });

  const taskTimeline = taskDetail?.timeline ?? [];
  const observability = taskObservability?.observability ?? null;

  const exploredFiles = useMemo(
    () => collectExploredFiles(taskTimeline),
    [taskTimeline]
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
  const ruleCoverage = useMemo(
    () => buildRuleCoverage(overview?.rules, taskTimeline),
    [overview?.rules, taskTimeline]
  );
  const tagInsights = useMemo(
    () => buildTagInsights(taskTimeline),
    [taskTimeline]
  );
  const unmatchedRuleEvents = useMemo(
    () => taskTimeline.filter((event) => eventHasRuleGap(event)).length,
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

  async function handleCopyExtraction(kind: "brief" | "process"): Promise<void> {
    const content = kind === "brief"
      ? taskExtraction.brief
      : taskExtraction.processMarkdown;

    if (!content.trim()) {
      return;
    }

    const copied = await copyToClipboard(content);
    if (copied) {
      setCopiedExtraction(kind);
    }
  }

  const eventTime = selectedEvent
    ? new Date(selectedEvent.createdAt).toLocaleTimeString()
    : null;

  const obsBadges = taskDetail ? [
    { key: "actions",    label: "Actions",    value: observabilityStats.actions,       cls: "actions" },
    { key: "coordination", label: "Coordination", value: observabilityStats.coordinationActivities, cls: "coordination" },
    { key: "files",      label: "Files",      value: observabilityStats.exploredFiles, cls: "files" },
    { key: "compacts",   label: "Compact",    value: observabilityStats.compactions,   cls: "compacts" },
    { key: "checks",     label: "Check",      value: observabilityStats.checks,        cls: "checks" },
    { key: "violations", label: "Violation",  value: observabilityStats.violations,    cls: "violations" },
    { key: "passes",     label: "Pass",       value: observabilityStats.passes,        cls: "passes" },
  ].filter((b) => b.value > 0) : [];

  return (
    <aside className="detail-panel">
      {/* ── Tab bar ── */}
      <div className="panel-tab-bar" aria-label="Inspector panels" role="tablist">
        <button
          aria-label={isCollapsed ? "Expand inspector" : "Collapse inspector"}
          className="inspector-toggle-btn"
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
            className={`panel-tab${activeTab === tab.id ? " active" : ""}`}
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
        className="panel-tab-content"
        role="tabpanel"
        style={{ cursor: inspectorDragScroll.isDragging ? "grabbing" : undefined }}
        {...inspectorDragScroll.handlers}
      >

        {activeTab === "inspector" ? (
          <>
            <div className="inspector-header">
              <h2>
                {selectedConnector
                  ? `${selectedConnector.source.title} → ${selectedConnector.target.title}`
                  : selectedEventDisplayTitle ?? "Select an event"}
              </h2>
              <div className="inspector-header-meta">
                <button className="compact-focus-button" onClick={onCreateTaskBookmark} type="button">
                  {selectedTaskBookmark ? "Task Saved" : "Save Task"}
                </button>
                {selectedEvent && (
                  <button className="compact-focus-button" onClick={onCreateEventBookmark} type="button">
                    {selectedEventBookmark ? "Card Saved" : "Save Card"}
                  </button>
                )}
                {selectedConnector ? (
                  <span className="event-kind-badge">
                    {selectedConnector.connector.isExplicit ? "relation" : "transition"} · {selectedConnector.connector.cross ? "cross-lane" : "same-lane"}
                  </span>
                ) : selectedEvent ? (
                  <span className="event-kind-badge">{selectedEvent.kind} · {selectedEvent.lane}</span>
                ) : null}
                {eventTime && <span className="event-time-badge">{eventTime}</span>}
              </div>
            </div>

            {selectedConnector ? (
              <div className="detail-stack">
                <DetailSection
                  label="Summary"
                  resizable
                  value={[
                    `${selectedConnector.connector.isExplicit ? "Explicit relation" : "Fallback sequence"} from ${selectedConnector.source.lane} to ${selectedConnector.target.lane}.`,
                    selectedConnector.connector.label ? `Label: ${selectedConnector.connector.label}` : undefined,
                    selectedConnector.connector.explanation,
                    `From: ${selectedConnector.source.title}`,
                    `To: ${selectedConnector.target.title}`
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
              <div className="detail-stack">
                <DetailSection
                  label="Summary"
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
              <div className="empty-card">
                <p>No event selected.</p>
                <p className="muted small">
                  As soon as the monitor records activity, the latest item appears here.
                </p>
              </div>
            )}

            {obsBadges.length > 0 && (
              <div className="timeline-badges" style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
                {obsBadges.map((b) => (
                  <span key={b.key} className={`summary-badge ${b.cls}`}>{b.value} {b.label}</span>
                ))}
              </div>
            )}
            {taskModelSummary && (
              <div style={{ padding: "0 16px 12px" }}>
                <DetailTaskModel summary={taskModelSummary} />
              </div>
            )}
          </>

        ) : activeTab === "flow" ? (
          <div className="panel-tab-inner">
            {observability ? (
              <>
                <div className="detail-card">
                  <div className="detail-card-head">Task Flow</div>
                  <div className="detail-card-body">
                    <ObservabilityMetricGrid
                      items={[
                        {
                          label: "Total Duration",
                          value: formatDuration(observability.totalDurationMs),
                          note: observability.runtimeSource ? `source ${observability.runtimeSource}` : undefined,
                          tone: "accent"
                        },
                        {
                          label: "Active Duration",
                          value: formatDuration(observability.activeDurationMs),
                          note: "work in motion",
                          tone: "ok"
                        },
                        {
                          label: "Waiting Duration",
                          value: formatDuration(observability.waitingDurationMs),
                          note: "idle or blocked",
                          tone: "warn"
                        },
                        {
                          label: "Events",
                          value: formatCount(observability.totalEvents),
                          note: "timeline entries"
                        },
                        {
                          label: "Sessions",
                          value: formatCount(observability.sessions.total),
                          note: `${formatCount(observability.sessions.resumed)} resumed · ${formatCount(observability.sessions.open)} open`
                        },
                        {
                          label: "Relation Coverage",
                          value: formatRate(observability.relationCoverageRate),
                          note: `${formatCount(observability.explicitRelationCount)} explicit links`,
                          tone: "accent"
                        }
                      ]}
                    />
                  </div>
                </div>
                <ObservabilityPhaseCard phases={observability.phaseBreakdown} />
                <div className="detail-card">
                  <div className="detail-card-head">Focus</div>
                  <div className="detail-card-body">
                    <div className="observability-focus-stack">
                      <div>
                        <div className="insight-summary-label">Work Items</div>
                        <ObservabilityFocusCard
                          title="Work Items"
                          values={observability.focus.workItemIds}
                          emptyLabel="No work item IDs observed"
                        />
                      </div>
                      <div>
                        <div className="insight-summary-label">Goals</div>
                        <ObservabilityFocusCard
                          title="Goals"
                          values={observability.focus.goalIds}
                          emptyLabel="No goal IDs observed"
                        />
                      </div>
                      <div>
                        <div className="insight-summary-label">Plans</div>
                        <ObservabilityFocusCard
                          title="Plans"
                          values={observability.focus.planIds}
                          emptyLabel="No plan IDs observed"
                        />
                      </div>
                      <div>
                        <div className="insight-summary-label">Handoffs</div>
                        <ObservabilityFocusCard
                          title="Handoffs"
                          values={observability.focus.handoffIds}
                          emptyLabel="No handoff IDs observed"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <ObservabilityListCard
                  title="Top Files"
                  items={observability.focus.topFiles.map((file) => ({
                    label: file.path,
                    value: `${formatCount(file.count)}x`
                  }))}
                  emptyLabel="No file focus recorded yet."
                />
                <ObservabilityListCard
                  title="Top Tags"
                  items={observability.focus.topTags.map((tag) => ({
                    label: tag.tag,
                    value: `${formatCount(tag.count)}x`
                  }))}
                  emptyLabel="No focus tags recorded yet."
                />
              </>
            ) : (
              <div className="empty-card">
                <p>No task flow observability is available yet.</p>
                <p className="muted small">Select a task after the server starts exposing `/api/tasks/:taskId/observability`.</p>
              </div>
            )}
          </div>

        ) : activeTab === "health" ? (
          <div className="panel-tab-inner">
            {observability ? (
              <>
                <div className="detail-card">
                  <div className="detail-card-head">Health Overview</div>
                  <div className="detail-card-body">
                    <ObservabilityMetricGrid
                      items={[
                        {
                          label: "Explicit Relations",
                          value: formatCount(observability.explicitRelationCount),
                          note: `${formatRate(observability.relationCoverageRate)} coverage`,
                          tone: "accent"
                        },
                        {
                          label: "Rule Gaps",
                          value: formatCount(observability.ruleGapCount),
                          note: "unmatched events",
                          tone: observability.ruleGapCount > 0 ? "warn" : "ok"
                        },
                        {
                          label: "Questions",
                          value: formatCount(observability.signals.questionsAsked),
                          note: `${formatCount(observability.signals.questionsClosed)} closed`
                        },
                        {
                          label: "Todos",
                          value: formatCount(observability.signals.todosAdded),
                          note: `${formatCount(observability.signals.todosCompleted)} completed`
                        },
                        {
                          label: "Sessions",
                          value: formatCount(observability.sessions.total),
                          note: `${formatCount(observability.sessions.open)} open · ${formatCount(observability.sessions.resumed)} resumed`
                        },
                        {
                          label: "Runtime Source",
                          value: observability.runtimeSource ?? "unknown",
                          note: "task lineage",
                          tone: "muted"
                        }
                      ]}
                    />
                  </div>
                </div>
                <div className="detail-card">
                  <div className="detail-card-head">Signals</div>
                  <div className="detail-card-body">
                    <ObservabilityMetricGrid
                      items={[
                        { label: "Raw Prompts", value: formatCount(observability.signals.rawUserMessages), note: "captured user turns" },
                        { label: "Follow-ups", value: formatCount(observability.signals.followUpMessages), note: "additional turns" },
                        { label: "Thoughts", value: formatCount(observability.signals.thoughts), note: "planning snapshots" },
                        { label: "Tool Calls", value: formatCount(observability.signals.toolCalls), note: "tool executions" },
                        { label: "Terminal Commands", value: formatCount(observability.signals.terminalCommands), note: "shell activity" },
                        { label: "Verifications", value: formatCount(observability.signals.verifications), note: "tests and checks" },
                        { label: "Rule Violations", value: formatCount(observability.signals.ruleViolations), note: "rule gaps or violations", tone: observability.signals.ruleViolations > 0 ? "warn" : "ok" },
                        { label: "Coordination", value: formatCount(observability.signals.coordinationActivities), note: "MCP / delegation" },
                        { label: "Background", value: formatCount(observability.signals.backgroundTransitions), note: "subagent transitions" },
                        { label: "Explored Files", value: formatCount(observability.signals.exploredFiles), note: "read paths" }
                      ]}
                    />
                  </div>
                </div>
                <ObservabilityListCard
                  title="Rule / Flow Health"
                  items={[
                    {
                      label: "Relation coverage",
                      value: formatRate(observability.relationCoverageRate),
                      note: `${formatCount(observability.explicitRelationCount)} explicit connections recorded`
                    },
                    {
                      label: "Rule gap pressure",
                      value: formatCount(observability.ruleGapCount),
                      note: observability.ruleGapCount > 0
                        ? "Some events still have no configured rule match"
                        : "No rule gaps on the selected task"
                    },
                    {
                      label: "Active sessions",
                      value: formatCount(observability.sessions.open),
                      note: `${formatCount(observability.sessions.total)} total sessions`
                    }
                  ]}
                />
              </>
            ) : (
              <div className="empty-card">
                <p>No task health observability is available yet.</p>
                <p className="muted small">Health cards will appear once the server returns task-level diagnostics.</p>
              </div>
            )}
          </div>

        ) : activeTab === "rules" ? (
          <div className="panel-tab-inner">
            <RuleCoverageCard
              rules={ruleCoverage}
              selectedRuleId={selectedRuleId}
              showRuleGapsOnly={showRuleGapsOnly}
              unmatchedRuleEvents={unmatchedRuleEvents}
              onSelectRule={(ruleId) => {
                onSelectRule(selectedRuleId === ruleId ? null : ruleId);
              }}
              onToggleRuleGaps={onToggleRuleGaps}
            />
          </div>

        ) : activeTab === "tags" ? (
          <div className="panel-tab-inner">
            <TagExplorerCard
              tags={tagInsights}
              selectedTag={selectedTag}
              onSelectTag={(tag) => onSelectTag(selectedTag === tag ? null : tag)}
            />
          </div>

        ) : activeTab === "task" ? (
          <div className="panel-tab-inner">
            <TaskExtractionCard
              extraction={taskExtraction}
              workspacePath={taskDetail?.task.workspacePath}
              copiedState={copiedExtraction}
              onCopyBrief={() => void handleCopyExtraction("brief")}
              onCopyProcess={() => void handleCopyExtraction("process")}
            />
          </div>

        ) : activeTab === "compact" ? (
          <div className="panel-tab-inner">
            <CompactActivityCard
              insight={compactInsight}
              selectedTag={selectedTag}
              onSelectTag={(tag) => onSelectTag(selectedTag === tag ? null : tag)}
            />
          </div>

        ) : (
          <div className="panel-tab-inner">
            <DetailExploredFiles
              files={exploredFiles}
              workspacePath={taskDetail?.task.workspacePath}
              expanded={isExploredFilesExpanded}
              onToggle={() => setIsExploredFilesExpanded((current) => !current)}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
