import { buildReusableTaskSnapshot } from "./snapshot.js";
const WORKFLOW_CONTEXT_LANES = [
    "exploration",
    "implementation",
    "questions",
    "todos",
    "background",
    "coordination"
];
const LANE_TITLES = {
    user: "User Interactions",
    exploration: "Exploration",
    planning: "Planning",
    implementation: "Implementation",
    questions: "Questions",
    todos: "TODOs",
    background: "Background",
    coordination: "Coordination"
};
const GENERIC_CONTEXT_TITLES = new Set([
    "action logged",
    "agent activity",
    "assistant response",
    "context saved",
    "plan updated",
    "terminal command",
    "thought",
    "tool used",
    "user message",
    "verification",
    "workflow note"
]);
/**
 * Builds the reusable markdown context block used to summarize a task workflow.
 */
export function buildWorkflowContext(events, taskTitle, evaluation, snapshotOverride) {
    const snapshot = snapshotOverride ?? buildReusableTaskSnapshot({
        objective: taskTitle,
        events,
        ...(evaluation !== undefined ? { evaluation } : {})
    });
    const parts = [`# Workflow: ${taskTitle}`];
    parts.push(...buildSnapshotSections(snapshot, evaluation));
    const planSection = buildPlanSection(events);
    if (planSection) {
        parts.push(planSection);
    }
    parts.push(...buildLaneSections(events));
    const modifiedFilesSection = buildModifiedFilesSection(events);
    if (modifiedFilesSection) {
        parts.push(modifiedFilesSection);
    }
    const openTodoSection = buildOpenTodoSection(events);
    if (openTodoSection) {
        parts.push(openTodoSection);
    }
    const verificationSummarySection = buildVerificationSummarySection(events);
    if (verificationSummarySection) {
        parts.push(verificationSummarySection);
    }
    return parts.join("");
}
/**
 * Expands snapshot and evaluation fields into the top-level markdown sections.
 */
function buildSnapshotSections(snapshot, evaluation) {
    const sections = [];
    if (snapshot.originalRequest) {
        sections.push(`\n## Original Request\n${snapshot.originalRequest}`);
    }
    if (evaluation?.useCase) {
        sections.push(`\n## Use Case\n${evaluation.useCase}`);
    }
    if (snapshot.outcomeSummary) {
        sections.push(`\n## Outcome\n${snapshot.outcomeSummary}`);
    }
    if (snapshot.approachSummary) {
        sections.push(`\n## What Worked\n${snapshot.approachSummary}`);
    }
    if (snapshot.reuseWhen) {
        sections.push(`\n## Reuse When\n${snapshot.reuseWhen}`);
    }
    if (snapshot.keyDecisions.length > 0) {
        sections.push(`\n## Key Decisions\n${snapshot.keyDecisions.map((item) => `- ${item}`).join("\n")}`);
    }
    if (snapshot.nextSteps.length > 0) {
        sections.push(`\n## Next Steps\n${snapshot.nextSteps.map((item) => `- ${item}`).join("\n")}`);
    }
    if (snapshot.watchItems.length > 0) {
        sections.push(`\n## Watchouts\n${snapshot.watchItems.map((item) => `- ${item}`).join("\n")}`);
    }
    if (snapshot.keyFiles.length > 0) {
        sections.push(`\n## Key Files\n${snapshot.keyFiles.map((filePath) => `- \`${filePath}\``).join("\n")}`);
    }
    if (snapshot.verificationSummary) {
        sections.push(`\n## Verification Snapshot\n- ${snapshot.verificationSummary}`);
    }
    return sections;
}
/**
 * Renders planning-lane events as the workflow's explicit plan section.
 */
export function buildPlanSection(events) {
    const planEvents = events.filter((event) => event.lane === "planning");
    if (planEvents.length === 0) {
        return undefined;
    }
    const lines = planEvents
        .map((event) => describeWorkflowEvent(event))
        .filter((value) => Boolean(value));
    if (lines.length === 0) {
        return undefined;
    }
    return `\n## Plan\n${lines.map((line) => `- ${line}`).join("\n")}`;
}
/**
 * Groups non-planning events into lane-specific markdown sections.
 */
