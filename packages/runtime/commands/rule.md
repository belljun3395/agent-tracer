---
description: Ask the local daemon to generate rules for this task (runs in the background)
argument-hint: [optional note]
---

The local daemon already detected this message via the `/rule` prefix and queued a
task-scoped `rule.generation` job (skipped if the dashboard's `ruleGen.autoOnUserInput`
toggle is off). Actual rule generation runs in the background on the local daemon, so
**you must not write rules yourself or edit rule-related code** — that is the only
thing you should skip.

If $ARGUMENTS contains any other real request (a question, checking a file, a task
instruction, etc.), carry it out normally as you would any other turn. If there is no
such request, output only one line acknowledging that the rule-generation request was
received and progress can be checked in the dashboard Rules tab — written in the same
language $ARGUMENTS is written in (e.g. Korean in, Korean out; English in, English out).
If $ARGUMENTS is empty, default to English.
