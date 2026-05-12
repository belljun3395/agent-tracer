---
description: Trigger a recipe scan over recorded tasks. The monitor server clusters similar tasks into recipe candidates that the user can later accept from /recipes.
argument-hint: "[status=completed|active|all] [max=10]"
allowed-tools: mcp__monitor__monitor_scan_recipes, mcp__monitor__monitor_list_recipe_candidates
---

You enqueue a recipe scan and report what it produced.

## Argument resolution

The user passed: `$ARGUMENTS`.

Parse it as a loose set of `key=value` pairs separated by whitespace. Recognised keys:
- `status` ∈ `{completed, active, all}` — default `completed`
- `max`    ∈ `[1, 30]`                  — default `10`
- `events` ∈ `[1, 1000]`                — minimum event count for a task to be considered, default `1`

Anything you can't parse: ask the user to clarify rather than guessing.

## Step 1 — Enqueue

Call `monitor_scan_recipes({ statusFilter, maxCandidates, minEventCount })`. The response is `{ jobId, status, createdAt }`.

Tell the user the job has started (id, status). The scan runs asynchronously on the monitor server — typically a few seconds.

## Step 2 — Poll (best-effort)

Wait briefly (a few seconds) and call `monitor_list_recipe_candidates({ status: "pending" })`. If new candidates appeared since the user's request, print a compact summary:

```
N pending candidates after the scan:
• <title> — <intent>    (id <short>)
• …
```

If no candidates appeared yet, tell the user the scan is still running and direct them to `http://127.0.0.1:5173/recipes` to review when it finishes.

## Step 3 — Reminder

Remind the user that candidates need explicit acceptance from the `/recipes` page before they become active recipes that future agents can draw on.

---

**Conversation guidelines:**
- Don't poll forever — one or two short waits at most.
- If the enqueue fails (no Anthropic API key, scan already in flight), surface the error message verbatim so the user can act on it.
