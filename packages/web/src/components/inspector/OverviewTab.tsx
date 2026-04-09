/**
 * Overview 탭 — Task Flow, Health Overview, Signals, Evidence Strength,
 * Runtime Coverage, Rule Audit, Rule Enforcement, Phase Breakdown,
 * Subagent/Background 패널 뷰.
 */

import type React from "react";
import {
  evidenceTone,
  formatEvidenceLevel,
  formatCount,
  formatDuration,
  formatRate
} from "../../lib/observability.js";
import { formatRelativeTime } from "../../lib/timeline.js";
import { Badge } from "../ui/Badge.js";
import { PanelCard } from "../ui/PanelCard.js";
import { runtimeObservabilityLabel, runtimeTagLabel } from "../TaskList.js";
import { SectionCard } from "./SectionCard.js";
import {
  ObservabilityMetricGrid,
  ObservabilityList,
  ObservabilityPhaseBreakdown,
  formatTraceLinkCoverageNote,
  formatTraceLinkHealthNote,
  formatActionRegistryGapNote
} from "./ObservabilitySection.js";
import { cardShell, cardHeader, cardBody, innerPanel } from "./styles.js";
import type { RuleCoverageStat, RuleDecisionStat, SubagentInsight } from "../../lib/insights.js";
import type { TaskObservabilityResponse } from "../../types.js";

// ---------------------------------------------------------------------------
// SubagentInsightCard
// ---------------------------------------------------------------------------

function SubagentInsightCard({
  insight
}: {
  readonly insight: SubagentInsight;
}): React.JSX.Element {
  return (
    <PanelCard className={cardShell}>
      <div className={cardHeader}>
        <span>Subagents & Background</span>
      </div>
      <div className={cardBody}>
        {insight.delegations === 0 && insight.backgroundTransitions === 0 ? (
          <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No subagent or background activity recorded yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
            <div className={innerPanel + " p-3"}>
              <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Delegations</span>
              <strong className="mt-2 block text-[1.05rem] text-[var(--coordination)]">{insight.delegations}</strong>
            </div>
            <div className={innerPanel + " p-3"}>
              <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Background Events</span>
              <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.backgroundTransitions}</strong>
              <p className="mt-1 mb-0 text-[0.74rem] text-[var(--text-3)]">{insight.linkedBackgroundEvents} linked to parent context</p>
            </div>
            <div className={innerPanel + " p-3"}>
              <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Async Tasks</span>
              <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.uniqueAsyncTasks}</strong>
              <p className="mt-1 mb-0 text-[0.74rem] text-[var(--text-3)]">
                {insight.completedAsyncTasks} completed · {insight.unresolvedAsyncTasks} unresolved
              </p>
            </div>
          </div>
        )}
      </div>
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// RuleDecisionHistoryCard
// ---------------------------------------------------------------------------

