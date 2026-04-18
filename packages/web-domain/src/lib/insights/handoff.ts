import type { ReusableTaskSnapshot } from "@monitor/domain";
import {
    KO_EVALUATE_CALL_NOW,
    KO_EVALUATE_FIELD_APPROACH_NOTE,
    KO_EVALUATE_FIELD_OUTCOME_NOTE,
    KO_EVALUATE_FIELD_RATING,
    KO_EVALUATE_FIELD_REUSE_WHEN,
    KO_EVALUATE_FIELD_USE_CASE,
    KO_EVALUATE_FIELD_WATCHOUTS,
    KO_EVALUATE_FIELD_WORKFLOW_TAGS,
    KO_EVALUATE_INSTRUCTIONS_HEADER,
    KO_EVALUATE_INTRO,
    KO_HANDOFF_ACTION_CONTINUE,
    KO_HANDOFF_ACTION_HANDOFF,
    KO_HANDOFF_ACTION_REFERENCE,
    KO_HANDOFF_ACTION_REVIEW,
    KO_HANDOFF_PREAMBLE_CONTINUE,
    KO_HANDOFF_PREAMBLE_HANDOFF,
    KO_HANDOFF_PREAMBLE_REFERENCE,
    KO_HANDOFF_PREAMBLE_REVIEW,
} from "../../i18n/ko.js";
import type { TaskProcessSection } from "./types.js";
import { uniqueStrings } from "./helpers.js";

