export const EVENT_SUBTYPE_KEYS = [
  'read_file',
  'glob_files',
  'grep_code',
  'list_files',
  'web_search',
  'web_fetch',
  'shell_probe',
  'create_file',
  'modify_file',
  'delete_file',
  'rename_file',
  'apply_patch',
  'run_command',
  'run_test',
  'run_build',
  'run_lint',
  'verify',
  'rule_check',
  'mcp_call',
  'skill_use',
  'delegation',
  'handoff',
  'bookmark',
  'uncategorized',
] as const

export type EventSubtypeKey = typeof EVENT_SUBTYPE_KEYS[number]

export interface TimelineEventSemantic {
  readonly subtypeKey: EventSubtypeKey
  readonly subtypeLabel: string
  readonly subtypeGroup?: string
  readonly entityType?: string
  readonly entityName?: string
}

export function isKnownEventSubtypeKey(value: string): value is EventSubtypeKey {
  return (EVENT_SUBTYPE_KEYS as readonly string[]).includes(value)
}
