import type { EventSubtypeKey } from "~domain/classification.js";
import type { TimelineEventRecord, TimelineLane } from "~domain/monitoring.js";
export type ExpandableTimelineLane = "exploration" | "implementation" | "coordination";
export interface EventSubtype {
    readonly key: EventSubtypeKey;
    readonly label: string;
    readonly icon?: string;
    readonly group?: string;
    readonly entityType?: string;
    readonly entityName?: string;
}
export interface TimelineLaneRow {
    readonly key: string;
    readonly baseLane: TimelineLane;
    readonly isSubtype: boolean;
    readonly subtypeKey?: EventSubtypeKey;
    readonly subtypeLabel?: string;
}
const EXPANDABLE_LANES = ["exploration", "implementation", "coordination"] as const satisfies readonly ExpandableTimelineLane[];
const SUBTYPE_DEFINITIONS: Record<EventSubtypeKey, {
    label: string;
    icon?: string;
}> = {
    read_file: { label: "Read file", icon: "📄" },
    glob_files: { label: "Glob files", icon: "🧭" },
    grep_code: { label: "Grep code", icon: "🔎" },
    web_search: { label: "Web search", icon: "🌐" },
    web_fetch: { label: "Web fetch", icon: "↗" },
    list_files: { label: "List files", icon: "📋" },
    shell_probe: { label: "Shell probe", icon: "⌘" },
    create_file: { label: "Create file", icon: "✚" },
    modify_file: { label: "Modify file", icon: "✎" },
    delete_file: { label: "Delete file", icon: "−" },
    rename_file: { label: "Rename file", icon: "⇄" },
    apply_patch: { label: "Apply patch", icon: "Δ" },
    run_command: { label: "Run command", icon: "▶" },
    run_test: { label: "Run test", icon: "🧪" },
    run_build: { label: "Run build", icon: "🏗" },
    run_lint: { label: "Run lint", icon: "🧹" },
    verify: { label: "Verify", icon: "✓" },
    rule_check: { label: "Rule check", icon: "⚑" },
    mcp_call: { label: "MCP call", icon: "⇆" },
    skill_use: { label: "Skill use", icon: "✦" },
    delegation: { label: "Delegation", icon: "↪" },
    handoff: { label: "Handoff", icon: "⇢" },
    bookmark: { label: "Bookmark", icon: "⌂" },
    uncategorized: { label: "Other", icon: "•" }
};
const SUBTYPE_ORDER: Record<ExpandableTimelineLane, readonly EventSubtypeKey[]> = {
    exploration: ["read_file", "glob_files", "grep_code", "list_files", "web_search", "web_fetch", "shell_probe", "uncategorized"],
    implementation: [
        "create_file",
        "modify_file",
        "apply_patch",
        "rename_file",
        "delete_file",
        "run_command",
        "run_test",
        "run_build",
        "run_lint",
        "verify",
        "rule_check",
        "uncategorized"
    ],
    coordination: ["mcp_call", "skill_use", "delegation", "handoff", "bookmark", "uncategorized"]
};
export function isExpandableLane(lane: TimelineLane): lane is ExpandableTimelineLane {
    return (EXPANDABLE_LANES as readonly string[]).includes(lane);
}
export function resolveEventSubtype(event: Pick<TimelineEventRecord, "semantic">): EventSubtype | null {
    const semantic = event.semantic;
    if (!semantic) {
        return null;
    }
    const icon = subtypeIcon(semantic.subtypeKey);
    return {
        key: semantic.subtypeKey,
        label: semantic.subtypeLabel,
        ...(icon ? { icon } : {}),
        ...(semantic.subtypeGroup ? { group: semantic.subtypeGroup } : {}),
        ...(semantic.entityType ? { entityType: semantic.entityType } : {}),
        ...(semantic.entityName ? { entityName: semantic.entityName } : {})
    };
}
export function countLaneSubtypes(events: readonly TimelineEventRecord[], lane: ExpandableTimelineLane): number {
    const unique = new Set<string>();
    let hasUncategorized = false;
    for (const event of events) {
        if (event.lane !== lane)
            continue;
        const subtype = resolveEventSubtype(event);
        if (subtype) {
            unique.add(subtype.key);
            continue;
        }
        hasUncategorized = true;
    }
    return unique.size + (hasUncategorized ? 1 : 0);
}
export function buildDisplayLaneRows(events: readonly TimelineEventRecord[], activeLanes: readonly TimelineLane[], expandedLanes: ReadonlySet<ExpandableTimelineLane>): readonly TimelineLaneRow[] {
    const rows: TimelineLaneRow[] = [];
    for (const lane of activeLanes) {
        if (!isExpandableLane(lane) || !expandedLanes.has(lane)) {
            rows.push({ key: lane, baseLane: lane, isSubtype: false });
            continue;
        }
        const laneEvents = events.filter((event) => event.lane === lane);
        const subtypeRows = buildSubtypeRowsForLane(laneEvents, lane);
        if (subtypeRows.length === 0) {
            rows.push({ key: lane, baseLane: lane, isSubtype: false });
            continue;
        }
        rows.push(...subtypeRows);
    }
    return rows;
}
export function resolveTimelineRowKey(event: TimelineEventRecord, expandedLanes: ReadonlySet<ExpandableTimelineLane>): string {
    if (!isExpandableLane(event.lane) || !expandedLanes.has(event.lane)) {
        return event.lane;
    }
    const subtype = resolveEventSubtype(event);
    return `${event.lane}:${subtype?.key ?? "uncategorized"}`;
}
function buildSubtypeRowsForLane(events: readonly TimelineEventRecord[], lane: ExpandableTimelineLane): readonly TimelineLaneRow[] {
    const subtypeMap = new Map<EventSubtypeKey, string>();
    let hasUncategorized = false;
    for (const event of events) {
        const subtype = resolveEventSubtype(event);
        if (!subtype) {
            hasUncategorized = true;
            continue;
        }
        subtypeMap.set(subtype.key, subtype.label);
    }
    const orderedEntries = [...subtypeMap.entries()].sort(([leftKey, leftLabel], [rightKey, rightLabel]) => {
        const order = SUBTYPE_ORDER[lane];
        const leftIndex = order.indexOf(leftKey);
        const rightIndex = order.indexOf(rightKey);
        if (leftIndex !== rightIndex) {
            return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex)
                - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
        }
        return leftLabel.localeCompare(rightLabel);
    });
    const rows = orderedEntries.map(([subtypeKey, subtypeLabel]) => ({
        key: `${lane}:${subtypeKey}`,
        baseLane: lane,
        isSubtype: true,
        subtypeKey,
        subtypeLabel
    }));
    if (hasUncategorized) {
        rows.push({
            key: `${lane}:uncategorized`,
            baseLane: lane,
            isSubtype: true,
            subtypeKey: "uncategorized",
            subtypeLabel: subtypeLabel("uncategorized")
        });
    }
    return rows;
}
function subtypeLabel(key: EventSubtypeKey): string {
    return SUBTYPE_DEFINITIONS[key].label;
}
function subtypeIcon(key: EventSubtypeKey): string | undefined {
    return SUBTYPE_DEFINITIONS[key].icon;
}
