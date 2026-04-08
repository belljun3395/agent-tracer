import type { RuntimeAdapterId, RuntimeCapabilities } from "./runtime-capabilities.types.js";

export const RUNTIME_ADAPTER_IDS: readonly RuntimeAdapterId[] = [
  "claude-hook",
  "codex-skill",
  "opencode-bridge",
  "opencode-plugin",
  "opencode-sse"
] as const;

export const RUNTIME_CAPABILITIES_BY_ID: Record<RuntimeAdapterId, RuntimeCapabilities> = {
  "claude-hook": {
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
  "codex-skill": {
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
  "opencode-bridge": {
    adapterId: "opencode-bridge",
    canCaptureRawUserMessage: true,
    canObserveToolCalls: false,
    canObserveSubagents: false,
    hasNativeSkillDiscovery: false,
    hasEventStream: false,
    endTaskOnSessionClose: "primary-only",
    nativeSkillPaths: [],
    evidenceProfile: {
      defaultEvidence: "self_reported",
      summary: "OpenCode bridge mode captures prompts and assistant output through the local CLI bridge, but it does not have plugin-level automatic tool or subagent observation.",
      features: [
        {
          id: "raw_user_prompt",
          label: "Raw user prompts",
          evidence: "self_reported",
          note: "Recorded by the CLI bridge before launching OpenCode.",
          automatic: false
        },
        {
          id: "assistant_response",
          label: "Assistant responses",
          evidence: "self_reported",
          note: "Recorded from streamed CLI output after the bridge completes.",
          automatic: false
        },
        {
          id: "exploration_activity",
          label: "Read/search/web activity",
          evidence: "unavailable",
          note: "Bridge mode cannot independently observe internal OpenCode tool or search activity.",
          automatic: false
        },
        {
          id: "tool_activity",
          label: "Tool and shell activity",
          evidence: "unavailable",
          note: "No plugin hooks are available in bridge mode.",
          automatic: false
        },
        {
          id: "mcp_coordination",
          label: "MCP coordination",
          evidence: "unavailable",
          note: "Bridge mode does not observe MCP calls directly.",
          automatic: false
        },
        {
          id: "subagents_background",
          label: "Subagents / background",
          evidence: "unavailable",
          note: "Subagent/background lineage requires plugin/runtime hooks that bridge mode does not receive.",
          automatic: false
        }
      ]
    }
  },
  "opencode-plugin": {
    adapterId: "opencode-plugin",
    canCaptureRawUserMessage: true,
    canObserveToolCalls: true,
    canObserveSubagents: true,
    hasNativeSkillDiscovery: true,
    hasEventStream: false,
    endTaskOnSessionClose: "primary-only",
    nativeSkillPaths: [".agents/skills", ".claude/skills"],
    evidenceProfile: {
      defaultEvidence: "proven",
      summary: "OpenCode plugin hooks and event callbacks provide strong automatic evidence for prompts, tool activity, coordination, background work, and assistant turn completion.",
      features: [
        {
          id: "raw_user_prompt",
          label: "Raw user prompts",
          evidence: "proven",
          note: "chat.message is forwarded directly into canonical user.message records.",
          automatic: true
        },
        {
          id: "assistant_response",
          label: "Assistant responses",
          evidence: "proven",
          note: "message.updated emits assistant.response on completed turns.",
          automatic: true
        },
        {
          id: "exploration_activity",
          label: "Read/search/web activity",
          evidence: "proven",
          note: "Tool classification routes read/search/fetch behavior into explore events.",
          automatic: true
        },
        {
          id: "tool_activity",
          label: "Tool and shell activity",
          evidence: "proven",
          note: "tool.execute and command hooks classify file, shell, test, and build actions automatically.",
          automatic: true
        },
        {
          id: "mcp_coordination",
          label: "MCP coordination",
          evidence: "proven",
          note: "Configured MCP tool names are parsed and recorded as coordination activity.",
          automatic: true
        },
        {
          id: "subagents_background",
          label: "Subagents / background",
          evidence: "proven",
          note: "Background sessions and async tasks are linked from plugin state and callbacks.",
          automatic: true
        }
      ]
    }
  },
  "opencode-sse": {
    adapterId: "opencode-sse",
    canCaptureRawUserMessage: true,
    canObserveToolCalls: true,
    canObserveSubagents: true,
    hasNativeSkillDiscovery: true,
    hasEventStream: true,
    endTaskOnSessionClose: "primary-only",
    nativeSkillPaths: [".agents/skills", ".claude/skills"],
    evidenceProfile: {
      defaultEvidence: "proven",
      summary: "OpenCode SSE extends the plugin model with a dedicated event stream, preserving strong automatic evidence while adding richer streaming observability headroom.",
      features: [
        {
          id: "raw_user_prompt",
          label: "Raw user prompts",
          evidence: "proven",
          note: "Prompt capture remains automatic.",
          automatic: true
        },
        {
          id: "assistant_response",
          label: "Assistant responses",
          evidence: "proven",
          note: "Turn completion is derived from runtime events and SSE updates.",
          automatic: true
        },
        {
          id: "exploration_activity",
          label: "Read/search/web activity",
          evidence: "proven",
          note: "Exploration remains tool-observed and can be enriched by stream metadata.",
          automatic: true
        },
        {
          id: "tool_activity",
          label: "Tool and shell activity",
          evidence: "proven",
          note: "Tool and shell events are observed automatically.",
          automatic: true
        },
        {
          id: "mcp_coordination",
          label: "MCP coordination",
          evidence: "proven",
          note: "MCP coordination remains automatically classified.",
          automatic: true
        },
        {
          id: "subagents_background",
          label: "Subagents / background",
          evidence: "proven",
          note: "Background lineage is automatic and can be complemented by streaming state.",
          automatic: true
        }
      ]
    }
  }
};
