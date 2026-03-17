#!/usr/bin/env python3
"""Stop hook: ends the current runtime session.

Calls /api/cc-session-end so the next turn starts a fresh monitoring session
under the same task. No files on disk.
"""

import json
import sys
import os
import urllib.request

API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"
OPENCODE_RUNTIME = bool(os.environ.get("OPENCODE") or os.environ.get("OPENCODE_CLIENT"))
CLAUDE_RUNTIME = bool(os.environ.get("CLAUDE_PROJECT_DIR")) and not OPENCODE_RUNTIME


def _post(path: str, body: dict) -> None:
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=2)


def main() -> None:
    if not CLAUDE_RUNTIME:
        return

    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        return

    cc_session_id = (payload.get("session_id") or "").strip()
    if not cc_session_id:
        return

    try:
        _post("/api/cc-session-end", {
            "ccSessionId": cc_session_id,
            "summary":     "Claude Code session ended",
        })
    except Exception:
        pass


main()
