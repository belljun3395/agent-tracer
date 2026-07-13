import type { ReactNode } from "react";
import { cn } from "~web/shared/ui/lib/cn.js";
import { formatAbsoluteHHmmss } from "~web/shared/lib/formatting/time.js";
import { SectionLabel } from "~web/shared/ui/index.js";
import type { Recipe } from "~web/entities/recipe/model/recipe.js";

interface RecipeCardProps {
  readonly recipe: Recipe;
  readonly taskTitleById: ReadonlyMap<string, string>;
  readonly muted?: boolean;
  /** 푸터에 표시할 타임스탬프. */
  readonly footMetaAt: string;
  readonly actions?: ReactNode;
  readonly feedback?: ReactNode;
  readonly metaPills?: ReactNode;
  readonly showParentBadge?: boolean;
  readonly showRationale?: boolean;
}

/** candidate 카드와 active/archived 레시피 카드가 공유하는 본문. */
/** 후보와 라이브러리가 공유하는 레시피 내용을 표시한다. */
export function RecipeCard({
  recipe,
  taskTitleById,
  muted,
  footMetaAt,
  actions,
  feedback,
  metaPills,
  showParentBadge,
  showRationale,
}: RecipeCardProps) {
  return (
    <div
      className={cn(
        "border border-hair rounded-md py-3.5 px-4",
        muted ? "bg-s1 opacity-85" : "bg-canvas",
      )}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink break-words">
            {recipe.title}
          </div>
          <div className="text-xs text-ink-muted mt-1 break-words">
            {recipe.intent}
          </div>
          {showParentBadge && recipe.parentRecipeId && (
            <div className="mt-1.5 inline-block text-[11px] py-0.5 px-1.5 rounded-pill bg-s1 text-ink-tertiary font-mono">
              compare · parent {recipe.parentRecipeId.slice(0, 8)}
            </div>
          )}
          {metaPills}
        </div>
        {actions && <div className="flex gap-1.5 shrink-0">{actions}</div>}
      </div>
      <Description text={recipe.description} />
      <SummaryMd md={recipe.summaryMd} />
      {recipe.request.trim() && <Request text={recipe.request} />}
      {recipe.corrections.length > 0 && <Corrections rows={recipe.corrections} />}
      {recipe.pitfalls.length > 0 && <Pitfalls rows={recipe.pitfalls} />}
      {recipe.governingRules.length > 0 && <GoverningRules ruleIds={recipe.governingRules} />}
      {recipe.steps.length > 0 && <Steps steps={recipe.steps} />}
      {recipe.touchedFiles.length > 0 && <TouchedFiles files={recipe.touchedFiles} />}
      <Slices slices={recipe.contributingSlices} taskTitleById={taskTitleById} />
      {showRationale && recipe.rationale && <Rationale text={recipe.rationale} />}
      {feedback && <div className="mt-2.5">{feedback}</div>}
      <FootMeta language={recipe.language} createdAt={footMetaAt} />
    </div>
  );
}

function GoverningRules({ ruleIds }: { readonly ruleIds: readonly string[] }) {
  return (
    <div className="mt-2.5">
      <SectionLabel>Governing rules</SectionLabel>
      <div className="mt-1 flex flex-wrap gap-1 text-[10.5px] font-mono text-ink-tertiary">
        {ruleIds.map((id) => (
          <span key={id} className="py-px px-1.5 rounded-pill bg-s1">
            {id}
          </span>
        ))}
      </div>
    </div>
  );
}

function Description({ text }: { readonly text: string }) {
  return (
    <div className="mt-2.5 text-xs text-ink leading-[1.5] whitespace-pre-wrap break-words">
      {text}
    </div>
  );
}

function Request({ text }: { readonly text: string }) {
  return (
    <div className="mt-2.5">
      <SectionLabel>Request</SectionLabel>
      <div className="mt-1 text-[11.5px] text-ink leading-[1.5] whitespace-pre-wrap break-words">
        {text}
      </div>
    </div>
  );
}

