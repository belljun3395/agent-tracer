import { useMemo, useState } from "react";
import type {
  TimelineEventRecord,
  TaskId,
} from "~domain/monitoring.js";
import { useTaskRulesQuery } from "~state/server/queries.js";
import { useNowMs } from "~state/ui/useNowMs.js";
import { buildFileActivity } from "~features/inspector/lib/file-activity.js";
import { countRuleMatches } from "~features/inspector/tabs/rules/lib/rule-matches.js";
import { formatRelativeShort } from "~lib/time.js";
import {
  buildSearchActivity,
  type SearchActivityRow,
  type SearchKind,
} from "./lib/extract-search-activity.js";
import { buildToolUsage } from "./lib/extract-tool-usage.js";

interface OverviewViewProps {
  readonly taskId: TaskId;
  readonly timeline: readonly TimelineEventRecord[];
}

const FILE_LIMIT = 30;
const SEARCH_LIMIT = 20;
const TOOL_LIMIT = 12;

const SEARCH_KIND_LABEL: Readonly<Record<SearchKind, string>> = {
  grep: "grep",
  glob: "glob",
  list: "list",
  web: "web",
  shell: "shell",
};

/**
 * Task-scoped roll-up. Per-event Inspector views answer "what just happened",
 * Overview answers "what did this task as a whole do":
 *
 *   1. Files     — every path the agent read/wrote/mentioned
 *   2. Searches  — every grep/glob/web query, deduped + counted
 *   3. Tools     — subtype frequency leaderboard
 *   4. Rules     — fired vs dormant, with counts
 *
 * Each section is independent; if the task hasn't done that thing yet,
 * the section unmounts entirely (no empty placeholders).
 */
export function OverviewView({ taskId, timeline }: OverviewViewProps) {
  const nowMs = useNowMs(15_000);
  const rulesQ = useTaskRulesQuery(taskId);

  const files = useMemo(() => buildFileActivity(timeline), [timeline]);
  const searches = useMemo(() => buildSearchActivity(timeline), [timeline]);
  const tools = useMemo(() => buildToolUsage(timeline), [timeline]);
  const ruleCounts = useMemo(() => countRuleMatches(timeline), [timeline]);

  const allRules = useMemo(() => {
    const data = rulesQ.data;
    if (!data) return [];
    return [...data.task, ...data.global];
  }, [rulesQ.data]);

  const empty =
    files.length === 0 &&
    searches.length === 0 &&
    tools.length === 0 &&
    allRules.length === 0;

  if (empty) {
    return (
      <div className="px-9 py-10">
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "var(--ink-subtle)",
            textAlign: "center",
          }}
        >
          Nothing to summarise yet — the task hasn't produced typed events.
        </p>
      </div>
    );
  }

  return (
    <div
      className="px-9 pb-12 pt-2 grid"
      style={{
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 24,
      }}
    >
      <FilesCard rows={files} nowMs={nowMs} />
      <SearchesCard rows={searches} nowMs={nowMs} />
      <ToolsCard rows={tools} totalEvents={timeline.length} />
      <RulesCard
        rules={allRules}
        counts={ruleCounts}
        loading={rulesQ.isLoading}
      />
    </div>
  );
}

interface FilesCardProps {
  readonly rows: ReturnType<typeof buildFileActivity>;
  readonly nowMs: number;
}

function FilesCard({ rows, nowMs }: FilesCardProps) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;
  const visible = expanded ? rows : rows.slice(0, FILE_LIMIT);
  const hidden = rows.length - visible.length;
  return (
    <Card title="Files" count={rows.length}>
      <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
        {visible.map((row) => (
          <li key={row.path} className="flex items-center gap-2">
            <span
              className="flex-1 min-w-0 truncate"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--ink)",
              }}
              title={row.path}
            >
              {row.path}
            </span>
            <span
              className="shrink-0"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--ink-tertiary)",
              }}
            >
              {[
                row.writeCount > 0 ? `${row.writeCount}w` : null,
                row.readCount > 0 ? `${row.readCount}r` : null,
                row.mentionCount > 0 ? `${row.mentionCount}m` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span
              className="shrink-0"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--ink-tertiary)",
                minWidth: 36,
                textAlign: "right",
              }}
            >
              {formatRelativeShort(row.lastSeenAtMs, nowMs)}
            </span>
          </li>
        ))}
      </ul>
      <Toggle
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        hiddenCount={hidden}
        totalCount={rows.length}
        hiddenSuffix="older paths"
      />
    </Card>
  );
}

interface SearchesCardProps {
  readonly rows: readonly SearchActivityRow[];
  readonly nowMs: number;
}

