#!/usr/bin/env python3
"""UserPromptSubmit hook: captures the user's prompt and logs it as a user.message event.

Uses /api/cc-session-ensure to get or create a task/session for this Claude Code
window (identified by session_id). No files on disk.
"""

import json
import sys
import uuid
import urllib.request
import os

API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"
PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())


def _post(path: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=2) as resp:
        return json.loads(resp.read())


def main() -> None:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        return

    prompt        = (payload.get("prompt") or "").strip()
    cc_session_id = (payload.get("session_id") or "").strip()

    if not cc_session_id:
        return

    title = (prompt[:120] + "…") if len(prompt) > 120 else prompt

    try:
        ids = _post("/api/cc-session-ensure", {
            "ccSessionId":     cc_session_id,
            "title":           f"Claude Code — {os.path.basename(PROJECT_DIR)}",
            "workspacePath":   PROJECT_DIR,
            "bumpMessageCount": bool(prompt),
        })
    except Exception:
        return  # monitor not running

    if not prompt:
        return

    try:
        _post("/api/user-message", {
            "taskId":      ids["taskId"],
            "sessionId":   ids["sessionId"],
            "messageId":   str(uuid.uuid4()),
            "captureMode": "raw",
            "source":      "claude-hook",
            "phase":       ids["phase"],
            "title":       title,
            "body":        prompt,
        })
    except Exception:
        pass


main()
