---
description: List active Agent Tracer recipes — reusable patterns distilled from past task sessions.
argument-hint: "[intent-filter]"
allowed-tools: mcp__monitor__monitor_list_recipes
---

You list and summarize active recipes from the Agent Tracer monitor server.

## Argument resolution

The user passed: `$ARGUMENTS`.

- If empty: list every active recipe.
- If non-empty: treat it as a case-insensitive substring filter against the recipe's `title` and `intent`.

## Step 1 — Fetch

Call `monitor_list_recipes({ status: "active" })`. The response shape is `{ recipes: [{ id, title, intent, description, summary_md, rev, applied_count, success_count, created_at, language, ... }] }`.

If the list is empty:
- Tell the user "No active recipes yet. Run a scan from /recipes or use /agent-tracer:recipe-scan."
- Stop.

## Step 2 — Filter (if argument given)

When `$ARGUMENTS` is non-empty, keep only recipes whose lowercased `title` or `intent` contains the lowercased argument.

## Step 3 — Render

Print the list as a compact bullet-list, one block per recipe:

```
• <title>  · rev N · applied A/S
  intent: <intent>
  <description>
  id: <id>
```

Sort by `applied_count` descending (most-used first), then by `created_at` descending.

Do not dump `summary_md` here — the list view is meant to be scannable. Tell the user they can run `/agent-tracer:recipe-show <id>` for the full body.

## Step 4 — Hint

If the result set is large (>10), suggest narrowing with an intent keyword.

---

**Conversation guidelines:**
- Never invent recipes — only show what `monitor_list_recipes` returned.
- If the monitor server is unreachable, say so plainly and exit.