function SearchesCard({ rows, nowMs }: SearchesCardProps) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;
  const visible = expanded ? rows : rows.slice(0, SEARCH_LIMIT);
  const hidden = rows.length - visible.length;
  return (
    <Card title="Searches" count={rows.length}>
      <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
        {visible.map((row, idx) => (
          <li key={`${row.kind}-${row.query}-${idx}`} className="flex items-center gap-2">
            <KindChip kind={row.kind} />
            <span
              className="flex-1 min-w-0 truncate"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--ink)",
              }}
              title={row.query}
            >
              {row.query}
            </span>
            {row.count > 1 && (
              <span
                className="shrink-0"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--ink-tertiary)",
                }}
              >
                ×{row.count}
              </span>
            )}
            <span
              className="shrink-0"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--ink-tertiary)",
                minWidth: 36,
                textAlign: "right",
              }}
            >
              {formatRelativeShort(row.lastSeenAtMs, nowMs)}
            </span>
          </li>
        ))}
      </ul>
      <Toggle
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        hiddenCount={hidden}
        totalCount={rows.length}
        hiddenSuffix="older queries"
      />
    </Card>
  );
}

function KindChip({ kind }: { kind: SearchKind }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--ink-muted)",
        background: "var(--s2)",
        borderRadius: 2,
        minWidth: 36,
        textAlign: "center",
      }}
    >
      {SEARCH_KIND_LABEL[kind]}
    </span>
  );
}

interface ToolsCardProps {
  readonly rows: ReturnType<typeof buildToolUsage>;
  readonly totalEvents: number;
}

function ToolsCard({ rows, totalEvents }: ToolsCardProps) {
  if (rows.length === 0) return null;
  const visible = rows.slice(0, TOOL_LIMIT);
  const max = visible[0]?.count ?? 1;
  return (
    <Card title="Tools used" count={rows.length}>
      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {visible.map((row) => {
          const fillPct = (row.count / max) * 100;
          const sharePct = totalEvents > 0 ? (row.count / totalEvents) * 100 : 0;
          return (
            <li key={row.subtype} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className="flex-1 min-w-0 truncate"
                  style={{ fontSize: 11.5, color: "var(--ink)" }}
                >
                  {row.label}
                </span>
                <span
                  className="shrink-0"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--ink-tertiary)",
                  }}
                >
                  {row.count} · {sharePct.toFixed(0)}%
                </span>
              </div>
              <div
                style={{
                  height: 3,
                  background: "var(--s2)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${fillPct}%`,
                    height: "100%",
                    background: "var(--primary)",
                    opacity: 0.6,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

interface RulesCardProps {
  readonly rules: readonly { readonly id: string; readonly name: string; readonly severity: string }[];
  readonly counts: Readonly<Record<string, number>>;
  readonly loading: boolean;
}

function RulesCard({ rules, counts, loading }: RulesCardProps) {
  if (loading) {
    return (
      <Card title="Rules" count={0}>
        <p style={mutedHint}>Loading…</p>
      </Card>
    );
  }
  if (rules.length === 0) return null;
  const fired = rules.filter((r) => (counts[r.id] ?? 0) > 0);
  const dormant = rules.filter((r) => (counts[r.id] ?? 0) === 0);
  return (
    <Card title="Rules" count={rules.length}>
      <div
        style={{
          display: "flex",
          gap: 12,
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--ink-tertiary)",
          marginBottom: 8,
        }}
      >
        <span>fired · {fired.length}</span>
        <span>dormant · {dormant.length}</span>
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
        {fired.map((rule) => (
          <li key={rule.id} className="flex items-center gap-2">
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  rule.severity === "block"
                    ? "var(--err)"
                    : rule.severity === "warn"
                      ? "var(--warn)"
                      : "var(--ink-tertiary)",
                flexShrink: 0,
              }}
            />
            <span
              className="flex-1 min-w-0 truncate"
              style={{ fontSize: 11.5, color: "var(--ink)" }}
              title={rule.name}
            >
              {rule.name}
            </span>
            <span
              className="shrink-0"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--primary-hover)",
              }}
            >
              {counts[rule.id]} match{(counts[rule.id] ?? 0) === 1 ? "" : "es"}
            </span>
          </li>
        ))}
        {fired.length === 0 && <li style={mutedHint}>No rule fired on this task.</li>}
      </ul>
    </Card>
  );
}

function Card({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--s1)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius-md)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <header className="flex items-center gap-2">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--ink-tertiary)",
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>{count}</span>
      </header>
      {children}
    </section>
  );
}

interface ToggleProps {
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly hiddenCount: number;
  readonly totalCount: number;
  readonly hiddenSuffix: string;
}

/**
 * Footer pill that doubles as a "+N more"/"Show less" toggle. Only
 * rendered when there's something to expand or collapse — when the
 * full list already fits, it returns null and the card stays compact.
 */
function Toggle({
  expanded,
  onToggle,
  hiddenCount,
  totalCount,
  hiddenSuffix,
}: ToggleProps) {
  // Nothing to toggle — every row is already on screen and the list
  // fits in one shot. Keeps the card from growing a useless button.
  if (!expanded && hiddenCount === 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      style={{
        alignSelf: "flex-start",
        marginTop: 6,
        padding: "3px 8px",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: "var(--ink-muted)",
        background: "var(--s2)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius-xs)",
        cursor: "pointer",
      }}
    >
      {expanded
        ? `Show less (${totalCount} → top results)`
        : `+${hiddenCount} ${hiddenSuffix} — show all`}
    </button>
  );
}

const mutedHint: React.CSSProperties = {
  margin: 0,
  fontSize: 11.5,
  color: "var(--ink-subtle)",
};
