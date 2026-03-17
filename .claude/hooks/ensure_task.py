#!/usr/bin/env python3
"""PreToolUse hook: ensures a monitoring task and session are active.

Safety fallback for tool-only flows (subagents, non-interactive runs).
Uses /api/cc-session-ensure — no files on disk.
"""

import json
import sys
import os
import urllib.request

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

    cc_session_id = (payload.get("session_id") or "").strip()
    if not cc_session_id:
        return

    try:
        _post("/api/cc-session-ensure", {
            "ccSessionId":   cc_session_id,
            "title":         f"Claude Code — {os.path.basename(PROJECT_DIR)}",
            "workspacePath": PROJECT_DIR,
        })
    except Exception:
        pass  # monitor not running — silent skip


main()
