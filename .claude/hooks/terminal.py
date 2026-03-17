#!/usr/bin/env python3
"""PostToolUse hook: records Bash command events to Baden.

Classifies commands as either:
  - "rules"  lane: test / build / lint / typecheck / commit / push
  - "implementation" lane: everything else

Also emits a thought (planning lane) event from the Bash description field.
"""

import json
import os
import sys
import urllib.request

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
TASK_FILE   = os.path.join(PROJECT_DIR, ".claude", ".current-task-id")
API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"

MAX_CMD_LEN = 500

# Keywords that indicate verification / quality-check activity → "rules" lane
RULES_PATTERNS = (
    "npm test", "npm run test", "npm run build", "npm run typecheck",
    "npm run lint", "npm run check", "pnpm test", "pnpm build",
    "pnpm lint", "vitest", "jest", "mocha", "pytest", "tsc ",
    "eslint", "biome", "prettier", "git commit", "git push",
    "gh pr", "npx tsc", "make test", "make build",
)


def _lane(command: str) -> str:
    lower = command.lower().strip()
    for pattern in RULES_PATTERNS:
        if lower.startswith(pattern) or f" {pattern}" in lower or f"&&{pattern}" in lower:
            return "rules"
    return "implementation"


def main() -> None:
    if not os.path.exists(TASK_FILE):
        return

    try:
        event      = json.load(sys.stdin)
        tool_input = event.get("tool_input", {})
        command    = tool_input.get("command", "").strip()
        desc       = tool_input.get("description", "").strip()
    except Exception:
        return

    if not command:
        return

    try:
        with open(TASK_FILE) as f:
            raw = f.read().strip()
        task_id, _, session_id = raw.partition(":")
    except Exception:
        return

    lane  = _lane(command)
    title = desc or command[:80]
    body  = command if not desc else f"{desc}\n\n$ {command[:300]}"

    payload = json.dumps({
        "taskId":    task_id,
        "sessionId": session_id,
        "command":   command[:MAX_CMD_LEN],
        "title":     title,
        "body":      body,
        "lane":      lane,
        "metadata":  {"description": desc},
    }).encode()

    try:
        req = urllib.request.Request(
            f"{API_BASE}/api/terminal-command",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass

    # If the command has a description, also emit a planning thought so
    # the intent behind each action is visible in the Planning lane.
    if not desc:
        return

    thought_payload = json.dumps({
        "taskId":    task_id,
        "sessionId": session_id,
        "title":     desc,
        "body":      f"Intent: {desc}\nAction: $ {command[:200]}",
        "lane":      "planning",
        "metadata":  {"command": command[:200]},
    }).encode()
    try:
        thought_req = urllib.request.Request(
            f"{API_BASE}/api/save-context",
            data=thought_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(thought_req, timeout=2)
    except Exception:
        pass


main()
