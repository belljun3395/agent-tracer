---
description: State a request and have the local daemon derive verification rules for it (runs in the background)
argument-hint: <the request the rules must verify>
---

$ARGUMENTS **is the request itself**, not a note about it. Write `/rule add rate limiting
to the auth middleware`, not a bare `/rule`. A rule verifies that you did what the user
asked in this one message, so a message with no request produces no rules and the daemon
ignores it.

The local daemon already detected this message via the `/rule` prefix and queued a
`rule.generation` job anchored to it. A background agent inspects the workspace and derives the obligations
$ARGUMENTS implies — one message can yield several rules. **You must not write rules
yourself or edit rule-related code**; that is the only thing you should skip.

Carry out $ARGUMENTS normally, exactly as you would any other turn. Everything you do
from here until you stop is the evidence those rules are judged against, and unfulfilled
rules will halt your turn. Answer in the language $ARGUMENTS is written in.
