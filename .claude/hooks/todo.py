#!/usr/bin/env python3
"""PostToolUse hook: records TodoWrite tool calls as todo lifecycle events.

Fires after each TodoWrite call. Maps Claude Code todo statuses to monitor states
and posts each todo as a /api/todo event with a stable content-based todoId.
"""

import hashlib
import json
import os
import sys
import urllib.request

API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"
PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
OPENCODE_RUNTIME = bool(os.environ.get("OPENCODE") or os.environ.get("OPENCODE_CLIENT"))
CLAUDE_RUNTIME = bool(os.environ.get("CLAUDE_PROJECT_DIR")) and not OPENCODE_RUNTIME

STATUS_MAP = {
    "pending":     "added",
    "in_progress": "in_progress",
    "completed":   "completed",
    "cancelled":   "cancelled",
}


def _todo_id(content: str, priority: str) -> str:
    return hashlib.sha1(f"{content}::{priority}".encode()).hexdigest()[:16]


def _post(path: str, body: dict) -> None:
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=2)


def _get_ids(runtime_session_id: str) -> tuple[str, str]:
    req = urllib.request.Request(
        f"{API_BASE}/api/runtime-session-ensure",
        data=json.dumps({
            "runtimeSource":    "claude-hook",
            "runtimeSessionId": runtime_session_id,
            "title":            f"Claude Code — {os.path.basename(PROJECT_DIR)}",
            "workspacePath":    PROJECT_DIR,
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
        event              = json.load(sys.stdin)
        tool_input         = event.get("tool_input", {})
        runtime_session_id = (event.get("session_id") or "").strip()
    except Exception:
        return

    todos = tool_input.get("todos") if isinstance(tool_input.get("todos"), list) else []
    if not todos or not runtime_session_id:
        return

    try:
        task_id, session_id = _get_ids(runtime_session_id)
    except Exception:
        return

    for todo in todos:
        if not isinstance(todo, dict):
            continue
        content  = str(todo.get("content") or "").strip()
        status   = str(todo.get("status") or "pending").strip()
        priority = str(todo.get("priority") or "medium").strip()
        if not content:
            continue

        todo_state = STATUS_MAP.get(status, "added")
        todo_id    = _todo_id(content, priority)

        try:
            _post("/api/todo", {
                "taskId":    task_id,
                "sessionId": session_id,
                "todoId":    todo_id,
                "todoState": todo_state,
                "title":     content,
                "metadata":  {"priority": priority, "status": status},
            })
        except Exception:
            pass


main()
