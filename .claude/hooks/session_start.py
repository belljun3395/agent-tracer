#!/usr/bin/env python3
"""SessionStart hook: records compact/clear lifecycle events.

Fires at the beginning of each Claude Code session event.
- compact: context was compacted — record as a planning event
- clear:   conversation cleared — record as a planning event
- startup/resume: handled by user_prompt.py / ensure_task.py, skip here

No files on disk — uses cc_session_id to look up task/session from DB.
"""

import json
import sys
import os
import urllib.request

API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"
PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
CLAUDE_RUNTIME = bool(os.environ.get("CLAUDE_PROJECT_DIR"))


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
    if not CLAUDE_RUNTIME:
        return

    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        return

    trigger       = (payload.get("trigger") or "").lower()
    cc_session_id = (payload.get("session_id") or "").strip()

    if trigger in ("startup", "resume", "") or not cc_session_id:
        return

    # Get current task/session for this CC window
    try:
        ids = _post("/api/cc-session-ensure", {
            "ccSessionId":   cc_session_id,
            "title":         f"Claude Code — {os.path.basename(PROJECT_DIR)}",
            "workspacePath": PROJECT_DIR,
        })
    except Exception:
        return

    task_id    = ids.get("taskId")
    session_id = ids.get("sessionId")
    if not task_id or not session_id:
        return

    if trigger == "compact":
        try:
            _post("/api/save-context", {
                "taskId":    task_id,
                "sessionId": session_id,
                "title":     "Context compacted",
                "body":      (
                    "Claude Code compacted the conversation history to free up context.\n"
                    "Earlier events are summarised; this marker indicates the compact point."
                ),
                "lane":      "planning",
                "metadata":  {"trigger": "compact"},
            })
        except Exception:
            pass

    elif trigger == "clear":
        try:
            _post("/api/save-context", {
                "taskId":    task_id,
                "sessionId": session_id,
                "title":     "Conversation cleared",
                "body":      "Claude Code conversation was cleared (/clear).",
                "lane":      "planning",
                "metadata":  {"trigger": "clear"},
            })
        except Exception:
            pass


main()
