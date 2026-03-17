#!/usr/bin/env python3
"""PostToolUse hook: records Edit / Write tool events to Baden (implementation lane).

Extracts the affected file path from the tool input and posts a
/api/tool-used event with lane="implementation".
"""

import json
import os
import sys
import urllib.request

PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
TASK_FILE   = os.path.join(PROJECT_DIR, ".claude", ".current-task-id")
API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"


def _read_ids() -> tuple[str, str]:
    with open(TASK_FILE) as f:
        raw = f.read().strip()
    task_id, _, session_id = raw.partition(":")
    return task_id, session_id


def _file_path(tool_input: dict) -> str:
    return (
        tool_input.get("file_path")
        or tool_input.get("path")
        or tool_input.get("pattern")
        or ""
    )


def _rel(path: str) -> str:
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
        fp         = _file_path(tool_input)
        task_id, session_id = _read_ids()
    except Exception:
        return

    rel   = _rel(fp) if fp else ""
    title = f"{tool_name}: {os.path.basename(rel)}" if rel else tool_name
    body  = f"Modified {rel}" if rel else f"Used {tool_name}"

    payload = json.dumps({
        "taskId":    task_id,
        "sessionId": session_id,
        "toolName":  tool_name,
        "title":     title,
        "body":      body,
        "lane":      "implementation",
        "filePaths": [fp] if fp else [],
        "metadata":  {"filePath": fp, "relPath": rel},
    }).encode()

    try:
        req = urllib.request.Request(
            f"{API_BASE}/api/tool-used",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass


main()
