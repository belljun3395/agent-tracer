import { useMemo, useState } from "react";
import type {
  Recipe,
  RecipeCandidate,
  RecipeScanEnqueueInput,
} from "~io/api.js";
import {
  useAcceptRecipeCandidateMutation,
  useDismissRecipeCandidateMutation,
  useEnqueueRecipeScanMutation,
  useRetireRecipeMutation,
} from "~state/server/mutations.js";
import {
  useLatestRecipeScanJobQuery,
  useRecipeCandidatesQuery,
  useRecipesQuery,
  useTasksQuery,
} from "~state/server/queries.js";

type SectionTab = "candidates" | "active" | "archive";

/**
 * `/recipes` — distilled patterns extracted from completed tasks. A
 * candidate is what the LLM proposed; the user accepts to promote it to
 * an active recipe. Active recipes will (in P3) be injected into future
 * UserPromptSubmit hooks as additionalContext.
 */
export function RecipesPage() {
  const [tab, setTab] = useState<SectionTab>("candidates");
  const job = useLatestRecipeScanJobQuery();
  const candidates = useRecipeCandidatesQuery("pending");
  const active = useRecipesQuery("active");
  const archive = useRecipesQuery("all");
  const tasksQ = useTasksQuery("all");
  const enqueue = useEnqueueRecipeScanMutation();

  const taskTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasksQ.data?.tasks ?? []) {
      m.set(t.id, t.displayTitle ?? t.title);
    }
    return m;
  }, [tasksQ.data]);

  const isScanning =
    job.data?.job?.status === "pending" ||
    job.data?.job?.status === "processing";

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--canvas)",
      }}
    >
      <PageHeader
        isScanning={isScanning || enqueue.isPending}
        latestJob={job.data?.job ?? null}
        onScan={(input) => enqueue.mutate(input)}
        scanError={
          enqueue.isError ? readErrorMessage(enqueue.error) : null
        }
      />
      <Tabs
        active={tab}
        onSelect={setTab}
        counts={{
          candidates: candidates.data?.candidates.length ?? 0,
          active: active.data?.recipes.length ?? 0,
          archive:
            (archive.data?.recipes.filter((r) => r.status !== "active")
              .length) ?? 0,
        }}
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "12px 24px 24px",
        }}
      >
        {tab === "candidates" && (
          <CandidatesList
            rows={candidates.data?.candidates ?? []}
            loading={candidates.isLoading}
            taskTitleById={taskTitleById}
          />
        )}
        {tab === "active" && (
          <ActiveRecipesList
            rows={active.data?.recipes ?? []}
            loading={active.isLoading}
            taskTitleById={taskTitleById}
          />
        )}
        {tab === "archive" && (
          <ArchivedRecipesList
            rows={
              (archive.data?.recipes ?? []).filter(
                (r) => r.status !== "active",
              )
            }
            loading={archive.isLoading}
            taskTitleById={taskTitleById}
          />
        )}
      </div>
    </div>
  );
}

interface PageHeaderProps {
  readonly isScanning: boolean;
  readonly latestJob:
    | {
        readonly status: string;
        readonly candidatesCreated: number;
        readonly tasksScanned: number;
        readonly completedAt: string | null;
        readonly error: string | null;
      }
    | null;
  readonly onScan: (input: RecipeScanEnqueueInput) => void;
  readonly scanError: string | null;
}

