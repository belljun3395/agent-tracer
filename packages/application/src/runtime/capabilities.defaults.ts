import { registerRuntimeAdapter, registerRuntimeAdapterAlias } from "./capabilities.constants.js";
import { CLAUDE_PLUGIN_ADAPTER_ID, type RuntimeAdapterId, type RuntimeCapabilities } from "@monitor/domain";

const DEFAULT_ADAPTERS: readonly RuntimeCapabilities[] = [
  {
    adapterId: CLAUDE_PLUGIN_ADAPTER_ID,
    canCaptureRawUserMessage: true,
    canObserveToolCalls: true,
    canObserveSubagents: true,
    hasNativeSkillDiscovery: true,
    hasEventStream: false,
    endTaskOnSessionClose: "never",
    nativeSkillPaths: [".claude/skills"],
    evidenceProfile: {
      defaultEvidence: "proven",
      summary:
        "Claude plugin hooks provide mechanically observed prompts, tool usage, MCP coordination, subagent lifecycle, and assistant responses.",
      features: [
        {
          id: "raw_user_prompt",
          label: "Raw user prompts",
          evidence: "proven",
          note: "Captured directly from Claude plugin hook payloads.",
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
        },
        {
          id: "todo_tracking",
          label: "Todo tracking",
          evidence: "proven",
          note: "Todo changes are observed mechanically via the TodoWrite PostToolUse hook.",
          automatic: true
        },
        {
          id: "context_checkpoints",
          label: "Context checkpoints",
          evidence: "proven",
          note: "SessionStart attachments, PreCompact, and PostCompact hooks capture context events automatically.",
          automatic: true
        },
        {
          id: "agent_thinking",
          label: "Agent thinking",
          evidence: "proven",
          note: "Thinking blocks are read directly from the transcript JSONL tail by the Stop hook.",
          automatic: true
        },
        {
          id: "instruction_context",
          label: "Instruction context",
          evidence: "proven",
          note: "Instruction deltas, skill listings, and MCP instructions are parsed from transcript attachments.",
          automatic: true
        },
        {
          id: "session_lifecycle",
          label: "Session lifecycle",
          evidence: "proven",
          note: "SessionStart and SessionEnd hooks bound every session with an emitted lifecycle event.",
          automatic: true
        }
      ]
    }
  }
];

const DEFAULT_ALIASES: readonly [string, RuntimeAdapterId][] = [
  ["claude", CLAUDE_PLUGIN_ADAPTER_ID],
  ["claude-code", CLAUDE_PLUGIN_ADAPTER_ID],
  ["claude-hook", CLAUDE_PLUGIN_ADAPTER_ID],
  ["claude-plugin", CLAUDE_PLUGIN_ADAPTER_ID]
];

/**
 * Seeds the runtime registry with the package's built-in adapter definitions and aliases.
 */
export function registerDefaultRuntimeAdapters(): void {
  for (const adapter of DEFAULT_ADAPTERS) {
    registerRuntimeAdapter(adapter);
  }
  for (const [alias, adapterId] of DEFAULT_ALIASES) {
    registerRuntimeAdapterAlias(alias, adapterId);
  }
}

export const RUNTIME_ADAPTER_IDS: readonly RuntimeAdapterId[] = DEFAULT_ADAPTERS.map((adapter) => adapter.adapterId);
