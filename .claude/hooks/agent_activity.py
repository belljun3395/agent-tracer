#!/usr/bin/env python3
"""PostToolUse hook: records Agent/Skill tool calls as coordination-lane events."""

import json
import os
import sys
import urllib.request

API_BASE    = f"http://127.0.0.1:{os.environ.get('MONITOR_PORT', '3847')}"
PROJECT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
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


def _get_ids(runtime_session_id: str) -> tuple[str, str]:
    req = urllib.request.Request(
        f"{API_BASE}/api/runtime-session-ensure",
        data=json.dumps({
            "runtimeSource":    "claude-hook",
            "runtimeSessionId": runtime_session_id,
            "title":            f"Claude Code — {os.path.basename(PROJECT_DIR)}",
            "workspacePath":    PROJECT_DIR,
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
        event              = json.load(sys.stdin)
        tool_name          = event.get("tool_name", "")
        tool_input         = event.get("tool_input", {})
        runtime_session_id = (event.get("session_id") or "").strip()
    except Exception:
        return

    if not runtime_session_id:
        return

    if tool_name == "Agent":
        activity_type    = "delegation"
        description      = tool_input.get("description", "")
        prompt           = tool_input.get("prompt", "")
        run_in_background = bool(tool_input.get("run_in_background", False))
        title            = f"Agent: {description[:80]}" if description else "Agent dispatch"
        body_text        = prompt[:400] if prompt else description
        extra: dict      = {"agentName": tool_input.get("subagent_type", "")}
    elif tool_name == "Skill":
        activity_type = "skill_use"
        skill_name    = tool_input.get("skill", "")
        args          = tool_input.get("args", "")
        title         = f"Skill: {skill_name}" if skill_name else "Skill invoked"
        body_text     = f"args: {args}" if args else skill_name
        extra         = {"skillName": skill_name}
    else:
        return

    try:
        task_id, session_id = _get_ids(runtime_session_id)
    except Exception:
        return

    payload: dict = {
        "taskId":       task_id,
        "sessionId":    session_id,
        "activityType": activity_type,
        "title":        title,
        "metadata":     {"toolInput": {k: str(v)[:200] for k, v in tool_input.items()}},
        **extra,
    }
    if body_text:
        payload["body"] = body_text

    try:
        _post("/api/agent-activity", payload)
    except Exception:
        pass

    # Background task: extract child session_id from tool response and link it
    if tool_name == "Agent" and run_in_background:
        import re
        tool_response = event.get("tool_response", "") or ""
        if isinstance(tool_response, dict):
            tool_response = json.dumps(tool_response)
        match = re.search(r"session_id[:\s]+([a-f0-9-]{8,})", str(tool_response), re.IGNORECASE)
        if match:
            child_session_id = match.group(1).strip()
            try:
                _post("/api/task-link", {
                    "taskId":          f"claude-{child_session_id}",
                    "taskKind":        "background",
                    "parentTaskId":    task_id,
                    "parentSessionId": session_id,
                    "title":           description or prompt[:80],
                })
            except Exception:
                pass


main()
