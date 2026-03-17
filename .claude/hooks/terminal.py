#!/usr/bin/env python3
"""PostToolUse hook: records Bash command events (implementation or rules lane)."""

import json
import os
import sys
import urllib.request

API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"
PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
MAX_CMD_LEN = 500
CLAUDE_RUNTIME = bool(os.environ.get("CLAUDE_PROJECT_DIR"))

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


def _post(path: str, body: dict) -> None:
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=2)


def _get_ids(cc_session_id: str) -> tuple[str, str]:
    req = urllib.request.Request(
        f"{API_BASE}/api/cc-session-ensure",
        data=json.dumps({
            "ccSessionId":   cc_session_id,
            "title":         f"Claude Code — {os.path.basename(PROJECT_DIR)}",
            "workspacePath": PROJECT_DIR,
        }).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=2) as resp:
        data = json.loads(resp.read())
    return data["taskId"], data["sessionId"]


def main() -> None:
    if not CLAUDE_RUNTIME:
        return

    try:
        event         = json.load(sys.stdin)
        tool_input    = event.get("tool_input", {})
        command       = tool_input.get("command", "").strip()
        desc          = tool_input.get("description", "").strip()
        cc_session_id = (event.get("session_id") or "").strip()
    except Exception:
        return

    if not command or not cc_session_id:
        return

    try:
        task_id, session_id = _get_ids(cc_session_id)
    except Exception:
        return

    lane  = _lane(command)
    title = desc or command[:80]
    body  = command if not desc else f"{desc}\n\n$ {command[:300]}"

    try:
        _post("/api/terminal-command", {
            "taskId":    task_id,
            "sessionId": session_id,
            "command":   command[:MAX_CMD_LEN],
            "title":     title,
            "body":      body,
            "lane":      lane,
            "metadata":  {"description": desc},
        })
    except Exception:
        pass

    if not desc:
        return

    try:
        _post("/api/save-context", {
            "taskId":    task_id,
            "sessionId": session_id,
            "title":     desc,
            "body":      f"Intent: {desc}\nAction: $ {command[:200]}",
            "lane":      "planning",
            "metadata":  {"command": command[:200]},
        })
    except Exception:
        pass


main()
