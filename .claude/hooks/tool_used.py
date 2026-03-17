#!/usr/bin/env python3
"""PostToolUse hook: records Edit/Write tool events (implementation lane)."""

import json
import os
import sys
import urllib.request

API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"
PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
OPENCODE_RUNTIME = bool(os.environ.get("OPENCODE") or os.environ.get("OPENCODE_CLIENT"))
CLAUDE_RUNTIME = bool(os.environ.get("CLAUDE_PROJECT_DIR")) and not OPENCODE_RUNTIME


def _rel(path: str) -> str:
    if path.startswith(PROJECT_DIR):
        return path[len(PROJECT_DIR):].lstrip("/")
    return path


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
        tool_name     = event.get("tool_name", "")
        tool_input    = event.get("tool_input", {})
        cc_session_id = (event.get("session_id") or "").strip()
    except Exception:
        return

    if not cc_session_id:
        return

    fp = (
        tool_input.get("file_path")
        or tool_input.get("path")
        or tool_input.get("pattern")
        or ""
    )

    try:
        task_id, session_id = _get_ids(cc_session_id)
    except Exception:
        return

    rel   = _rel(fp) if fp else ""
    title = f"{tool_name}: {os.path.basename(rel)}" if rel else tool_name
    body  = f"Modified {rel}" if rel else f"Used {tool_name}"

    try:
        _post("/api/tool-used", {
            "taskId":    task_id,
            "sessionId": session_id,
            "toolName":  tool_name,
            "title":     title,
            "body":      body,
            "lane":      "implementation",
            "filePaths": [fp] if fp else [],
            "metadata":  {"filePath": fp, "relPath": rel},
        })
    except Exception:
        pass


main()
