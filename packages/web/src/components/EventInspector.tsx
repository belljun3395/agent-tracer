/**
 * 이벤트 상세 정보 패널 (오른쪽 inspector 영역).
 * 분류 결과, 메타데이터, 파일 경로 등 전체 이벤트 데이터 표시.
 * 이벤트 선택 및 커넥터 선택 두 모드를 지원하며 지원 패널(규칙/태그/태스크/compact/파일)을 포함.
 */

import type React from "react";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from "react";

import {
  buildCompactInsight,
  buildObservabilityStats,
  buildRuleCoverage,
  buildTagInsights,
  buildTaskExtraction,
  collectExploredFiles,
  eventHasRuleGap,
  type CompactInsight,
  type ExploredFileStat,
  type RuleCoverageStat,
  type TaskExtraction,
  type TagInsight
} from "../lib/insights.js";
import { formatRelativeTime } from "../lib/timeline.js";
import type { TimelineConnector } from "../lib/timeline.js";
import type {
  OverviewResponse,
  TaskDetailResponse,
  TimelineEvent
} from "../types.js";

type DetailTabId = "rules" | "tags" | "task" | "compact" | "files";
const DETAIL_PRIMARY_MIN = 260;
const DETAIL_SECONDARY_MIN = 232;
const DETAIL_RESIZER_SIZE = 18;
const DETAIL_SPLIT_DEFAULT = 0.62;
const DETAIL_SPLIT_STEP = 0.04;

function getDetailAvailableHeight(panelHeight: number): number {
  return Math.max(panelHeight - DETAIL_RESIZER_SIZE, 1);
}

function clampDetailSplit(value: number, availableHeight: number): number {
  if (availableHeight <= 0) {
    return DETAIL_SPLIT_DEFAULT;
  }

  const minPrimaryRatio = DETAIL_PRIMARY_MIN / availableHeight;
  const maxPrimaryRatio = 1 - DETAIL_SECONDARY_MIN / availableHeight;

  if (minPrimaryRatio >= maxPrimaryRatio) {
    return 0.5;
  }

  return Math.min(maxPrimaryRatio, Math.max(minPrimaryRatio, value));
}

interface SelectedConnectorData {
  readonly connector: TimelineConnector;
  readonly source: TimelineEvent;
  readonly target: TimelineEvent;
}

interface EventInspectorProps {
  readonly taskDetail: TaskDetailResponse | null;
  readonly overview: OverviewResponse | null;
  readonly selectedEvent: TimelineEvent | null;
  readonly selectedConnector: SelectedConnectorData | null;
  readonly selectedEventDisplayTitle: string | null;
  readonly selectedTag: string | null;
  readonly selectedRuleId: string | null;
  readonly showRuleGapsOnly: boolean;
  readonly onSelectTag: (tag: string | null) => void;
  readonly onSelectRule: (ruleId: string | null) => void;
  readonly onToggleRuleGaps: () => void;
}

