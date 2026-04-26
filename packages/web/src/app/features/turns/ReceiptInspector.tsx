import type React from "react";
import { truncate } from "../../lib/text/truncate.js";
import { CopyRulePromptButton } from "./CopyRulePromptButton.js";
import { CopySummaryButton } from "./CopySummaryButton.js";
import { useTurnReceipt } from "./useTurnReceipt.js";
import { verdictIcon, verdictStyle } from "./verdict-styles.js";
import { PanelCard } from "../../components/ui/PanelCard.js";
import { cardHeader, cardBody } from "../../components/inspector/styles.js";
import { EventInspector } from "../../components/EventInspector.js";

export interface ReceiptInspectorProps {
    readonly turnId: string;
    readonly onCollapse?: () => void;
}

/** Cap for the inline CLAIMED preview before truncation. Summary mode bypasses this. */
const CLAIMED_PREVIEW_MAX_CHARS = 400;

const BASE_PROPS = {
    allowedTabs: ["inspector"] as const,
    singleTabHeaderLayout: "inline" as const,
    isCollapsed: false,
} as const;

export function ReceiptInspector({ turnId, onCollapse }: ReceiptInspectorProps): React.JSX.Element {
    const query = useTurnReceipt(turnId);
    const collapseProps = onCollapse
        ? { showCollapseControl: true as const, onToggleCollapse: onCollapse }
        : { showCollapseControl: false as const };

    if (query.isLoading || !query.data) {
        return (
            <EventInspector {...BASE_PROPS} {...collapseProps} panelLabel="Receipt">
                <p className="p-3 text-[0.78rem] text-[var(--text-3)]">Loading receipt…</p>
            </EventInspector>
        );
    }
    if (query.isError) {
        return (
            <EventInspector {...BASE_PROPS} {...collapseProps} panelLabel="Receipt">
                <p className="p-3 text-[0.78rem] text-[var(--err)]">
                    Failed to load receipt: {query.error instanceof Error ? query.error.message : String(query.error)}
                </p>
            </EventInspector>
        );
    }

    const { card, askedText, verdicts, events, summaryMarkdown } = query.data.receipt;

    return (
        <EventInspector
            {...BASE_PROPS}
            {...collapseProps}
            panelLabel={`Receipt · Turn ${card.taskIndex}`}
            headerExtra={
                <>
                    <CopyRulePromptButton source={query.data.receipt} />
                    <CopySummaryButton turnId={card.id} cached={summaryMarkdown} />
                </>
            }
        >
            <div className="flex flex-1 flex-col gap-2 p-2">
                <PanelCard>
                    <div className={cardHeader}>VERDICT</div>
                    <div className={cardBody}>
                        {verdicts.length === 0 ? (
                            <em className="text-[0.78rem] text-[var(--text-3)]">
                                {card.rulesEvaluatedCount > 0
                                    ? `Evaluated against ${card.rulesEvaluatedCount} active rule${card.rulesEvaluatedCount === 1 ? "" : "s"}. None of their trigger phrases matched.`
                                    : "No active rules. Click \"Suggest rules\" above to copy a prompt."}
                            </em>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {verdicts.map((v) => {
                                    const style = verdictStyle(v.status);
                                    return (
                                        <div
                                            key={v.id}
                                            className="rounded-[var(--radius-sm)] px-2 py-1.5 text-[0.78rem]"
                                            style={{ background: style.chipBg, color: style.chipFg }}
                                        >
                                            {verdictIcon(v.status)} <strong>{v.ruleId}</strong>
                                            {v.matchedPhrase ? (
                                                <> · &ldquo;{v.matchedPhrase}&rdquo;</>
                                            ) : null}
                                            {v.status === "verified" && v.matchedToolCalls && v.matchedToolCalls.length > 0 ? (
                                                <>
                                                    {" "}— via <code>{v.matchedToolCalls.join(", ")}</code>
                                                </>
                                            ) : null}
                                            {v.status === "contradicted" && v.expectedPattern ? (
                                                <>
                                                    {" "}— expected <code>{v.expectedPattern}</code>, saw{" "}
                                                    {v.actualToolCalls.length === 0
                                                        ? "nothing"
                                                        : v.actualToolCalls.join(", ")}
                                                </>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </PanelCard>

                <PanelCard>
                    <div className={cardHeader}>ASKED</div>
                    <div className={cardBody}>
                        {askedText ?? (
                            <em className="text-[0.78rem] text-[var(--text-3)]">(no preceding user message)</em>
                        )}
                    </div>
                </PanelCard>

                <PanelCard>
                    <div className={cardHeader}>{summaryMarkdown ? "SUMMARY" : "CLAIMED"}</div>
                    <div className={cardBody}>
                        {summaryMarkdown ? (
                            <pre className="m-0 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-[var(--text-2)]">
                                {summaryMarkdown}
                            </pre>
                        ) : card.assistantText ? (
                            <p className="m-0 text-[0.78rem] leading-relaxed text-[var(--text-2)]">
                                {truncate(card.assistantText, CLAIMED_PREVIEW_MAX_CHARS)}
                            </p>
                        ) : (
                            <em className="text-[0.78rem] text-[var(--text-3)]">(no assistant text)</em>
                        )}
                    </div>
                </PanelCard>

                <PanelCard>
                    <div className={cardHeader}>DID</div>
                    <div className={cardBody}>
                        {events.length === 0 ? (
                            <em className="text-[0.78rem] text-[var(--text-3)]">(no tool calls)</em>
                        ) : (
                            <ul className="m-0 list-disc pl-4 text-[0.78rem] leading-relaxed text-[var(--text-2)]">
                                {events.map((event) => (
                                    <li key={event.id}>{event.title}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </PanelCard>

            </div>
        </EventInspector>
    );
}
