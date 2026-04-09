import { registerRuntimeAdapter, registerRuntimeAdapterAlias } from "./runtime-capabilities.constants.js";
import type { RuntimeCapabilities } from "./runtime-capabilities.types.js";

const DEFAULT_ADAPTERS: readonly RuntimeCapabilities[] = [
  {
    adapterId: "claude-plugin",
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
        }
      ]
    }
  }
];

const DEFAULT_ALIASES: readonly [string, string][] = [
  ["claude", "claude-plugin"],
  ["claude-code", "claude-plugin"],
  ["claude-hook", "claude-plugin"],
  ["claude-plugin", "claude-plugin"]
];

export function registerDefaultRuntimeAdapters(): void {
  for (const adapter of DEFAULT_ADAPTERS) {
    registerRuntimeAdapter(adapter);
  }
  for (const [alias, adapterId] of DEFAULT_ALIASES) {
    registerRuntimeAdapterAlias(alias, adapterId);
  }
}

export const RUNTIME_ADAPTER_IDS: readonly string[] = DEFAULT_ADAPTERS.map((adapter) => adapter.adapterId);
