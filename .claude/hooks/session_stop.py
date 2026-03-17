#!/usr/bin/env python3
"""Stop hook: ends the current runtime session without closing the work item.

Fires when the Claude Code agent loop ends (end of a session response).
Calls /api/session-end to mark only the session as completed; the task remains
running so follow-up turns can continue on the same work item.

The .current-task-id file is kept (with sessionId cleared) so the next
PreToolUse turn can open a new session under the same task.

File format while session is active: "taskId:sessionId"
File format after session ends:      "taskId:"  (sessionId cleared)
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

    if not task_id:
        return

    try:
        _post("/api/session-end", {
            "taskId":    task_id,
            "sessionId": session_id or None,
            "summary":   "Claude Code session ended",
            "metadata":  {},
        })
    except Exception:
        pass

    # sessionId를 지워서 다음 PreToolUse 에서 새 세션을 시작하게 한다.
    # taskId 는 유지하여 같은 작업 항목을 이어받을 수 있도록 한다.
    try:
        with open(TASK_FILE, "w") as f:
            f.write(f"{task_id}:")
    except Exception:
        pass


main()
