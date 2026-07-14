---
description: Ask the local daemon to scan this task into recipe candidates (runs in the background)
argument-hint: [optional note about what to capture]
---

The local daemon already detected this message via the `/recipe` prefix and queued a
`recipe.scan` job anchored on the current task (skipped if an LLM API key is not
configured in Settings, or if a scan is already running for this task). Scanning runs in
the background on the server, so **you must not write recipes yourself or edit
recipe-related code** — that is the only thing you should skip.

If $ARGUMENTS contains any other real request (a question, checking a file, a task
instruction, etc.), carry it out normally as you would any other turn. If there is no
such request, output only one line acknowledging that the recipe scan was requested and
progress can be checked in the dashboard Recipes tab — written in the same language
$ARGUMENTS is written in (e.g. Korean in, Korean out; English in, English out). If
$ARGUMENTS is empty, default to English.
