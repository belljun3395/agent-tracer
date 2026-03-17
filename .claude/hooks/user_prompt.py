#!/usr/bin/env python3
"""UserPromptSubmit hook: captures the user's prompt and logs it as a user.message event.

Fires each time the user submits a new message.
Also ensures a task + session exist before PreToolUse fires.

File format while session is active: "taskId:sessionId"
File format after session ends (Stop hook): "taskId:"

Silently skips if the monitor server is not running.
"""

import json
import os
import sys
import urllib.request
import uuid

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


def _ensure_task() -> tuple[str, str, bool]:
    """Return (task_id, session_id, is_new_session).

    Creates a new task or resumes an existing one as needed.
    """
    if os.path.exists(TASK_FILE):
        try:
            with open(TASK_FILE) as f:
                raw = f.read().strip()
            task_id, _, session_id = raw.partition(":")

            if task_id and session_id:
                return task_id, session_id, False  # session already active

            if task_id:
                # Session ended (Stop hook cleared sessionId) — start a new session
                data = _post("/api/task-start", {
                    "taskId":        task_id,
                    "title":         f"Claude Code — {os.path.basename(PROJECT_DIR)}",
                    "workspacePath": PROJECT_DIR,
                })
                session_id = data.get("sessionId", "")
                with open(TASK_FILE, "w") as f:
                    f.write(f"{task_id}:{session_id}")
                return task_id, session_id, True
        except Exception:
            pass

    # No task file — create a brand-new task + session
    data = _post("/api/task-start", {
        "title":         f"Claude Code — {os.path.basename(PROJECT_DIR)}",
        "workspacePath": PROJECT_DIR,
    })
    task_id    = data["task"]["id"]
    session_id = data.get("sessionId", "")
    os.makedirs(os.path.dirname(TASK_FILE), exist_ok=True)
    with open(TASK_FILE, "w") as f:
        f.write(f"{task_id}:{session_id}")
    return task_id, session_id, True


def main() -> None:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        payload = {}

    prompt = (payload.get("prompt") or "").strip()

    try:
        task_id, session_id, is_new_session = _ensure_task()
    except Exception:
        return  # monitor not running

    if not prompt:
        return

    # Build title: first 120 chars of the prompt
    title = prompt[:120]
    if len(prompt) > 120:
        title += "…"

    # Determine phase: "initial" for the first message of a session,
    # "follow_up" for subsequent messages.
    # Track per-session message count in a small counter file.
    counter_file = os.path.join(PROJECT_DIR, ".claude", f".msg-count-{session_id[:8]}")
    count = 0
    if not is_new_session:
        try:
            with open(counter_file) as f:
                count = int(f.read().strip() or "0")
        except Exception:
            pass

    phase = "initial" if count == 0 else "follow_up"

    try:
        with open(counter_file, "w") as f:
            f.write(str(count + 1))
    except Exception:
        pass

    try:
        _post("/api/user-message", {
            "taskId":      task_id,
            "sessionId":   session_id,
            "messageId":   str(uuid.uuid4()),
            "captureMode": "raw",
            "source":      "claude-hook",
            "phase":       phase,
            "title":       title,
            "body":        prompt,
        })
    except Exception:
        pass


main()