function RuleDecisionHistoryCard({
  decisions
}: {
  readonly decisions: readonly RuleDecisionStat[];
}): React.JSX.Element {
  return (
    <PanelCard className={cardShell}>
      <div className={cardHeader}>
        <span>Recent Rule Decisions</span>
        <Badge tone="neutral" size="xs">{decisions.length}</Badge>
      </div>
      <div className={cardBody}>
        {decisions.length === 0 ? (
          <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No recent rule decisions recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {decisions.map((decision) => (
              <div key={decision.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[0.84rem] text-[var(--text-1)]">{decision.ruleId}</strong>
                  <Badge
                    tone={
                      decision.outcome === "approved"
                        ? "success"
                        : decision.outcome === "rejected" || decision.outcome === "blocked"
                          ? "danger"
                          : decision.outcome === "approval_requested"
                            ? "warning"
                            : "accent"
                    }
                    size="xs"
                  >
                    {decision.outcome ?? decision.status}
                  </Badge>
                  {decision.severity && <Badge tone="neutral" size="xs">{decision.severity}</Badge>}
                </div>
                <p className="mt-1.5 mb-0 text-[0.8rem] text-[var(--text-2)]">{decision.title}</p>
                {decision.note && (
                  <p className="mt-1.5 mb-0 text-[0.76rem] text-[var(--text-3)]">{decision.note}</p>
                )}
                <p className="mt-1.5 mb-0 text-[0.72rem] text-[var(--text-3)]">{formatRelativeTime(decision.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// OverviewTab
// ---------------------------------------------------------------------------

export interface OverviewTabProps {
  readonly observability: TaskObservabilityResponse["observability"] | null;
  readonly ruleCoverage: readonly RuleCoverageStat[];
  readonly recentRuleDecisions: readonly RuleDecisionStat[];
  readonly subagentInsight: SubagentInsight;
}

export function OverviewTab({
  observability,
  ruleCoverage,
  recentRuleDecisions,
  subagentInsight
}: OverviewTabProps): React.JSX.Element {
  return (
    <div className="panel-tab-inner flex flex-col gap-5 p-4">
      {observability ? (
        <>
          <SectionCard title="Task Flow">
            <ObservabilityMetricGrid
              items={[
                {
                  label: "Total Duration",
                  value: formatDuration(observability.totalDurationMs),
                  ...(observability.runtimeSource ? { note: `runtime ${observability.runtimeSource}` } : {}),
                  tone: "accent"
                },
                {
                  label: "Active Duration",
                  value: formatDuration(observability.activeDurationMs),
                  note: "work in motion",
                  tone: "ok"
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
                  label: "Trace Link Coverage",
                  value: formatRate(observability.traceLinkCoverageRate),
                  note: formatTraceLinkCoverageNote(observability),
                  tone: "accent"
                }
              ]}
            />
          </SectionCard>

          <SectionCard title="Health Overview">
            <ObservabilityMetricGrid
              items={[
                {
                  label: "Trace Links",
                  value: formatCount(observability.traceLinkCount),
                  note: formatTraceLinkHealthNote(observability),
                  tone: "accent"
                },
                {
                  label: "Action-Registry Gaps",
                  value: formatCount(observability.actionRegistryGapCount),
                  note: formatActionRegistryGapNote(observability),
                  tone: observability.actionRegistryGapCount > 0 ? "warn" : "ok"
                },
                {
                  label: "Questions",
                  value: formatCount(observability.signals.questionsAsked),
                  note: `${formatRate(observability.signals.questionClosureRate)} closed`
                },
                {
                  label: "Todos",
                  value: formatCount(observability.signals.todosAdded),
                  note: `${formatRate(observability.signals.todoCompletionRate)} completed`
                },
                {
                  label: "Sessions",
                  value: formatCount(observability.sessions.total),
                  note: `${formatCount(observability.sessions.open)} open · ${formatCount(observability.sessions.resumed)} resumed`
                },
                {
                  label: "Runtime Source",
                  value: observability.runtimeSource ? runtimeTagLabel(observability.runtimeSource) : "unknown",
                  note: runtimeObservabilityLabel(observability.runtimeSource) ?? "task lineage"
                }
              ]}
            />
          </SectionCard>

          <SectionCard title="Signals">
            <ObservabilityMetricGrid
              items={[
                { label: "Raw Prompts", value: formatCount(observability.signals.rawUserMessages), note: "captured user turns" },
                { label: "Follow-ups", value: formatCount(observability.signals.followUpMessages), note: "additional user turns" },
                { label: "Thoughts", value: formatCount(observability.signals.thoughts), note: "planning summaries" },
                { label: "Tool Calls", value: formatCount(observability.signals.toolCalls), note: "non-terminal tools" },
                { label: "Terminal", value: formatCount(observability.signals.terminalCommands), note: "shell commands" },
                { label: "Verifications", value: formatCount(observability.signals.verifications), note: "tests and checks" },
                { label: "Coordination", value: formatCount(observability.signals.coordinationActivities), note: "MCP / delegation" },
                { label: "Background", value: formatCount(observability.signals.backgroundTransitions), note: "async task transitions" },
                { label: "Explored Files", value: formatCount(observability.signals.exploredFiles), note: "read paths" }
              ]}
            />
          </SectionCard>

          <SectionCard title="Evidence Strength">
            <ObservabilityMetricGrid
              items={observability.evidence.breakdown.map((item) => ({
                label: formatEvidenceLevel(item.level),
                value: formatCount(item.count),
                note: item.level === "proven"
                  ? "runtime-backed capture"
                  : item.level === "self_reported"
                    ? "adapter/agent semantic logging"
                    : item.level === "inferred"
                      ? "derived from other trace data"
                      : "not directly captured",
                tone: evidenceTone(item.level) === "warning"
                  ? "warn"
                  : evidenceTone(item.level) === "danger"
                    ? "warn"
                    : evidenceTone(item.level) === "success"
                      ? "ok"
                      : "accent"
              }))}
            />
          </SectionCard>

          <SectionCard title="Runtime Coverage">
            <div className="mb-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-[0.84rem] text-[var(--text-1)]">Default Posture</strong>
                <Badge tone={evidenceTone(observability.evidence.defaultLevel)} size="xs">
                  {formatEvidenceLevel(observability.evidence.defaultLevel)}
                </Badge>
              </div>
              <p className="mt-1.5 mb-0 text-[0.76rem] text-[var(--text-3)]">{observability.evidence.summary}</p>
            </div>
            <ObservabilityList
              emptyLabel="No runtime coverage profile available for this task."
              items={observability.evidence.runtimeCoverage.map((item) => ({
                label: item.label,
                value: formatEvidenceLevel(item.level),
                note: item.automatic === undefined
                  ? item.note
                  : `${item.note} · ${item.automatic ? "automatic runtime capture" : "cooperative adapter logging"}`,
                tone: evidenceTone(item.level)
              }))}
            />
          </SectionCard>

          <SectionCard title="Rule Audit">
            <div className="flex flex-col gap-3">
              <ObservabilityMetricGrid
                items={[
                  {
                    label: "Rule Events",
                    value: formatCount(observability.rules.total),
                    note: "passive rule audit signals",
                    tone: "accent"
                  },
                  {
                    label: "Pass / Fix",
                    value: formatCount(observability.rules.passes),
                    note: "pass or fix-applied",
                    tone: "ok"
                  },
                  {
                    label: "Violations",
                    value: formatCount(observability.rules.violations),
                    note: observability.rules.violations > 0 ? "rules that failed" : "no violations recorded",
                    tone: observability.rules.violations > 0 ? "warn" : "ok"
                  },
                  {
                    label: "Warnings",
                    value: formatCount(observability.ruleEnforcement.warnings),
                    note: "rule outcomes warned",
                    tone: observability.ruleEnforcement.warnings > 0 ? "warn" : "neutral"
                  },
                  {
                    label: "Blocked",
                    value: formatCount(observability.ruleEnforcement.blocked),
                    note: "rule outcomes blocked",
                    tone: observability.ruleEnforcement.blocked > 0 ? "warn" : "neutral"
                  },
                  {
                    label: "Approval Flow",
                    value: formatCount(observability.ruleEnforcement.approvalRequested),
                    note: `${formatCount(observability.ruleEnforcement.approved)} approved · ${formatCount(observability.ruleEnforcement.rejected)} rejected`,
                    tone: observability.ruleEnforcement.approvalRequested > 0 ? "accent" : "neutral"
                  }
                ]}
              />
              <ObservabilityList
                emptyLabel="No rule audit events recorded yet."
                items={ruleCoverage.map((rule) => ({
                  label: rule.ruleId,
                  value: `${rule.violationCount}v / ${rule.passCount}p / ${rule.checkCount}c`,
                  note: [
                    `${rule.ruleEventCount} events`,
                    rule.warningCount > 0 ? `${rule.warningCount} warned` : null,
                    rule.blockedCount > 0 ? `${rule.blockedCount} blocked` : null,
                    rule.approvalRequestCount > 0 ? `${rule.approvalRequestCount} approval` : null,
                    rule.lastSeenAt != null ? `last ${formatRelativeTime(rule.lastSeenAt)}` : null
                  ].filter((value): value is string => Boolean(value)).join(" · "),
                  tone: rule.violationCount > 0 ? "danger" : rule.passCount > 0 ? "success" : "neutral"
                }))}
              />
            </div>
          </SectionCard>

          <SectionCard title="Rule Enforcement">
            <div className="mb-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-[0.84rem] text-[var(--text-1)]">Active Guard State</strong>
                <Badge
                  tone={
                    observability.ruleEnforcement.activeState === "blocked"
                      ? "danger"
                      : observability.ruleEnforcement.activeState === "approval_required"
                        ? "warning"
                        : observability.ruleEnforcement.activeState === "warning"
                          ? "accent"
                          : "success"
                  }
                  size="xs"
                >
                  {observability.ruleEnforcement.activeState.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="mt-1.5 mb-0 text-[0.76rem] text-[var(--text-3)]">
                {observability.ruleEnforcement.activeLabel
                  ? `Current rule: ${observability.ruleEnforcement.activeLabel}`
                  : "No active rule gate is blocking or waiting on this task."}
              </p>
            </div>
            <ObservabilityMetricGrid
              items={[
                {
                  label: "Warnings",
                  value: formatCount(observability.ruleEnforcement.warnings),
                  note: "soft enforcement",
                  tone: observability.ruleEnforcement.warnings > 0 ? "warn" : "neutral"
                },
                {
                  label: "Blocked",
                  value: formatCount(observability.ruleEnforcement.blocked),
                  note: "hard-stop decisions",
                  tone: observability.ruleEnforcement.blocked > 0 ? "warn" : "ok"
                },
                {
                  label: "Approval Req",
                  value: formatCount(observability.ruleEnforcement.approvalRequested),
                  note: "needs explicit approval",
                  tone: observability.ruleEnforcement.approvalRequested > 0 ? "accent" : "neutral"
                },
                {
                  label: "Approved",
                  value: formatCount(observability.ruleEnforcement.approved),
                  note: "approved exceptions",
                  tone: observability.ruleEnforcement.approved > 0 ? "ok" : "neutral"
                },
                {
                  label: "Rejected",
                  value: formatCount(observability.ruleEnforcement.rejected),
                  note: "rejected exceptions",
                  tone: observability.ruleEnforcement.rejected > 0 ? "warn" : "neutral"
                },
                {
                  label: "Bypassed",
                  value: formatCount(observability.ruleEnforcement.bypassed),
                  note: "explicit bypasses",
                  tone: observability.ruleEnforcement.bypassed > 0 ? "warn" : "neutral"
                }
              ]}
            />
          </SectionCard>

          <RuleDecisionHistoryCard decisions={recentRuleDecisions} />

          <SubagentInsightCard insight={subagentInsight} />

          <SectionCard title="Phase Breakdown">
            <ObservabilityPhaseBreakdown phases={observability.phaseBreakdown} />
          </SectionCard>

          <SectionCard title="Top Files">
            <ObservabilityList
              emptyLabel="No file focus recorded yet."
              items={observability.focus.topFiles.map((file) => ({
                label: file.path,
                value: `${formatCount(file.count)}x`
              }))}
            />
          </SectionCard>

          <SectionCard title="Top Tags">
            <ObservabilityList
              emptyLabel="No focus tags recorded yet."
              items={observability.focus.topTags.map((tag) => ({
                label: tag.tag,
                value: `${formatCount(tag.count)}x`
              }))}
            />
          </SectionCard>
        </>
      ) : (
        <div className="rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--bg)] px-4 py-6 text-center">
          <p className="m-0 text-[0.86rem] font-medium text-[var(--text-2)]">No workspace overview available.</p>
          <p className="mt-1.5 mb-0 text-[0.78rem] text-[var(--text-3)]">
            The server will populate this tab once `/api/tasks/:taskId/observability` is available for the selected task.
          </p>
        </div>
      )}
    </div>
  );
}