export interface HandoffOptions {
    readonly objective: string;
    readonly summary: string;
    readonly sections: readonly TaskProcessSection[];
    readonly plans: readonly string[];
    readonly exploredFiles: readonly string[];
    readonly modifiedFiles: readonly string[];
    readonly openTodos: readonly string[];
    readonly openQuestions: readonly string[];
    readonly violations: readonly string[];
    readonly memo: string;
    readonly snapshot: ReusableTaskSnapshot;
    readonly purpose: HandoffPurpose;
    readonly mode: HandoffMode;
    readonly include: {
        readonly summary: boolean;
        readonly process: boolean;
        readonly plans: boolean;
        readonly files: boolean;
        readonly modifiedFiles: boolean;
        readonly todos: boolean;
        readonly violations: boolean;
        readonly questions: boolean;
    };
}
export type HandoffMode = "compact" | "standard" | "full";
export type HandoffPurpose = "continue" | "handoff" | "review" | "reference";
type HandoffSectionKey = "summary" | "currentState" | "reuseWhen" | "plans" | "process" | "files" | "modifiedFiles" | "todos" | "violations" | "verification" | "questions" | "memo";
const HANDOFF_PURPOSE_LABELS: Record<HandoffPurpose, string> = {
    continue: "Continue this task",
    handoff: "Hand off to someone else",
    review: "Create a review summary",
    reference: "Save as reference"
};
const HANDOFF_SECTION_ORDER: Record<HandoffPurpose, readonly HandoffSectionKey[]> = {
    continue: ["currentState", "todos", "questions", "violations", "summary", "reuseWhen", "plans", "process", "files", "modifiedFiles", "verification", "memo"],
    handoff: ["summary", "currentState", "reuseWhen", "plans", "process", "todos", "violations", "files", "modifiedFiles", "verification", "questions", "memo"],
    review: ["summary", "currentState", "violations", "verification", "process", "plans", "modifiedFiles", "files", "questions", "memo"],
    reference: ["summary", "reuseWhen", "currentState", "process", "plans", "files", "modifiedFiles", "verification", "todos", "violations", "questions", "memo"]
};
interface PreparedHandoffView {
    readonly summary: string;
    readonly sections: readonly TaskProcessSection[];
    readonly plans: readonly string[];
    readonly exploredFiles: readonly string[];
    readonly modifiedFiles: readonly string[];
    readonly openTodos: readonly string[];
    readonly openQuestions: readonly string[];
    readonly violations: readonly string[];
    readonly currentState: string;
}
export function buildHandoffPlain(options: HandoffOptions): string {
    const { objective, mode, purpose } = options;
    const view = prepareHandoffView(options);
    const lines: string[] = [];
    lines.push(`Briefing: ${objective}`);
    lines.push(`Purpose: ${HANDOFF_PURPOSE_LABELS[purpose]}`);
    lines.push(`Mode: ${mode}`);
    for (const key of HANDOFF_SECTION_ORDER[purpose]) {
        appendPlainHandoffSection(lines, key, options, view);
    }
    return lines.join("\n");
}
export function buildHandoffMarkdown(options: HandoffOptions): string {
    const { objective, mode, purpose } = options;
    const view = prepareHandoffView(options);
    const parts: string[] = ["# Briefing", `\n## Purpose\n${HANDOFF_PURPOSE_LABELS[purpose]}`, `\n## Objective\n${objective}`, `\n## Detail Level\n${mode}`];
    for (const key of HANDOFF_SECTION_ORDER[purpose]) {
        appendMarkdownHandoffSection(parts, key, options, view);
    }
    return parts.join("");
}
function cdata(s: string): string {
    return `<![CDATA[${s}]]>`;
}
export function buildHandoffXML(options: HandoffOptions): string {
    const { objective, mode, purpose } = options;
    const view = prepareHandoffView(options);
    const lines: string[] = ["<briefing>"];
    lines.push(`  <objective>${cdata(objective)}</objective>`);
    lines.push(`  <purpose>${cdata(purpose)}</purpose>`);
    lines.push(`  <purpose_label>${cdata(HANDOFF_PURPOSE_LABELS[purpose])}</purpose_label>`);
    lines.push(`  <mode>${cdata(mode)}</mode>`);
    for (const key of HANDOFF_SECTION_ORDER[purpose]) {
        appendXmlHandoffSection(lines, key, options, view);
    }
    lines.push("</briefing>");
    return lines.join("\n");
}
export function buildHandoffSystemPrompt(options: HandoffOptions): string {
    const { objective, mode, purpose } = options;
    const view = prepareHandoffView(options);
    const parts: string[] = [
        "You are receiving a briefing for a software development task. Use it to orient quickly and continue with the most appropriate next action.",
        `\n## Briefing Purpose\n${HANDOFF_PURPOSE_LABELS[purpose]}`,
        `\n## Task\n${objective}`,
        `\n## Handoff Mode\n${mode}`
    ];
    for (const key of HANDOFF_SECTION_ORDER[purpose]) {
        appendSystemPromptHandoffSection(parts, key, options, view);
    }
    parts.push("\nBegin by acknowledging you have read this briefing, then state the most useful next action.");
    return parts.join("");
}
function prepareHandoffView(options: HandoffOptions): PreparedHandoffView {
    const selected = selectHandoffViewData(options);
    return {
        ...selected,
        currentState: buildCurrentState(selected, options.snapshot.verificationSummary, options.purpose)
    };
}
function selectHandoffViewData(options: HandoffOptions): Omit<PreparedHandoffView, "currentState"> {
    if (options.mode === "full") {
        return {
            summary: options.summary,
            sections: options.sections,
            plans: options.plans,
            exploredFiles: options.exploredFiles,
            modifiedFiles: options.modifiedFiles,
            openTodos: options.openTodos,
            openQuestions: options.openQuestions,
            violations: options.violations
        };
    }
    const compactSections: TaskProcessSection[] = [];
    if (options.snapshot.approachSummary) {
        compactSections.push({
            lane: "planning",
            title: "What Worked",
            items: [options.snapshot.approachSummary]
        });
    }
    if (options.snapshot.keyDecisions.length > 0) {
        compactSections.push({
            lane: "implementation",
            title: "Key Decisions",
            items: options.mode === "compact"
                ? options.snapshot.keyDecisions.slice(0, 3)
                : options.snapshot.keyDecisions
        });
    }
    const summaryLines = [
        options.snapshot.outcomeSummary ?? options.summary,
        options.mode === "standard" && options.snapshot.reuseWhen ? `Reuse when: ${options.snapshot.reuseWhen}` : null
    ].filter((value): value is string => Boolean(value));
    return {
        summary: summaryLines.join("\n"),
        sections: options.mode === "compact"
            ? compactSections
            : compactSections.length > 0
                ? [...compactSections, ...options.sections.map((section) => ({
                        ...section,
                        items: section.items.slice(0, 2)
                    }))]
                : options.sections.map((section) => ({ ...section, items: section.items.slice(0, 2) })),
        plans: (options.snapshot.nextSteps.length > 0 ? options.snapshot.nextSteps : options.plans)
            .slice(0, options.mode === "compact" ? 3 : 5),
        exploredFiles: (options.snapshot.keyFiles.length > 0 ? options.snapshot.keyFiles : options.exploredFiles)
            .slice(0, options.mode === "compact" ? 4 : 6),
        modifiedFiles: (options.snapshot.modifiedFiles.length > 0 ? options.snapshot.modifiedFiles : options.modifiedFiles)
            .slice(0, options.mode === "compact" ? 4 : 6),
        openTodos: options.openTodos.slice(0, options.mode === "compact" ? 3 : 4),
        openQuestions: options.openQuestions.slice(0, options.mode === "compact" ? 1 : 2),
        violations: uniqueStrings([
            ...options.snapshot.watchItems,
            ...options.violations
        ]).slice(0, options.mode === "compact" ? 4 : 6)
    };
}
function buildCurrentState(view: Omit<PreparedHandoffView, "currentState">, verificationSummary: string | null, purpose: HandoffPurpose): string {
    const phrases: string[] = [];
    if (view.openTodos.length > 0) {
        phrases.push(`Open work remains: ${view.openTodos.length} todo${view.openTodos.length === 1 ? "" : "s"}.`);
    }
    else if (purpose === "review") {
        phrases.push("The task is ready for review.");
    }
    else if (purpose === "reference") {
        phrases.push("This briefing captures the task as a reusable reference.");
    }
    else {
        phrases.push("No open todos were detected in the selected briefing view.");
    }
    if (view.openQuestions.length > 0) {
        phrases.push(`${view.openQuestions.length} open question${view.openQuestions.length === 1 ? "" : "s"} ${view.openQuestions.length === 1 ? "still needs" : "still need"} clarification.`);
    }
    if (view.violations.length > 0) {
        phrases.push(`${view.violations.length} watchout${view.violations.length === 1 ? "" : "s"} should be kept in mind.`);
    }
    if (verificationSummary) {
        phrases.push(`Verification status: ${verificationSummary}`);
    }
    return phrases.join(" ");
}
function appendPlainHandoffSection(lines: string[], key: HandoffSectionKey, options: HandoffOptions, view: PreparedHandoffView): void {
    switch (key) {
        case "summary":
            if (options.include.summary && view.summary) {
                lines.push(`Summary: ${view.summary}`);
            }
            break;
        case "currentState":
            lines.push(`Current State: ${view.currentState}`);
            break;
        case "reuseWhen":
            if (options.snapshot.reuseWhen) {
                lines.push(`Reuse When: ${options.snapshot.reuseWhen}`);
            }
            break;
        case "plans":
            if (options.include.plans && view.plans.length > 0) {
                lines.push("Plan:");
                for (const step of view.plans)
                    lines.push(`- ${step}`);
            }
            break;
        case "process":
            if (options.include.process && view.sections.length > 0) {
                lines.push("Process:");
                for (const section of view.sections) {
                    for (const item of section.items) {
                        lines.push(`- ${section.lane}: ${item}`);
                    }
                }
            }
            break;
        case "files":
            if (options.include.files && view.exploredFiles.length > 0) {
                lines.push(`Explored Files: ${view.exploredFiles.join(", ")}`);
            }
            break;
        case "modifiedFiles":
            if (options.include.modifiedFiles && view.modifiedFiles.length > 0) {
                lines.push(`Modified Files: ${view.modifiedFiles.join(", ")}`);
            }
            break;
        case "todos":
            if (options.include.todos && view.openTodos.length > 0) {
                lines.push("Open TODOs:");
                for (const todo of view.openTodos)
                    lines.push(`- ${todo}`);
            }
            break;
        case "violations":
            if (options.include.violations && view.violations.length > 0) {
                lines.push("Watchouts:");
                for (const violation of view.violations)
                    lines.push(`- ${violation}`);
            }
            break;
        case "verification":
            if (options.snapshot.verificationSummary) {
                lines.push(`Verification: ${options.snapshot.verificationSummary}`);
            }
            break;
        case "questions":
            if (options.include.questions && view.openQuestions.length > 0) {
                lines.push("Open Questions:");
                for (const question of view.openQuestions)
                    lines.push(`- ${question}`);
            }
            break;
        case "memo":
            if (options.memo.trim()) {
                lines.push(`Memo: ${options.memo.trim()}`);
            }
            break;
    }
}
function appendMarkdownHandoffSection(parts: string[], key: HandoffSectionKey, options: HandoffOptions, view: PreparedHandoffView): void {
    switch (key) {
        case "summary":
            if (options.include.summary && view.summary) {
                parts.push(`\n## Summary\n${view.summary}`);
            }
            break;
        case "currentState":
            parts.push(`\n## Current State\n${view.currentState}`);
            break;
        case "reuseWhen":
            if (options.snapshot.reuseWhen) {
                parts.push(`\n## Reuse When\n${options.snapshot.reuseWhen}`);
            }
            break;
        case "plans":
            if (options.include.plans && view.plans.length > 0) {
                parts.push(`\n## Plan\n${view.plans.map((plan) => `- ${plan}`).join("\n")}`);
            }
            break;
        case "process":
            if (options.include.process && view.sections.length > 0) {
                const sectionLines = view.sections.map((section) => `### ${section.title}\n${section.items.map((item) => `- ${item}`).join("\n")}`);
                parts.push(`\n## Process\n${sectionLines.join("\n\n")}`);
            }
            break;
        case "files":
            if (options.include.files && view.exploredFiles.length > 0) {
                parts.push(`\n## Explored Files\n${view.exploredFiles.map((filePath) => `- \`${filePath}\``).join("\n")}`);
            }
            break;
        case "modifiedFiles":
            if (options.include.modifiedFiles && view.modifiedFiles.length > 0) {
                parts.push(`\n## Modified Files\n${view.modifiedFiles.map((filePath) => `- \`${filePath}\``).join("\n")}`);
            }
            break;
        case "todos":
            if (options.include.todos && view.openTodos.length > 0) {
                parts.push(`\n## Open TODOs\n${view.openTodos.map((todo) => `- ${todo}`).join("\n")}`);
            }
            break;
        case "violations":
            if (options.include.violations && view.violations.length > 0) {
                parts.push(`\n## Watchouts\n${view.violations.map((violation) => `- ${violation}`).join("\n")}`);
            }
            break;
        case "verification":
            if (options.snapshot.verificationSummary) {
                parts.push(`\n## Verification\n- ${options.snapshot.verificationSummary}`);
            }
            break;
        case "questions":
            if (options.include.questions && view.openQuestions.length > 0) {
                parts.push(`\n## Open Questions\n${view.openQuestions.map((question) => `- ${question}`).join("\n")}`);
            }
            break;
        case "memo":
            if (options.memo.trim()) {
                parts.push(`\n## Memo\n${options.memo.trim()}`);
            }
            break;
    }
}
function appendXmlHandoffSection(lines: string[], key: HandoffSectionKey, options: HandoffOptions, view: PreparedHandoffView): void {
    switch (key) {
        case "summary":
            if (options.include.summary && view.summary) {
                lines.push(`  <summary>${cdata(view.summary)}</summary>`);
            }
            break;
        case "currentState":
            lines.push(`  <current_state>${cdata(view.currentState)}</current_state>`);
            break;
        case "reuseWhen":
            if (options.snapshot.reuseWhen) {
                lines.push(`  <reuse_when>${cdata(options.snapshot.reuseWhen)}</reuse_when>`);
            }
            break;
        case "plans":
            if (options.include.plans && view.plans.length > 0) {
                lines.push("  <plan>");
                for (const step of view.plans)
                    lines.push(`    <step>${cdata(step)}</step>`);
                lines.push("  </plan>");
            }
            break;
        case "process":
            if (options.include.process && view.sections.length > 0) {
                lines.push("  <process>");
                for (const section of view.sections) {
                    lines.push(`    <section lane="${section.lane}" title="${section.title}">`);
                    for (const item of section.items) {
                        lines.push(`      <step>${cdata(item)}</step>`);
                    }
                    lines.push("    </section>");
                }
                lines.push("  </process>");
            }
            break;
        case "files":
            if (options.include.files && view.exploredFiles.length > 0) {
                lines.push("  <explored_files>");
                for (const filePath of view.exploredFiles)
                    lines.push(`    <file>${cdata(filePath)}</file>`);
                lines.push("  </explored_files>");
            }
            break;
        case "modifiedFiles":
            if (options.include.modifiedFiles && view.modifiedFiles.length > 0) {
                lines.push("  <modified_files>");
                for (const filePath of view.modifiedFiles)
                    lines.push(`    <file>${cdata(filePath)}</file>`);
                lines.push("  </modified_files>");
            }
            break;
        case "todos":
            if (options.include.todos && view.openTodos.length > 0) {
                lines.push("  <open_todos>");
                for (const todo of view.openTodos)
                    lines.push(`    <todo>${cdata(todo)}</todo>`);
                lines.push("  </open_todos>");
            }
            break;
        case "violations":
            if (options.include.violations && view.violations.length > 0) {
                lines.push(`  <watchouts count="${view.violations.length}">`);
                for (const violation of view.violations)
                    lines.push(`    <watchout>${cdata(violation)}</watchout>`);
                lines.push("  </watchouts>");
            }
            break;
        case "verification":
            if (options.snapshot.verificationSummary) {
                lines.push(`  <verification>${cdata(options.snapshot.verificationSummary)}</verification>`);
            }
            break;
        case "questions":
            if (options.include.questions && view.openQuestions.length > 0) {
                lines.push("  <open_questions>");
                for (const question of view.openQuestions)
                    lines.push(`    <question>${cdata(question)}</question>`);
                lines.push("  </open_questions>");
            }
            break;
        case "memo":
            if (options.memo.trim()) {
                lines.push(`  <memo>${cdata(options.memo.trim())}</memo>`);
            }
            break;
    }
}
const HANDOFF_PROMPT_PREAMBLE: Record<HandoffPurpose, string> = {
    continue: KO_HANDOFF_PREAMBLE_CONTINUE,
    handoff: KO_HANDOFF_PREAMBLE_HANDOFF,
    review: KO_HANDOFF_PREAMBLE_REVIEW,
    reference: KO_HANDOFF_PREAMBLE_REFERENCE,
};
const HANDOFF_PROMPT_ACTION: Record<HandoffPurpose, string> = {
    continue: KO_HANDOFF_ACTION_CONTINUE,
    handoff: KO_HANDOFF_ACTION_HANDOFF,
    review: KO_HANDOFF_ACTION_REVIEW,
    reference: KO_HANDOFF_ACTION_REFERENCE,
};
export function buildHandoffPrompt(options: HandoffOptions): string {
    const { objective, purpose } = options;
    const view = prepareHandoffView(options);
    const parts: string[] = [
        HANDOFF_PROMPT_PREAMBLE[purpose],
        `\n## Task\n${objective}`
    ];
    for (const key of HANDOFF_SECTION_ORDER[purpose]) {
        appendSystemPromptHandoffSection(parts, key, options, view);
    }
    parts.push(`\n## Action\n${HANDOFF_PROMPT_ACTION[purpose]}`);
    return parts.join("");
}
export interface EvaluatePromptOptions {
    readonly taskId: string;
    readonly objective: string;
    readonly summary: string;
    readonly sections: readonly TaskProcessSection[];
    readonly plans: readonly string[];
    readonly exploredFiles: readonly string[];
    readonly modifiedFiles: readonly string[];
    readonly openTodos: readonly string[];
    readonly openQuestions: readonly string[];
    readonly violations: readonly string[];
    readonly snapshot: ReusableTaskSnapshot;
    readonly activeInstructions: readonly string[];
}
export function buildEvaluatePrompt(options: EvaluatePromptOptions): string {
    const {
        taskId, objective, summary, sections,
        modifiedFiles, violations,
        exploredFiles, openTodos, openQuestions, plans,
        activeInstructions,
    } = options;

    const parts: string[] = [KO_EVALUATE_INTRO];
    parts.push(`\n## Task Context`);
    if (objective) parts.push(`\n- Objective: ${objective}`);
    if (summary) parts.push(`\n- Summary: ${summary}`);

    if (sections.length > 0) {
        const items = sections.flatMap((s) => s.items.slice(0, 2).map((item) => `  - ${s.lane}: ${item}`));
        parts.push(`\n- Process:\n${items.join("\n")}`);
    }
    if (plans.length > 0) {
        parts.push(`\n- Plan steps:\n${plans.slice(0, 5).map((p) => `  - ${p}`).join("\n")}`);
    }
    if (modifiedFiles.length > 0) {
        parts.push(`\n- Modified files: ${modifiedFiles.slice(0, 6).join(", ")}`);
    }
    if (exploredFiles.length > 0) {
        parts.push(`\n- Key explored files: ${exploredFiles.slice(0, 8).join(", ")}`);
    }
    if (openTodos.length > 0) {
        parts.push(`\n- Open todos: ${openTodos.slice(0, 5).map((t) => `"${t}"`).join(", ")}`);
    }
    if (openQuestions.length > 0) {
        parts.push(`\n- Open questions: ${openQuestions.slice(0, 3).map((q) => `"${q}"`).join(", ")}`);
    }
    if (violations.length > 0) {
        parts.push(`\n- Watchouts: ${violations.slice(0, 4).join("; ")}`);
    }
    if (activeInstructions.length > 0) {
        parts.push(`\n- Active instruction files: ${activeInstructions.join(", ")}`);
    }

    parts.push(`\n## Instructions`);
    parts.push(KO_EVALUATE_INSTRUCTIONS_HEADER);
    parts.push(`- taskId: "${taskId}"`);
    parts.push(KO_EVALUATE_FIELD_RATING);
    parts.push(KO_EVALUATE_FIELD_USE_CASE);
    parts.push(KO_EVALUATE_FIELD_OUTCOME_NOTE);
    parts.push(KO_EVALUATE_FIELD_APPROACH_NOTE);
    parts.push(KO_EVALUATE_FIELD_REUSE_WHEN);
    parts.push(KO_EVALUATE_FIELD_WATCHOUTS);
    parts.push(KO_EVALUATE_FIELD_WORKFLOW_TAGS);
    parts.push(KO_EVALUATE_CALL_NOW);
    return parts.join("\n");
}
function appendSystemPromptHandoffSection(parts: string[], key: HandoffSectionKey, options: HandoffOptions, view: PreparedHandoffView): void {
    switch (key) {
        case "summary":
            if (options.include.summary && view.summary) {
                parts.push(`\n## Summary\n${view.summary}`);
            }
            break;
        case "currentState":
            parts.push(`\n## Current State\n${view.currentState}`);
            break;
        case "reuseWhen":
            if (options.snapshot.reuseWhen) {
                parts.push(`\n## Reuse When\n${options.snapshot.reuseWhen}`);
            }
            break;
        case "plans":
            if (options.include.plans && view.plans.length > 0) {
                parts.push(`\n## Plan\n${view.plans.map((plan) => `- ${plan}`).join("\n")}`);
            }
            break;
        case "process":
            if (options.include.process && view.sections.length > 0) {
                const items = view.sections.flatMap((section) => section.items.map((item) => `- ${section.lane}: ${item}`));
                parts.push(`\n## Process steps\n${items.join("\n")}`);
            }
            break;
        case "files":
            if (options.include.files && view.exploredFiles.length > 0) {
                parts.push(`\n## Files explored\n${view.exploredFiles.map((filePath) => `- ${filePath}`).join("\n")}`);
            }
            break;
        case "modifiedFiles":
            if (options.include.modifiedFiles && view.modifiedFiles.length > 0) {
                parts.push(`\n## Files modified\n${view.modifiedFiles.map((filePath) => `- ${filePath}`).join("\n")}`);
            }
            break;
        case "todos":
            if (options.include.todos && view.openTodos.length > 0) {
                parts.push(`\n## What still needs to be done\n${view.openTodos.map((todo) => `- ${todo}`).join("\n")}`);
            }
            break;
        case "violations":
            if (options.include.violations && view.violations.length > 0) {
                parts.push(`\n## Watchouts\n${view.violations.map((violation) => `- ${violation}`).join("\n")}`);
            }
            break;
        case "verification":
            if (options.snapshot.verificationSummary) {
                parts.push(`\n## Verification\n- ${options.snapshot.verificationSummary}`);
            }
            break;
        case "questions":
            if (options.include.questions && view.openQuestions.length > 0) {
                parts.push(`\n## Open questions\n${view.openQuestions.map((question) => `- ${question}`).join("\n")}`);
            }
            break;
        case "memo":
            if (options.memo.trim()) {
                parts.push(`\n## Memo\n${options.memo.trim()}`);
            }
            break;
    }
}
