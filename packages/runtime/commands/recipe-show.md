---
description: Show the full body (summary_md, steps, touched_files) of a single Agent Tracer recipe.
argument-hint: "<recipe-id>"
allowed-tools: mcp__monitor__monitor_list_recipes
---

You print the full content of a single recipe.

## Argument resolution

The user passed: `$ARGUMENTS`.

- If empty: ask the user to provide a recipe id (or hint that `/agent-tracer:recipes` lists them).
- Else: treat the argument as a recipe id (a UUID or prefix thereof).

## Step 1 — Fetch

Call `monitor_list_recipes({ status: "all" })`. From the response, locate the recipe whose `id` exactly matches the argument; if no exact match, fall back to the first recipe whose `id` starts with the argument (case-insensitive). If multiple prefixes match, ask the user to disambiguate.

If no match: "Recipe not found." and exit.

## Step 2 — Print

Render the recipe in this order, with the following sections labeled in bold:

1. **Title** + status + rev + applied/success counts
2. **Intent**
3. **Description**
4. **Summary** — print `summary_md` verbatim
5. **Steps** — numbered list from `steps` (if non-empty)
6. **Touched files** — bulleted list from `touched_files` (path · role)
7. **Contributing tasks** — taskIds from `contributing_slices`, with the eventIds count (`whole task` if empty)
8. **Language** + `created_at` / `updated_at`

Keep file paths and identifiers verbatim — do not translate.

## Step 3 — Hint

Tell the user they can copy the summary into a new task as a starting point, or accept this pattern as guidance.

---

**Conversation guidelines:**
- Do not paraphrase the summary — print it raw so the user can copy it cleanly.
- If the recipe's status is `retired` or `superseded`, note that at the top.
