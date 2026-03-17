#!/usr/bin/env python3
"""PreToolUse hook: ensures a monitoring task and session are active.

Behavior:
  - No task file → create new task + session, write "taskId:sessionId"
  - Task file with active sessionId ("taskId:sessionId") → return early (session running)
  - Task file with cleared sessionId ("taskId:") → start a new session under the
    existing task, update file to "taskId:newSessionId"

Raw user prompt capture is NOT available from Claude Code hook payloads.
A rule event with ruleId="user-message-capture-unavailable" is emitted each
time a new session starts so the gap is explicit in the timeline.

Silently skips if the monitor server is not running.

File format while session is active: "taskId:sessionId"
File format between turns (after session-end): "taskId:"
"""

import json
import os
import sys
import urllib.error
import urllib.request

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
TASK_FILE   = os.path.join(PROJECT_DIR, ".claude", ".current-task-id")
API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"


def _post(path: str, body: dict) -> dict:
    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=2) as resp:
        return json.loads(resp.read())


def _emit_gap_rule(task_id: str, session_id: str) -> None:
    """Raw prompt capture unavailable — record explicit gap signal."""
    try:
        _post("/api/rule", {
            "taskId":    task_id,
            "sessionId": session_id,
            "action":    "user_message_capture_check",
            "ruleId":    "user-message-capture-unavailable",
            "severity":  "info",
            "status":    "gap",
            "source":    "claude-hook",
            "title":     "Raw user prompt capture unavailable",
            "body":      (
                "Claude Code hook payloads do not expose raw user prompt text. "
                "User messages cannot be captured as raw user.message events from this runtime."
            ),
        })
    except Exception:
        pass


def main() -> None:
    # Consume stdin (required by Claude Code hook protocol)
    try:
        sys.stdin.read()
    except Exception:
        pass

    if os.path.exists(TASK_FILE):
        try:
            with open(TASK_FILE) as f:
                raw = f.read().strip()
            task_id, _, session_id = raw.partition(":")
        except Exception:
            return

        if session_id:
            return  # session already active for this turn

        if not task_id:
            return

        # Task exists but no active session — start a new session under the same task.
        try:
            data = _post("/api/task-start", {
                "taskId":        task_id,
                "title":         f"Claude Code — {os.path.basename(PROJECT_DIR)}",
                "workspacePath": PROJECT_DIR,
            })
            new_session_id = data.get("sessionId", "")
            os.makedirs(os.path.dirname(TASK_FILE), exist_ok=True)
            with open(TASK_FILE, "w") as f:
                f.write(f"{task_id}:{new_session_id}")

            _emit_gap_rule(task_id, new_session_id)

            # Planning snapshot for session continuity
            _post("/api/save-context", {
                "taskId":    task_id,
                "sessionId": new_session_id,
                "title":     f"Session resumed in {os.path.basename(PROJECT_DIR)}",
                "body":      (
                    f"Claude Code session resumed on existing work item.\n"
                    f"Project: {os.path.basename(PROJECT_DIR)}\n"
                    f"Path: {PROJECT_DIR}\n"
                    f"Session: {new_session_id[:8]}…"
                ),
                "lane":      "planning",
                "metadata":  {"workspacePath": PROJECT_DIR, "sessionKind": "continuation"},
            })
        except Exception:
            pass
        return

    # No task file — create a new task and session.
    title = f"Claude Code — {os.path.basename(PROJECT_DIR)}"
    try:
        data = _post("/api/task-start", {
            "title":         title,
            "workspacePath": PROJECT_DIR,
        })
        task_id    = data["task"]["id"]
        session_id = data.get("sessionId", "")
        os.makedirs(os.path.dirname(TASK_FILE), exist_ok=True)
        with open(TASK_FILE, "w") as f:
            f.write(f"{task_id}:{session_id}")

        _emit_gap_rule(task_id, session_id)

        _post("/api/save-context", {
            "taskId":    task_id,
            "sessionId": session_id,
            "title":     f"Session started in {os.path.basename(PROJECT_DIR)}",
            "body":      (
                f"Claude Code session started.\n"
                f"Project: {os.path.basename(PROJECT_DIR)}\n"
                f"Path: {PROJECT_DIR}\n"
                f"Session: {session_id[:8]}…"
            ),
            "lane":      "planning",
            "metadata":  {"workspacePath": PROJECT_DIR},
        })
    except Exception:
        pass  # server not running — silent skip


main()
