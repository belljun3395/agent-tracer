#!/usr/bin/env python3
"""PreToolUse hook: ensures a Baden monitoring task is active for this session.

Creates a new task via the Baden REST API on the first tool use of a session.
The task ID + sessionId are stored in .claude/.current-task-id.
Silently skips if the Baden server is not running.
"""

import json
import os
import sys
import urllib.error
import urllib.request

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
TASK_FILE   = os.path.join(PROJECT_DIR, ".claude", ".current-task-id")
API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"


def main() -> None:
    # Consume stdin (required by Claude Code hook protocol)
    try:
        sys.stdin.read()
    except Exception:
        pass

    if os.path.exists(TASK_FILE):
        return  # task already active

    title = f"Claude Code — {os.path.basename(PROJECT_DIR)}"
    payload = json.dumps({
        "title": title,
        "workspacePath": PROJECT_DIR,
    }).encode()

    try:
        req = urllib.request.Request(
            f"{API_BASE}/api/task-start",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read())
            task_id    = data["task"]["id"]
            session_id = data.get("sessionId", "")
            os.makedirs(os.path.dirname(TASK_FILE), exist_ok=True)
            with open(TASK_FILE, "w") as f:
                f.write(f"{task_id}:{session_id}")

        # Emit a planning event to show session start.
        thought_payload = json.dumps({
            "taskId":    task_id,
            "sessionId": session_id,
            "title":     f"Session started in {os.path.basename(PROJECT_DIR)}",
            "body":      f"Claude Code session started.\nProject: {os.path.basename(PROJECT_DIR)}\nPath: {PROJECT_DIR}\nSession: {session_id[:8]}…",
            "lane":      "planning",
            "metadata":  {"workspacePath": PROJECT_DIR},
        }).encode()
        thought_req = urllib.request.Request(
            f"{API_BASE}/api/save-context",
            data=thought_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(thought_req, timeout=2)
    except Exception:
        pass  # server not running — silent skip


main()
