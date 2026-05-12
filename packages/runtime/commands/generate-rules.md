---
description: Analyze a recorded task in the monitor server and propose verification rules tailored to its workspace and tool sequence.
argument-hint: "[taskId | latest]"
allowed-tools: Read, Glob, Grep, mcp__monitor__monitor_list_tasks, mcp__monitor__monitor_get_task_summary, mcp__monitor__monitor_list_rules, mcp__monitor__monitor_create_rule
---

You generate Agent Tracer verification rules from a *recorded* task. Unlike `/setup-rules` (which seeds project-wide habits), this command looks at one specific past task — what files were touched, which tools/commands the agent used, what the user originally asked — and proposes rules that would catch whether a future agent did the work correctly.

## Argument resolution

The user passed: `$ARGUMENTS`.

- If empty or the literal `latest`: call `monitor_list_tasks`, pick the most recent task with `status === "completed"`, and confirm with the user before proceeding (`"Use task X — '<title>'? (y/n)"`).
- If it looks like a task ID (UUID or short slug): use it directly.
- If it's a freeform string and doesn't resolve: list 5 most recent tasks and ask the user to pick.

Refuse to proceed if the chosen task is still `running` or `waiting` — the timeline is incomplete and any generated rules would be biased.

## Step 1 — Fetch the task summary

Call `monitor_get_task_summary({ taskId })`. You get back: `title`, `status`, `workspacePath`, `firstUserMessage`, `eventCount`, `toolCounts`, `topFiles`, `topCommands`.

Show the user a one-paragraph synopsis: what the task was about, what tools were used heavily, which files were touched. Confirm this is the task they meant.

## Step 2 — Inspect the workspace (selectively)

Set your working directory expectation to `summary.workspacePath`. Read **only** the files that are likely to inform rule design — do not exhaustively crawl:

- `package.json` / `Cargo.toml` / `pyproject.toml` / `go.mod` — to learn the project's lint/test/build commands by name
- Configs that the touched files imply (e.g., if the agent edited `*.tsx`, look at `tsconfig.json`)
- Test setup (e.g., `vitest.config.ts`, `jest.config.*`, `pyproject.toml [tool.pytest.ini_options]`) when relevant

If `workspacePath` is unset or the directory doesn't exist on disk, skip Step 2 and rely on the summary alone.

## Step 3 — Synthesize 3–5 rule proposals

Use the summary + workspace evidence. Tailor rules to **this kind of task**, not to the project in general (that's `/setup-rules`'s job). Examples of task-shaped rules:

- Task touched `src/auth/*` and ran `npm test` twice → rule "After editing auth code, run tests" (trigger on assistant turns mentioning "auth"/"login"/"jwt", expect `npm test`).
- Task ran `cargo clippy` once but not `cargo fmt` → rule "Run cargo fmt after Rust edits" (severity info, as a reminder).
- Task involved DB migrations (touched `migrations/*.sql`) → rule "Verify migration ran" (expect commandMatches `["npm run migrate","diesel migration run"]`).

For each candidate:
- `name`: short imperative — what the agent should be reminded to do
- `trigger`: phrases drawn from the user's first message or from semantic theme (e.g., `["auth","jwt","login"]`); use `triggerOn: "user"` unless the rule specifically watches assistant output
- `expect`: high-level `action` (`"command" | "file-read" | "file-write" | "web"`), `commandMatches` (specific tools), or `pattern` (regex on filepath/command)
- `scope`: **always `"task"` with the current `taskId`** — rules from this command are bound to the specific task that inspired them. If the user later finds a rule generally useful, they can promote it to global from the `/rules` page.
- `severity`: `"info"` always (these are LLM-generated; no blocking)
- `rationale`: 1 sentence tying back to the task evidence ("Agent edited auth files but didn't re-run integration tests")

## Step 4 — Dedup + Confirm

Call `monitor_list_rules({ scope: "global" })` and `monitor_list_rules({ scope: "task", taskId })`. Skip candidates that overlap with existing rules.

Present the remaining candidates as a numbered list. Each line: `[v] N) <name> — <rationale>` plus a 1-line technical breakdown (`triggers: [...] · expects: <commandMatches or pattern>`). Wait for explicit user confirmation (`y`/`all`/numbers/`n`).

## Step 5 — Create

For each accepted, call `monitor_create_rule` with the prepared fields. Honor any per-rule edits the user made before confirming.

## Step 6 — Summarize

Print created rule IDs. Remind the user that these rules are task-scoped — they only apply to events under this task. If a rule turns out to be useful across other tasks, the user can promote it to global from `http://127.0.0.1:5173/rules` (Promote action).

---

**Conversation guidelines:**
- Never propose more than 5 rules per invocation — quality over quantity.
- If the summary is empty (eventCount near zero), tell the user and exit; this task is too thin to learn from.
- If the user pushes back on a proposal, take their feedback seriously and offer to revise — don't just remove and move on.
- When in doubt between `task`-scoped and `global`, ask the user before creating.