export function buildLaneSections(events) {
    const sections = [];
    for (const lane of WORKFLOW_CONTEXT_LANES) {
        const laneEvents = events.filter((event) => event.lane === lane);
        if (laneEvents.length === 0) {
            continue;
        }
        const title = LANE_TITLES[lane] ?? lane;
        const lines = laneEvents
            .map((event) => describeWorkflowEvent(event))
            .filter((value) => Boolean(value));
        if (lines.length === 0) {
            continue;
        }
        sections.push(`\n## ${title}\n${lines.map((line) => `- ${line}`).join("\n")}`);
    }
    return sections;
}
/**
 * Lists files that were actually written during the workflow.
 */
export function buildModifiedFilesSection(events) {
    const modifiedFiles = [...new Set(events
            .filter((event) => event.kind === "file.changed" && (event.metadata["writeCount"] ?? 0) > 0)
            .map((event) => event.metadata["filePath"] ?? event.title)
            .filter((filePath) => Boolean(filePath)))];
    if (modifiedFiles.length === 0) {
        return undefined;
    }
    return `\n## Modified Files\n${modifiedFiles.map((filePath) => `- \`${filePath}\``).join("\n")}`;
}
/**
 * Surfaces TODO items that remain unresolved at the end of the workflow.
 */
export function buildOpenTodoSection(events) {
    const openTodos = events
        .filter((event) => event.kind === "todo.logged")
        .filter((event) => {
        const state = event.metadata["todoState"];
        return state !== "completed" && state !== "cancelled";
    });
    const latestTodoByTitle = new Map();
    for (const event of openTodos) {
        latestTodoByTitle.set(event.title, event.metadata["todoState"] ?? "added");
    }
    const openTodoTitles = [...latestTodoByTitle.entries()]
        .filter(([, state]) => state !== "completed" && state !== "cancelled")
        .map(([title]) => title);
    if (openTodoTitles.length === 0) {
        return undefined;
    }
    return `\n## Open TODOs\n${openTodoTitles.map((title) => `- ${title}`).join("\n")}`;
}
/**
 * Summarizes verification and rule outcomes, including any failing checks.
 */
export function buildVerificationSummarySection(events) {
    const verifications = events.filter((event) => event.kind === "verification.logged" || event.kind === "rule.logged");
    if (verifications.length === 0) {
        return undefined;
    }
    const failCount = verifications.filter((event) => event.metadata["verificationStatus"] === "fail" || event.metadata["ruleStatus"] === "violation").length;
    const passCount = verifications.length - failCount;
    const summary = [`\n## Verification Summary\n- Checks: ${verifications.length} (${passCount} pass, ${failCount} fail)`];
    const violations = verifications.filter((event) => event.metadata["verificationStatus"] === "fail" || event.metadata["ruleStatus"] === "violation");
    if (violations.length > 0) {
        summary.push(violations.map((event) => `- [FAIL] ${event.title}`).join("\n"));
    }
    return summary.join("\n");
}
/**
 * Collapses an event into a single readable line for markdown sections.
 */
function describeWorkflowEvent(event) {
    const title = normalizeContextText(event.title);
    const detail = normalizeContextText(stringMetadata(event, "description")
        ?? stringMetadata(event, "command")
        ?? stringMetadata(event, "action")
        ?? event.body);
    if (!title && !detail) {
        return null;
    }
    if (!detail) {
        return title;
    }
    if (!title || title === detail || shouldPreferDetailOnly(event, title)) {
        return detail;
    }
    return `${title}: ${detail}`;
}
/**
 * Drops generic titles when the detail field communicates the event more clearly.
 */
function shouldPreferDetailOnly(event, title) {
    if (event.kind === "context.saved" || event.kind === "terminal.command") {
        return true;
    }
    return GENERIC_CONTEXT_TITLES.has(title.toLocaleLowerCase());
}
/**
 * Normalizes whitespace so stored context lines remain compact and readable.
 */
function normalizeContextText(value) {
    if (!value) {
        return null;
    }
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized || null;
}
/**
 * Reads a string metadata field without forcing callers to repeat type checks.
 */
function stringMetadata(event, key) {
    const value = event.metadata[key];
    return typeof value === "string" ? value : null;
}
//# sourceMappingURL=context.js.map