function PageHeader({
  isScanning,
  latestJob,
  onScan,
  scanError,
}: PageHeaderProps) {
  const [statusFilter, setStatusFilter] = useState<
    "completed" | "active" | "all"
  >("completed");
  const [maxCandidates, setMaxCandidates] = useState(10);
  const [minEventCount, setMinEventCount] = useState(1);

  const failureMessage =
    scanError ?? (latestJob?.status === "failed" ? latestJob.error : null);

  return (
    <div
      style={{
        padding: "16px 24px 12px",
        borderBottom: "1px solid var(--hair)",
        background: "var(--canvas)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>
            Recipes
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-muted)",
              marginTop: 4,
              maxWidth: 720,
            }}
          >
            Reusable patterns the LLM distilled from your completed tasks.
            Each candidate needs your review before it becomes an active
            recipe that future agents can draw on.
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Status</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "completed" | "active" | "all",
              )
            }
            style={inputStyle}
            disabled={isScanning}
          >
            <option value="completed">Completed</option>
            <option value="active">Active (running/waiting)</option>
            <option value="all">All</option>
          </select>
        </label>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Max candidates</span>
          <input
            type="number"
            min={1}
            max={30}
            value={maxCandidates}
            onChange={(e) =>
              setMaxCandidates(
                Math.max(1, Math.min(30, Number(e.target.value) || 1)),
              )
            }
            style={{ ...inputStyle, width: 64 }}
            disabled={isScanning}
          />
        </label>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Min events</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={minEventCount}
            onChange={(e) =>
              setMinEventCount(
                Math.max(1, Math.min(1000, Number(e.target.value) || 1)),
              )
            }
            style={{ ...inputStyle, width: 64 }}
            disabled={isScanning}
          />
        </label>
        <button
          type="button"
          disabled={isScanning}
          onClick={() =>
            onScan({
              statusFilter,
              maxCandidates,
              minEventCount,
            })
          }
          style={{
            ...buttonStyle,
            background: isScanning ? "var(--s2)" : "var(--primary)",
            color: isScanning ? "var(--ink-subtle)" : "var(--canvas)",
            cursor: isScanning ? "not-allowed" : "pointer",
          }}
        >
          {isScanning ? "Scanning…" : "Scan now"}
        </button>
        {latestJob && (
          <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
            Last scan: {latestJob.status}
            {latestJob.status === "completed" && (
              <>
                {" "}
                · {latestJob.candidatesCreated}/{latestJob.tasksScanned} tasks
              </>
            )}
          </span>
        )}
      </div>
      {failureMessage && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: "var(--radius-sm)",
            background: "var(--danger-bg, rgba(255,80,80,0.08))",
            color: "var(--danger, #d4493b)",
          }}
        >
          {failureMessage}
        </div>
      )}
    </div>
  );
}

interface TabsProps {
  readonly active: SectionTab;
  readonly onSelect: (tab: SectionTab) => void;
  readonly counts: { readonly candidates: number; readonly active: number; readonly archive: number };
}

function Tabs({ active, onSelect, counts }: TabsProps) {
  const tabs: ReadonlyArray<{
    readonly key: SectionTab;
    readonly label: string;
    readonly count: number;
  }> = [
    { key: "candidates", label: "Candidates", count: counts.candidates },
    { key: "active", label: "Active", count: counts.active },
    { key: "archive", label: "Archive", count: counts.archive },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: "8px 24px 0",
        borderBottom: "1px solid var(--hair)",
        background: "var(--canvas)",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          style={{
            padding: "6px 12px",
            border: "none",
            background: "transparent",
            color: active === t.key ? "var(--ink)" : "var(--ink-muted)",
            fontSize: 12.5,
            fontWeight: active === t.key ? 600 : 500,
            borderBottom:
              active === t.key
                ? "2px solid var(--primary)"
                : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {t.label}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              padding: "0 5px",
              borderRadius: "var(--radius-pill)",
              background: "var(--s1)",
              color: "var(--ink-tertiary)",
              minWidth: 18,
              textAlign: "center",
            }}
          >
            {t.count}
          </span>
        </button>
      ))}
    </div>
  );
}

interface CandidatesListProps {
  readonly rows: readonly RecipeCandidate[];
  readonly loading: boolean;
  readonly taskTitleById: ReadonlyMap<string, string>;
}

function CandidatesList({ rows, loading, taskTitleById }: CandidatesListProps) {
  if (loading) return <EmptyHint>Loading candidates…</EmptyHint>;
  if (rows.length === 0) {
    return (
      <EmptyHint>
        No pending candidates. Run a scan to extract recipes from your
        completed tasks.
      </EmptyHint>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((c) => (
        <CandidateCard key={c.id} candidate={c} taskTitleById={taskTitleById} />
      ))}
    </div>
  );
}

