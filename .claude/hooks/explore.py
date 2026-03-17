#!/usr/bin/env python3
"""PostToolUse hook: records exploration events to Baden.

Fires after Read, Glob, Grep, LS, WebSearch, or WebFetch tool use.
Posts an exploration event so the Exploration lane fills up with
the AI's codebase investigation activity.
"""

import json
import os
import sys
import urllib.request

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
TASK_FILE   = os.path.join(PROJECT_DIR, ".claude", ".current-task-id")
API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"

MAX_PATH_LEN = 300


def _rel(path: str) -> str:
    """Convert absolute path to project-relative for display."""
    if path.startswith(PROJECT_DIR):
        return path[len(PROJECT_DIR):].lstrip("/")
    return path


def main() -> None:
    if not os.path.exists(TASK_FILE):
        return

    try:
        event      = json.load(sys.stdin)
        tool_name  = event.get("tool_name", "")
        tool_input = event.get("tool_input", {})
    except Exception:
        return

    try:
        with open(TASK_FILE) as f:
            raw = f.read().strip()
        task_id, _, session_id = raw.partition(":")
    except Exception:
        return

    # Build a human-readable title and body based on tool type
    if tool_name == "Read":
        fp   = tool_input.get("file_path", "")
        rel  = _rel(fp)
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

    payload = json.dumps({
        "taskId":    task_id,
        "sessionId": session_id,
        "toolName":  tool_name,
        "title":     title,
        "body":      body,
        "filePaths": [p[:MAX_PATH_LEN] for p in paths if p],
        "metadata":  {"toolInput": {k: str(v)[:200] for k, v in tool_input.items()}},
    }).encode()

    try:
        req = urllib.request.Request(
            f"{API_BASE}/api/explore",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass


main()
