#!/usr/bin/env python3
"""PostToolUse hook: records exploration events (Read, Glob, Grep, LS, WebSearch, WebFetch)."""

import json
import os
import sys
import urllib.request

API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"
PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
MAX_PATH_LEN = 300
OPENCODE_RUNTIME = bool(os.environ.get("OPENCODE") or os.environ.get("OPENCODE_CLIENT"))
CLAUDE_RUNTIME = bool(os.environ.get("CLAUDE_PROJECT_DIR")) and not OPENCODE_RUNTIME


def _rel(path: str) -> str:
    if path.startswith(PROJECT_DIR):
        return path[len(PROJECT_DIR):].lstrip("/")
    return path


def _post(path: str, body: dict) -> None:
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=2)


def _get_ids(cc_session_id: str) -> tuple[str, str] | None:
    req = urllib.request.Request(
        f"{API_BASE}/api/cc-session-ensure",
        data=json.dumps({
            "ccSessionId":   cc_session_id,
            "title":         f"Claude Code — {os.path.basename(PROJECT_DIR)}",
            "workspacePath": PROJECT_DIR,
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
        event         = json.load(sys.stdin)
        tool_name     = event.get("tool_name", "")
        tool_input    = event.get("tool_input", {})
        cc_session_id = (event.get("session_id") or "").strip()
    except Exception:
        return

    if not cc_session_id:
        return

    try:
        task_id, session_id = _get_ids(cc_session_id)
    except Exception:
        return

    if tool_name == "Read":
        fp    = tool_input.get("file_path", "")
        rel   = _rel(fp)
        title = f"Read: {os.path.basename(rel)}"
        body  = f"Reading {rel}"
        paths = [fp] if fp else []
    elif tool_name == "Glob":
        pattern = tool_input.get("pattern", "")
        title   = f"Glob: {pattern}"
        body    = f"Searching for files matching: {pattern}"
        paths   = []
    elif tool_name == "Grep":
        pattern = tool_input.get("pattern", "")
        path    = tool_input.get("path", "")
        rel     = _rel(path) if path else ""
        title   = f"Grep: {pattern[:60]}"
        body    = f"Searching for '{pattern}'" + (f" in {rel}" if rel else "")
        paths   = [path] if path else []
    elif tool_name == "LS":
        path  = tool_input.get("path", "")
        rel   = _rel(path) if path else "."
        title = f"LS: {rel}"
        body  = f"Listing directory: {rel}"
        paths = [path] if path else []
    elif tool_name in ("WebSearch", "WebFetch"):
        query = tool_input.get("query") or tool_input.get("url") or ""
        title = f"{tool_name}: {str(query)[:60]}"
        body  = f"Web lookup: {str(query)[:200]}"
        paths = []
    else:
        title = f"Explore: {tool_name}"
        body  = f"Used {tool_name} to explore"
        paths = []

    try:
        _post("/api/explore", {
            "taskId":    task_id,
            "sessionId": session_id,
            "toolName":  tool_name,
            "title":     title,
            "body":      body,
            "filePaths": [p[:MAX_PATH_LEN] for p in paths if p],
            "metadata":  {"toolInput": {k: str(v)[:200] for k, v in tool_input.items()}},
        })
    except Exception:
        pass


main()
