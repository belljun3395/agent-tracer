/**
 * Shared contract for event semantic metadata produced by hook/plugin preprocessing
 * and consumed by the web UI for subtype rendering.
 *
 * Hook implementations classify raw tool/command activity into a known subtype key
 * plus descriptive metadata. The web UI maps the same keys to labels and icons.
 * Adding a new subtype requires updating this file so both producers and consumers
 * stay in sync.
 */

export const EVENT_SUBTYPE_KEYS = [
  // exploration / search
  "read_file",
  "glob_files",
  "grep_code",
  "list_files",
  "web_search",
  "web_fetch",
  "shell_probe",
  // implementation / file_ops
  "create_file",
  "modify_file",
  "delete_file",
  "rename_file",
  "apply_patch",
  // implementation / execution
  "run_command",
  "run_test",
  "run_build",
  "run_lint",
  "verify",
  "rule_check",
  // coordination
  "mcp_call",
  "skill_use",
  "delegation",
  "handoff",
  "bookmark",
  // fallback
  "uncategorized"
] as const;

export type EventSubtypeKey = typeof EVENT_SUBTYPE_KEYS[number];

export type EventSubtypeGroup =
  | "files"
  | "search"
  | "web"
  | "shell"
  | "file_ops"
  | "execution"
  | "coordination";

export type EventToolFamily = "explore" | "file" | "terminal" | "coordination";

export interface EventSemanticMetadata {
  readonly subtypeKey: EventSubtypeKey;
  readonly subtypeLabel?: string;
  readonly subtypeGroup: EventSubtypeGroup;
  readonly toolFamily: EventToolFamily;
  readonly operation: string;
  readonly entityType?: string;
  readonly entityName?: string;
  readonly sourceTool?: string;
  readonly importance?: string;
}

/**
 * Validates that a subtype key belongs to the shared event-semantic contract.
 */
export function isKnownEventSubtypeKey(value: string): value is EventSubtypeKey {
  return (EVENT_SUBTYPE_KEYS as readonly string[]).includes(value);
}