function CandidateCard({
  candidate,
  taskTitleById,
}: {
  readonly candidate: RecipeCandidate;
  readonly taskTitleById: ReadonlyMap<string, string>;
}) {
  const accept = useAcceptRecipeCandidateMutation();
  const dismiss = useDismissRecipeCandidateMutation();
  const pending = accept.isPending || dismiss.isPending;
  return (
    <div
      style={{
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius-md)",
        background: "var(--canvas)",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink)",
              wordBreak: "break-word",
            }}
          >
            {candidate.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-muted)",
              marginTop: 4,
              wordBreak: "break-word",
            }}
          >
            {candidate.intent}
          </div>
          {candidate.parentRecipeId && (
            <div
              style={{
                marginTop: 6,
                display: "inline-block",
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: "var(--radius-pill)",
                background: "var(--s1)",
                color: "var(--ink-tertiary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              compare · parent {candidate.parentRecipeId.slice(0, 8)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            disabled={pending}
            onClick={() => accept.mutate(candidate.id)}
            style={{
              ...buttonStyle,
              background: pending ? "var(--s2)" : "var(--primary)",
              color: pending ? "var(--ink-subtle)" : "var(--canvas)",
              cursor: pending ? "not-allowed" : "pointer",
            }}
          >
            Accept
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => dismiss.mutate(candidate.id)}
            style={{
              ...buttonStyle,
              background: "transparent",
              color: "var(--ink-muted)",
              border: "1px solid var(--hair)",
              cursor: pending ? "not-allowed" : "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
      <Description text={candidate.description} />
      <SummaryMd md={candidate.summaryMd} />
      {candidate.steps.length > 0 && (
        <Steps steps={candidate.steps} />
      )}
      {candidate.touchedFiles.length > 0 && (
        <TouchedFiles files={candidate.touchedFiles} />
      )}
      <Slices
        slices={candidate.contributingSlices}
        taskTitleById={taskTitleById}
      />
      <Rationale text={candidate.rationale} />
      <FootMeta
        language={candidate.language}
        createdAt={candidate.createdAt}
      />
    </div>
  );
}

interface ActiveListProps {
  readonly rows: readonly Recipe[];
  readonly loading: boolean;
  readonly taskTitleById: ReadonlyMap<string, string>;
}

function ActiveRecipesList({ rows, loading, taskTitleById }: ActiveListProps) {
  if (loading) return <EmptyHint>Loading recipes…</EmptyHint>;
  if (rows.length === 0) {
    return (
      <EmptyHint>
        No active recipes yet. Accept a candidate to add one.
      </EmptyHint>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => (
        <ActiveRecipeCard key={r.id} recipe={r} taskTitleById={taskTitleById} />
      ))}
    </div>
  );
}

function ArchivedRecipesList({
  rows,
  loading,
  taskTitleById,
}: ActiveListProps) {
  if (loading) return <EmptyHint>Loading archive…</EmptyHint>;
  if (rows.length === 0) {
    return (
      <EmptyHint>
        Nothing here. Retired or superseded recipes show up in this archive.
      </EmptyHint>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => (
        <ActiveRecipeCard
          key={r.id}
          recipe={r}
          taskTitleById={taskTitleById}
          muted
        />
      ))}
    </div>
  );
}

function ActiveRecipeCard({
  recipe,
  taskTitleById,
  muted,
}: {
  readonly recipe: Recipe;
  readonly taskTitleById: ReadonlyMap<string, string>;
  readonly muted?: boolean;
}) {
  const retire = useRetireRecipeMutation();
  return (
    <div
      style={{
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius-md)",
        background: muted ? "var(--s1)" : "var(--canvas)",
        padding: "14px 16px",
        opacity: muted ? 0.85 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink)",
              wordBreak: "break-word",
            }}
          >
            {recipe.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-muted)",
              marginTop: 4,
            }}
          >
            {recipe.intent}
          </div>
          <div
            style={{
              marginTop: 6,
              display: "flex",
              gap: 6,
              fontSize: 10.5,
              fontFamily: "var(--font-mono)",
              color: "var(--ink-tertiary)",
            }}
          >
            <span style={pillStyle}>rev {recipe.rev}</span>
            <span style={pillStyle}>{recipe.status}</span>
            <span style={pillStyle}>
              applied {recipe.successCount}/{recipe.appliedCount}
            </span>
          </div>
        </div>
        {recipe.status === "active" && (
          <button
            type="button"
            disabled={retire.isPending}
            onClick={() => retire.mutate(recipe.id)}
            style={{
              ...buttonStyle,
              background: "transparent",
              color: "var(--ink-muted)",
              border: "1px solid var(--hair)",
              cursor: retire.isPending ? "not-allowed" : "pointer",
            }}
          >
            Retire
          </button>
        )}
      </div>
      <Description text={recipe.description} />
      <SummaryMd md={recipe.summaryMd} />
      {recipe.steps.length > 0 && <Steps steps={recipe.steps} />}
      {recipe.touchedFiles.length > 0 && (
        <TouchedFiles files={recipe.touchedFiles} />
      )}
      <Slices
        slices={recipe.contributingSlices}
        taskTitleById={taskTitleById}
      />
      <FootMeta language={recipe.language} createdAt={recipe.updatedAt} />
    </div>
  );
}