/** DetailSection: 라벨과 내용을 가진 inspector 카드. */
function DetailSection({
  label, mono = false, value
}: {
  readonly label: string;
  readonly mono?: boolean;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="detail-card">
      <div className="detail-card-head">{label}</div>
      <div className="detail-card-body">
        <pre className={`detail-value${mono ? " mono" : ""}`}>{value}</pre>
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
  selectedEvent,
  selectedConnector,
  selectedEventDisplayTitle,
  selectedTag,
  selectedRuleId,
  showRuleGapsOnly,
  onSelectTag,
  onSelectRule,
  onToggleRuleGaps
}: EventInspectorProps): React.JSX.Element {
  const [detailSplit, setDetailSplit] = useState(DETAIL_SPLIT_DEFAULT);
  const [detailPanelHeight, setDetailPanelHeight] = useState(0);
  const [isDetailResizing, setIsDetailResizing] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTabId>("rules");
  const [isExploredFilesExpanded, setIsExploredFilesExpanded] = useState(true);
  const [copiedExtraction, setCopiedExtraction] = useState<"brief" | "process" | null>(null);

  const detailPanelRef = useRef<HTMLElement | null>(null);
  const detailResizeState = useRef<{
    readonly pointerId: number;
    readonly panelTop: number;
    readonly availableHeight: number;
  } | null>(null);

  const taskTimeline = taskDetail?.timeline ?? [];

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

  const detailPanelTemplateRows = useMemo(() => {
    if (detailPanelHeight <= 0) {
      const primaryRatio = Math.max(detailSplit, 0.001).toFixed(3);
      const secondaryRatio = Math.max(1 - detailSplit, 0.001).toFixed(3);

      return `minmax(${DETAIL_PRIMARY_MIN}px, ${primaryRatio}fr) ${DETAIL_RESIZER_SIZE}px minmax(${DETAIL_SECONDARY_MIN}px, ${secondaryRatio}fr)`;
    }

    const availableHeight = getDetailAvailableHeight(detailPanelHeight);
    const clampedSplit = clampDetailSplit(detailSplit, availableHeight);
    const minPrimary = Math.min(DETAIL_PRIMARY_MIN, availableHeight);
    const minSecondary = Math.min(DETAIL_SECONDARY_MIN, Math.max(availableHeight - minPrimary, 0));
    const maxPrimary = Math.max(availableHeight - minSecondary, 0);
    const primaryHeight = Math.min(maxPrimary, Math.max(minPrimary, Math.round(availableHeight * clampedSplit)));
    const secondaryHeight = Math.max(availableHeight - primaryHeight, 0);

    return `${primaryHeight}px ${DETAIL_RESIZER_SIZE}px ${secondaryHeight}px`;
  }, [detailPanelHeight, detailSplit]);

  useLayoutEffect(() => {
    const panel = detailPanelRef.current;
    if (!panel) {
      return;
    }

    const syncDetailPanelSizing = (): void => {
      const nextHeight = panel.clientHeight;
      setDetailPanelHeight((current) => current === nextHeight ? current : nextHeight);
      const availableHeight = getDetailAvailableHeight(nextHeight);
      setDetailSplit((current) => clampDetailSplit(current, availableHeight));
    };

    syncDetailPanelSizing();

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => syncDetailPanelSizing());

    observer?.observe(panel);
    window.addEventListener("resize", syncDetailPanelSizing);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncDetailPanelSizing);
    };
  }, []);

  // Reset tab when task changes
  const prevTaskIdRef = useRef<string | null>(null);
  if (taskDetail?.task.id !== prevTaskIdRef.current) {
    prevTaskIdRef.current = taskDetail?.task.id ?? null;
    // We need to reset state outside render - handled in App.tsx via key prop or useEffect
  }

  function resetDetailSplit(): void {
    const panelHeight = detailPanelRef.current?.clientHeight ?? 0;
    const availableHeight = getDetailAvailableHeight(panelHeight);
    setDetailSplit(clampDetailSplit(DETAIL_SPLIT_DEFAULT, availableHeight));
  }

  function updateDetailSplitFromPointer(clientY: number, panelTop: number, availableHeight: number): void {
    const nextRatio = clampDetailSplit(
      (clientY - panelTop - DETAIL_RESIZER_SIZE / 2) / availableHeight,
      availableHeight
    );
    setDetailSplit(nextRatio);
  }

  function handleDetailResizeStart(event: ReactPointerEvent<HTMLDivElement>): void {
    const panel = detailPanelRef.current;
    if (!panel) {
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const availableHeight = getDetailAvailableHeight(panelRect.height);

    detailResizeState.current = {
      pointerId: event.pointerId,
      panelTop: panelRect.top,
      availableHeight
    };

    updateDetailSplitFromPointer(event.clientY, panelRect.top, availableHeight);
    setIsDetailResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleDetailResizeMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const current = detailResizeState.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }

    updateDetailSplitFromPointer(event.clientY, current.panelTop, current.availableHeight);
  }

  function handleDetailResizeEnd(event: ReactPointerEvent<HTMLDivElement>): void {
    if (detailResizeState.current?.pointerId !== event.pointerId) {
      return;
    }

    detailResizeState.current = null;
    setIsDetailResizing(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleDetailResizeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const panelHeight = detailPanelRef.current?.clientHeight ?? 0;
    const availableHeight = getDetailAvailableHeight(panelHeight);
    let nextRatio: number | null = null;

    switch (event.key) {
      case "ArrowUp":
        nextRatio = detailSplit - DETAIL_SPLIT_STEP;
        break;
      case "ArrowDown":
        nextRatio = detailSplit + DETAIL_SPLIT_STEP;
        break;
      case "Home":
        nextRatio = DETAIL_PRIMARY_MIN / availableHeight;
        break;
      case "End":
        nextRatio = 1 - DETAIL_SECONDARY_MIN / availableHeight;
        break;
      case "Enter":
      case " ":
        nextRatio = DETAIL_SPLIT_DEFAULT;
        break;
      default:
        return;
    }

    event.preventDefault();
    setDetailSplit(clampDetailSplit(nextRatio, availableHeight));
  }

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

  return (
    <aside
      className={`detail-panel${isDetailResizing ? " is-resizing" : ""}`}
      ref={detailPanelRef}
      style={{ gridTemplateRows: detailPanelTemplateRows }}
    >
      <section className="detail-primary" id="detail-primary">
        <div className="inspector-header">
          <p className="eyebrow">Inspector</p>
          <h2>{selectedConnector ? `${selectedConnector.source.title} -> ${selectedConnector.target.title}` : selectedEventDisplayTitle ?? "Select an event"}</h2>
          {selectedConnector ? (
            <span className="event-kind-badge">transition · {selectedConnector.connector.cross ? "cross-lane" : "same-lane"}</span>
          ) : selectedEvent ? (
            <span className="event-kind-badge">{selectedEvent.kind} · {selectedEvent.lane}</span>
          ) : (
            <p className="muted small" style={{ margin: "4px 0 0" }}>
              Choose a timeline node to inspect metadata.
            </p>
          )}
        </div>

        {selectedConnector ? (
          <div className="detail-stack">
            <DetailSection
              label="Summary"
              value={[
                `${selectedConnector.connector.cross ? "Lane transition" : "Same-lane progression"} from ${selectedConnector.source.lane} to ${selectedConnector.target.lane}.`,
                `From: ${selectedConnector.source.title}`,
                `To: ${selectedConnector.target.title}`
              ].join("\n")}
            />
            <DetailConnectorIds connector={selectedConnector.connector} source={selectedConnector.source} target={selectedConnector.target} />
            <DetailTags
              title="Transition Tags"
              values={[
                selectedConnector.connector.cross ? "cross-lane" : "same-lane",
                selectedConnector.source.lane,
                selectedConnector.target.lane
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
                targetLane: selectedConnector.target.lane
              }, null, 2)}
            />
          </div>
        ) : selectedEvent ? (
          <div className="detail-stack">
            <DetailSection
              label="Summary"
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

        {/* observability badges */}
        {taskDetail && (
          <div className="timeline-badges" style={{ padding: "8px 16px", borderTop: "1px solid var(--border)" }}>
            <span className="summary-badge actions">{observabilityStats.actions} Actions</span>
            <span className="summary-badge files">{observabilityStats.exploredFiles} Files</span>
            <span className="summary-badge compacts">{observabilityStats.compactions} Compact</span>
            <span className="summary-badge checks">{observabilityStats.checks} Check</span>
            <span className="summary-badge violations">{observabilityStats.violations} Violation</span>
            <span className="summary-badge passes">{observabilityStats.passes} Pass</span>
          </div>
        )}
      </section>

      <div
        aria-controls="detail-primary detail-secondary"
        aria-label="Resize inspector and support panels"
        aria-orientation="horizontal"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(detailSplit * 100)}
        aria-valuetext={`Inspector ${Math.round(detailSplit * 100)} percent`}
        className={`detail-resizer${isDetailResizing ? " active" : ""}`}
        onDoubleClick={resetDetailSplit}
        onKeyDown={handleDetailResizeKeyDown}
        onLostPointerCapture={() => {
          detailResizeState.current = null;
          setIsDetailResizing(false);
        }}
        onPointerCancel={handleDetailResizeEnd}
        onPointerDown={handleDetailResizeStart}
        onPointerMove={handleDetailResizeMove}
        onPointerUp={handleDetailResizeEnd}
        role="separator"
        tabIndex={0}
        title="Drag to resize. Double click to reset."
      >
        <span className="detail-resizer-line" />
      </div>

      <section className="detail-secondary" id="detail-secondary">
        <div className="detail-secondary-header">
          <p className="eyebrow">Support Panels</p>
          <p className="muted small">Rules, tags, extraction, compact summaries, and explored files stay here so the inspector remains front and center.</p>
        </div>
        <div className="detail-tab-row" aria-label="Inspector support panels" role="tablist">
          {([
            { id: "rules", label: "Rules" },
            { id: "tags", label: "Tags" },
            { id: "task", label: "Task" },
            { id: "compact", label: "Compact" },
            { id: "files", label: "Files" }
          ] as const).map((tab) => (
            <button
              key={tab.id}
              aria-selected={detailTab === tab.id}
              className={`detail-tab-button${detailTab === tab.id ? " active" : ""}`}
              onClick={() => setDetailTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="detail-secondary-body" role="tabpanel">
          {detailTab === "rules" ? (
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
          ) : detailTab === "tags" ? (
            <TagExplorerCard
              tags={tagInsights}
              selectedTag={selectedTag}
              onSelectTag={(tag) => onSelectTag(selectedTag === tag ? null : tag)}
            />
          ) : detailTab === "task" ? (
            <TaskExtractionCard
              extraction={taskExtraction}
              workspacePath={taskDetail?.task.workspacePath}
              copiedState={copiedExtraction}
              onCopyBrief={() => void handleCopyExtraction("brief")}
              onCopyProcess={() => void handleCopyExtraction("process")}
            />
          ) : detailTab === "compact" ? (
            <CompactActivityCard
              insight={compactInsight}
              selectedTag={selectedTag}
              onSelectTag={(tag) => onSelectTag(selectedTag === tag ? null : tag)}
            />
          ) : (
            <DetailExploredFiles
              files={exploredFiles}
              workspacePath={taskDetail?.task.workspacePath}
              expanded={isExploredFilesExpanded}
              onToggle={() => setIsExploredFilesExpanded((current) => !current)}
            />
          )}
        </div>
      </section>
    </aside>
  );
}