function Corrections({
  rows,
}: {
  readonly rows: readonly {
    readonly whatAgentDid: string;
    readonly howCorrected: string;
    readonly evidence: readonly string[];
  }[];
}) {
  return (
    <div className="mt-2.5">
      <SectionLabel>Corrections</SectionLabel>
      <div className="mt-1 flex flex-col gap-1.5 text-[11.5px] text-ink">
        {rows.map((row, i) => (
          <div key={`${row.whatAgentDid}-${i}`} className="leading-[1.45]">
            <div>
              <span className="text-ink-muted">Did:</span> {row.whatAgentDid}
            </div>
            <div>
              <span className="text-ink-muted">Corrected:</span> {row.howCorrected}
            </div>
            {row.evidence.length > 0 && <Evidence ids={row.evidence} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function Pitfalls({
  rows,
}: {
  readonly rows: readonly {
    readonly pitfall: string;
    readonly whyNonObvious: string;
    readonly evidence: readonly string[];
  }[];
}) {
  return (
    <div className="mt-2.5">
      <SectionLabel>Pitfalls</SectionLabel>
      <div className="mt-1 flex flex-col gap-1.5 text-[11.5px] text-ink">
        {rows.map((row, i) => (
          <div key={`${row.pitfall}-${i}`} className="leading-[1.45]">
            <div>{row.pitfall}</div>
            <div className="text-ink-muted">{row.whyNonObvious}</div>
            {row.evidence.length > 0 && <Evidence ids={row.evidence} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function Evidence({ ids }: { readonly ids: readonly string[] }) {
  return (
    <div className="mt-0.5 flex flex-wrap gap-1 text-[10.5px] font-mono text-ink-tertiary">
      {ids.map((id) => (
        <span key={id} className="py-px px-1.5 rounded-pill bg-s1">
          {id}
        </span>
      ))}
    </div>
  );
}

function SummaryMd({ md }: { readonly md: string }) {
  if (!md.trim()) return null;
  return (
    <pre className="mt-2.5 py-2.5 px-3 text-[11.5px] font-mono bg-s1 rounded-sm text-ink whitespace-pre-wrap overflow-auto max-h-60">
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
    <div className="mt-2.5">
      <SectionLabel>Steps</SectionLabel>
      <ol className="m-0 pl-[22px] text-xs text-ink">
        {steps.map((s) => (
          <li key={s.order} className="mt-1">
            <span>{s.action}</span>
            {s.rationale && (
              <div className="text-ink-muted text-[11px]">{s.rationale}</div>
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
    <div className="mt-2.5">
      <SectionLabel>Touched files</SectionLabel>
      <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-mono">
        {files.map((f, i) => (
          <span key={`${f.path}-${i}`} className="py-px px-1.5 rounded-pill bg-s1 text-ink-tertiary font-mono text-[10.5px]">
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
    <div className="mt-2.5">
      <SectionLabel>From tasks</SectionLabel>
      <div className="mt-1 flex flex-col gap-1 text-[11.5px]">
        {slices.map((s) => {
          const title = taskTitleById.get(s.taskId) ?? s.taskId;
          const scope =
            s.eventIds.length === 0 ? "whole task" : `${s.eventIds.length} events`;
          return (
            <div key={s.taskId} className="text-ink">
              <span className="text-ink-muted">·</span> <span>{title}</span>{" "}
              <span className="text-ink-tertiary text-[10.5px]">({scope})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Rationale({ text }: { readonly text: string }) {
  return (
    <div className="mt-2.5 text-[11.5px] text-ink-muted italic leading-[1.5]">
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
    <div className="mt-2 text-[10.5px] text-ink-tertiary font-mono flex gap-2">
      {language && <span>lang: {language}</span>}
      <span>{formatAbsoluteHHmmss(createdAt)}</span>
    </div>
  );
}
