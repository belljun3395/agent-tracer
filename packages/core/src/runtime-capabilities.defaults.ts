import { registerRuntimeAdapter, registerRuntimeAdapterAlias } from "./runtime-capabilities.constants.js";
import type { RuntimeCapabilities } from "./runtime-capabilities.types.js";

const DEFAULT_ADAPTERS: readonly RuntimeCapabilities[] = [
  {
    adapterId: "claude-hook",
    canCaptureRawUserMessage: true,
    canObserveToolCalls: true,
    canObserveSubagents: true,
    hasNativeSkillDiscovery: true,
    hasEventStream: false,
    endTaskOnSessionClose: "never",
    nativeSkillPaths: [".claude/skills"],
    evidenceProfile: {
      defaultEvidence: "proven",
      summary: "Claude hooks provide mechanically observed prompts, tool usage, MCP coordination, subagent lifecycle, and assistant responses.",
      features: [
        {
          id: "raw_user_prompt",
          label: "Raw user prompts",
          evidence: "proven",
          note: "Captured directly from Claude hook payloads.",
          automatic: true
        },
        {
          id: "assistant_response",
          label: "Assistant responses",
          evidence: "proven",
          note: "Recorded from the Stop hook before the turn is closed.",
          automatic: true
        },
        {
          id: "exploration_activity",
          label: "Read/search/web activity",
          evidence: "proven",
          note: "Read, grep, glob, WebSearch, and WebFetch can be observed by hooks.",
          automatic: true
        },
        {
          id: "tool_activity",
          label: "Tool and shell activity",
          evidence: "proven",
          note: "Tool hooks capture edits, Bash usage, and file-oriented tools.",
          automatic: true
        },
        {
          id: "mcp_coordination",
          label: "MCP coordination",
          evidence: "proven",
          note: "MCP tool names are parsed and logged from tool hooks.",
          automatic: true
        },
        {
          id: "subagents_background",
          label: "Subagents / background",
          evidence: "proven",
          note: "Subagent lifecycle hooks emit async task transitions automatically.",
          automatic: true
        }
      ]
    }
  },
  {
    adapterId: "codex-skill",
    canCaptureRawUserMessage: true,
    canObserveToolCalls: false,
    canObserveSubagents: false,
    hasNativeSkillDiscovery: true,
    hasEventStream: false,
    endTaskOnSessionClose: "never",
    nativeSkillPaths: [".agents/skills"],
    evidenceProfile: {
      defaultEvidence: "self_reported",
      summary: "Codex relies on the codex-monitor skill and explicit monitor MCP calls, so most observability is cooperative self-reporting rather than independent runtime capture.",
      features: [
        {
          id: "raw_user_prompt",
          label: "Raw user prompts",
          evidence: "self_reported",
          note: "The skill explicitly records the prompt via monitor_user_message.",
          automatic: false
        },
        {
          id: "assistant_response",
          label: "Assistant responses",
          evidence: "self_reported",
          note: "The skill emits assistant.response before ending the turn.",
          automatic: false
        },
        {
          id: "exploration_activity",
          label: "Read/search/web activity",
          evidence: "self_reported",
          note: "Exploration is visible only when the skill (or agent) logs monitor_explore events.",
          automatic: false
        },
        {
          id: "tool_activity",
          label: "Tool and shell activity",
          evidence: "self_reported",
          note: "Tool usage, terminal commands, and verify steps depend on explicit monitor_* calls.",
          automatic: false
        },
        {
          id: "mcp_coordination",
          label: "MCP coordination",
          evidence: "self_reported",
          note: "MCP usage can be logged semantically, but Codex does not auto-observe it.",
          automatic: false
        },
        {
          id: "subagents_background",
          label: "Subagents / background",
          evidence: "self_reported",
          note: "Background lineage exists only if the active skill emits async-task and task-link events.",
          automatic: false
        }
      ]
    }
  },
];

const DEFAULT_ALIASES: readonly [string, string][] = [
  ["claude", "claude-hook"],
  ["claude-code", "claude-hook"],
  ["claude-hook", "claude-hook"],
  ["codex", "codex-skill"],
  ["codex-cli", "codex-skill"],
  ["codex-skill", "codex-skill"],
  ["manual-mcp", "codex-skill"],
  ["seed-script", "codex-skill"]
];

/**
 * Registers all default runtime adapters and aliases.
 * Call this once during application initialization.
 */
export function registerDefaultRuntimeAdapters(): void {
  for (const adapter of DEFAULT_ADAPTERS) {
    registerRuntimeAdapter(adapter);
  }
  for (const [alias, adapterId] of DEFAULT_ALIASES) {
    registerRuntimeAdapterAlias(alias, adapterId);
  }
}

/**
 * Convenience export of default adapter IDs for backwards compatibility.
 */
export const RUNTIME_ADAPTER_IDS: readonly string[] = DEFAULT_ADAPTERS.map((a) => a.adapterId);
