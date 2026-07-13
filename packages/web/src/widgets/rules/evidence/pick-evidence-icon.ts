import { KIND, TERMINAL_COMMAND_TOOL_NAME } from "@monitor/kernel";
import type { RuleEvidenceEvent } from "~web/entities/rule/model/rule-evidence.js";

export function pickEvidenceIcon(ev: RuleEvidenceEvent): string {
  if (ev.filePath) {
    if (
      ev.kind === KIND.fileChanged ||
      ev.toolName === "Edit" ||
      ev.toolName === "Write"
    ) {
      return "✏️";
    }
    return "📖";
  }
  if (ev.command || ev.toolName === TERMINAL_COMMAND_TOOL_NAME) return "▶";
  if (ev.kind === KIND.userMessage) return "💬";
  if (ev.kind === KIND.assistantResponse) return "🗨️";
  if (ev.toolName === "WebFetch" || ev.toolName === "WebSearch") return "🌐";
  return "•";
}