function Description({ text }: { readonly text: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        fontSize: 12,
        color: "var(--ink)",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {text}
    </div>
  );
}

function SummaryMd({ md }: { readonly md: string }) {
  if (!md.trim()) return null;
  return (
    <pre
      style={{
        marginTop: 10,
        padding: "10px 12px",
        fontSize: 11.5,
        fontFamily: "var(--font-mono)",
        background: "var(--s1)",
        borderRadius: "var(--radius-sm)",
        color: "var(--ink)",
        whiteSpace: "pre-wrap",
        overflow: "auto",
        maxHeight: 240,
      }}
    >
      {md}
    </pre>
  );
}

function Steps({
  steps,
}: {
  readonly steps: readonly { readonly order: number; readonly action: string; readonly rationale?: string }[];
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <SectionLabel>Steps</SectionLabel>
      <ol
        style={{
          margin: 0,
          paddingLeft: 22,
          fontSize: 12,
          color: "var(--ink)",
        }}
      >
        {steps.map((s) => (
          <li key={s.order} style={{ marginTop: 4 }}>
            <span>{s.action}</span>
            {s.rationale && (
              <div style={{ color: "var(--ink-muted)", fontSize: 11 }}>
                {s.rationale}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function TouchedFiles({
  files,
}: {
  readonly files: readonly { readonly path: string; readonly role: "read" | "write" | "both" }[];
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <SectionLabel>Touched files</SectionLabel>
      <div
        style={{
          marginTop: 4,
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          fontSize: 11,
          fontFamily: "var(--font-mono)",
        }}
      >
        {files.map((f, i) => (
          <span key={`${f.path}-${i}`} style={pillStyle}>
            {f.role === "read" ? "R " : f.role === "write" ? "W " : "RW "}
            {f.path}
          </span>
        ))}
      </div>
    </div>
  );
}

function Slices({
  slices,
  taskTitleById,
}: {
  readonly slices: readonly { readonly taskId: string; readonly eventIds: readonly string[] }[];
  readonly taskTitleById: ReadonlyMap<string, string>;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <SectionLabel>From tasks</SectionLabel>
      <div
        style={{
          marginTop: 4,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 11.5,
        }}
      >
        {slices.map((s) => {
          const title = taskTitleById.get(s.taskId) ?? s.taskId;
          const scope =
            s.eventIds.length === 0
              ? "whole task"
              : `${s.eventIds.length} events`;
          return (
            <div key={s.taskId} style={{ color: "var(--ink)" }}>
              <span style={{ color: "var(--ink-muted)" }}>·</span>{" "}
              <span>{title}</span>{" "}
              <span style={{ color: "var(--ink-tertiary)", fontSize: 10.5 }}>
                ({scope})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Rationale({ text }: { readonly text: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        fontSize: 11.5,
        color: "var(--ink-muted)",
        fontStyle: "italic",
        lineHeight: 1.5,
      }}
    >
      Why clustered: {text}
    </div>
  );
}

function FootMeta({
  language,
  createdAt,
}: {
  readonly language: string | null;
  readonly createdAt: string;
}) {
  return (
    <div
      style={{
        marginTop: 8,
        fontSize: 10.5,
        color: "var(--ink-tertiary)",
        fontFamily: "var(--font-mono)",
        display: "flex",
        gap: 8,
      }}
    >
      {language && <span>lang: {language}</span>}
      <span>{new Date(createdAt).toLocaleString()}</span>
    </div>
  );
}

function SectionLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--ink-tertiary)",
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function EmptyHint({ children }: { readonly children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "32px 0",
        textAlign: "center",
        fontSize: 12.5,
        color: "var(--ink-muted)",
      }}
    >
      {children}
    </div>
  );
}

function readErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Scan failed";
}

const fieldStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};
const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--ink-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
const inputStyle: React.CSSProperties = {
  background: "var(--canvas)",
  border: "1px solid var(--hair)",
  borderRadius: "var(--radius-sm)",
  padding: "4px 8px",
  fontSize: 12.5,
  color: "var(--ink)",
};
const buttonStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--hair)",
  fontSize: 12.5,
  fontWeight: 500,
};
const pillStyle: React.CSSProperties = {
  padding: "1px 6px",
  borderRadius: "var(--radius-pill)",
  background: "var(--s1)",
  color: "var(--ink-tertiary)",
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
};
