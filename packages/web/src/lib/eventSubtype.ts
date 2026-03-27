import type { TimelineEvent, TimelineLane } from "../types.js";

export type ExpandableTimelineLane = "exploration" | "implementation" | "coordination";

export interface EventSubtype {
  readonly key: string;
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
  readonly subtypeKey?: string;
  readonly subtypeLabel?: string;
}

const EXPANDABLE_LANES = ["exploration", "implementation", "coordination"] as const satisfies readonly ExpandableTimelineLane[];

const SUBTYPE_DEFINITIONS: Record<string, { label: string; icon?: string }> = {
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

const SUBTYPE_ORDER: Record<ExpandableTimelineLane, readonly string[]> = {
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

export function resolveEventSubtype(event: Pick<TimelineEvent, "lane" | "metadata" | "title">): EventSubtype | null {
  const explicitKey = extractMetadataString(event.metadata, "subtypeKey");
  if (explicitKey) {
    return {
      key: explicitKey,
      label: extractMetadataString(event.metadata, "subtypeLabel") ?? subtypeLabel(explicitKey),
      icon: subtypeIcon(explicitKey),
      group: extractMetadataString(event.metadata, "subtypeGroup") ?? undefined,
      entityType: extractMetadataString(event.metadata, "entityType") ?? undefined,
      entityName: extractMetadataString(event.metadata, "entityName") ?? undefined
    };
  }

  const legacyKey = inferLegacySubtypeKey(event);
  if (!legacyKey) {
    return null;
  }

  return {
    key: legacyKey,
    label: subtypeLabel(legacyKey),
    icon: subtypeIcon(legacyKey),
    group: undefined,
    entityType: extractMetadataString(event.metadata, "entityType") ?? undefined,
    entityName: extractMetadataString(event.metadata, "entityName") ?? undefined
  };
}

export function countLaneSubtypes(
  events: readonly TimelineEvent[],
  lane: ExpandableTimelineLane
): number {
  const unique = new Set<string>();
  let hasUncategorized = false;

  for (const event of events) {
    if (event.lane !== lane) continue;
    const subtype = resolveEventSubtype(event);
    if (subtype) {
      unique.add(subtype.key);
      continue;
    }
    hasUncategorized = true;
  }

  return unique.size + (hasUncategorized ? 1 : 0);
}

export function buildDisplayLaneRows(
  events: readonly TimelineEvent[],
  activeLanes: readonly TimelineLane[],
  expandedLanes: ReadonlySet<ExpandableTimelineLane>
): readonly TimelineLaneRow[] {
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

export function resolveTimelineRowKey(
  event: TimelineEvent,
  expandedLanes: ReadonlySet<ExpandableTimelineLane>
): string {
  if (!isExpandableLane(event.lane) || !expandedLanes.has(event.lane)) {
    return event.lane;
  }

  const subtype = resolveEventSubtype(event);
  return `${event.lane}:${subtype?.key ?? "uncategorized"}`;
}

function buildSubtypeRowsForLane(
  events: readonly TimelineEvent[],
  lane: ExpandableTimelineLane
): readonly TimelineLaneRow[] {
  const subtypeMap = new Map<string, string>();
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

function inferLegacySubtypeKey(event: Pick<TimelineEvent, "lane" | "metadata" | "title">): string | null {
  const toolName = extractMetadataString(event.metadata, "toolName");
  const command = extractMetadataString(event.metadata, "command");
  const activityType = extractMetadataString(event.metadata, "activityType");
  const candidate = [toolName, command, activityType, event.title].find((value) => value && value.length > 0);
  const normalized = normalizeCandidate(candidate);
  if (!normalized) {
    return null;
  }

  if (event.lane === "coordination" && activityType) {
    return activityType;
  }

  if (event.lane === "exploration") {
    if (normalized.includes("websearch")) return "web_search";
    if (normalized.includes("fetch") || normalized.includes("browse")) return "web_fetch";
    if (normalized.includes("read") || normalized.includes("open") || normalized.includes("view")) return "read_file";
    if (normalized.includes("glob")) return "glob_files";
    if (normalized.includes("grep") || normalized.includes("search")) return "grep_code";
    if (normalized.includes("list") || normalized.includes("tree")) return "list_files";
    if (normalized.includes("bash") || normalized.includes("shell") || normalized.includes("command")) return "shell_probe";
  }

  if (event.lane === "implementation") {
    if (normalized.includes("patch")) return "apply_patch";
    if (normalized.includes("rename") || normalized.includes("move")) return "rename_file";
    if (normalized.includes("delete") || normalized.includes("remove")) return "delete_file";
    if (normalized.includes("create") || normalized.includes("write")) return "create_file";
    if (normalized.includes("edit") || normalized.includes("modify") || normalized.includes("update")) return "modify_file";
    if (normalized.includes("test")) return "run_test";
    if (normalized.includes("build")) return "run_build";
    if (normalized.includes("lint") || normalized.includes("format")) return "run_lint";
    if (normalized.includes("verify") || normalized.includes("check")) return "verify";
    if (normalized.includes("rule") || normalized.includes("policy")) return "rule_check";
    if (normalized.includes("bash") || normalized.includes("command")) return "run_command";
  }

  return null;
}

function subtypeLabel(key: string): string {
  return SUBTYPE_DEFINITIONS[key]?.label ?? humanizeSubtypeKey(key);
}

function subtypeIcon(key: string): string | undefined {
  return SUBTYPE_DEFINITIONS[key]?.icon;
}

function extractMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function humanizeSubtypeKey(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeCandidate(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[\s_-]+/g, "");
}

