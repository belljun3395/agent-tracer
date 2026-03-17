#!/usr/bin/env python3
"""Stop hook: saves a context snapshot and marks the Baden task as completed.

Fires when the Claude Code agent loop ends (end of a session response).
Removes .current-task-id so the next session starts a fresh task.
"""

import json
import os
import sys
import urllib.request

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
TASK_FILE   = os.path.join(PROJECT_DIR, ".claude", ".current-task-id")
API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"


def _post(path: str, body: dict) -> None:
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=2)


def main() -> None:
    try:
        sys.stdin.read()
    except Exception:
        pass

    if not os.path.exists(TASK_FILE):
        return

    try:
        with open(TASK_FILE) as f:
            raw = f.read().strip()
        task_id, _, session_id = raw.partition(":")
    except Exception:
        return

    try:
        _post("/api/save-context", {
            "taskId":    task_id,
            "sessionId": session_id,
            "title":     "Session ended",
            "body":      "Claude Code session has ended. All pending work complete for this session.",
            "lane":      "planning",
            "metadata":  {},
        })
    except Exception:
        pass

    try:
        _post("/api/task-complete", {
            "taskId":    task_id,
            "sessionId": session_id,
        })
    except Exception:
        pass

    try:
        os.remove(TASK_FILE)
    except Exception:
        pass


main()
