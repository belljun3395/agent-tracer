---
description: Probe this project's stack, survey the user, then seed personalized Agent Tracer verification rules.
allowed-tools: Read, Glob, Grep, mcp__monitor__monitor_list_rules, mcp__monitor__monitor_create_rule
---

You are setting up Agent Tracer verification rules for the user's current project.

File detection alone is shallow — it tells us what is **configured**, not what the user actually **cares about**. Combine filesystem probing with a short survey, then propose rules.

## Step 1 — Probe filesystem (silent)

Read candidate config files **without** dumping raw contents to the user yet. Build a `detected` set in memory:

- `package.json` → inspect `scripts.lint`, `scripts.test`, `scripts.typecheck`, `scripts.build`, `scripts.format`
- `Cargo.toml` → presence implies Rust; infer `cargo test`, `cargo clippy`, `cargo fmt`
- `pyproject.toml` + `requirements*.txt` → check tool sections + dev deps for `ruff`, `black`, `pytest`, `mypy`
- `go.mod` → presence implies Go; infer `go test`, `go vet`, `gofmt`
- `Makefile` → glob for targets like `test`, `lint`, `check`, `fmt`
- `tsconfig.json`, `eslint.config.*` / `.eslintrc*`, `biome.json`, `.prettierrc*` → language/style signals

Skip directories like `node_modules`, `target`, `dist`, `.venv`.

## Step 2 — Survey (conversational, at most 4 questions)

Default-suggest from detected signals so the user just confirms quickly. **After Q1, always offer the escape line:** `"Use detection only — skip survey"`.

- **Q1) What language(s) do you primarily work in on this project?**
  Suggest the detected stack(s). For polyglot repos, ask the user which one matters most. Accept comma-separated.
- **Q2) Main framework(s)?**
  e.g., React, Next, Nest, Express, Django, FastAPI, Spring, Actix, none. Skip if nothing applies.
- **Q3) When should the agent be reminded to verify? Pick any:**
  - (a) after every edit
  - (b) before committing / pushing / opening a PR
  - (c) after refactors / renames
  - (d) custom (free-form)
- **Q4) Any specific commands or patterns you ALWAYS want enforced?**
  Free text or `skip`. Examples: "always run prettier", "never commit without typecheck", "tests live in tests/".

## Step 3 — Synthesize candidate rules (3–7 rules)

Combine `detected` + survey answers. Examples of how to map answers to rule fields:

| Survey answer | triggerPhrases | expect mapping |
|---|---|---|
| "after every edit" | `["edit","fix","implement","add","update"]` | expect on `Bash` command matching the detected build/test script |
| "before committing" | `["commit","push","PR","pull request","merge"]` | expect on the same scripts |
| "after refactors" | `["refactor","rename","extract","move"]` | expect on `typecheck`/`build` |
| framework=React + scripts.test | (inherit from Q3) | `expect.commandMatches: ["vitest","jest","playwright"]` |
| language=Rust | (inherit from Q3) | `expect.commandMatches: ["cargo test","cargo clippy","cargo fmt"]` |
| Q4 free-form pattern | derived from the user's wording | one dedicated rule per pattern |

For each candidate rule, prepare these fields (used by `monitor_create_rule`):
- `name`: short imperative summary, e.g., `"Lint before commits (npm run lint)"`
- `trigger`: `{ phrases: [...] }` (or omit if "after every edit" applies to all turns; ask Claude to default to user-side triggers)
- `triggerOn`: `"user"` (default) — assistant-triggered rules are rare for setup
- `expect`:
  - `action`: one of `"command" | "file-read" | "file-write" | "web"` (high-level category; for shell verification use `"command"`)
  - `commandMatches`: array of substrings to match against the actual command run, e.g., `["npm run lint","pnpm lint"]`
  - `pattern`: regex on file path or command (optional)
- `scope`: `"global"` (these are project-wide habits, not per-task)
- `severity`: `"info"` (no blocking — these are reminders, not gates)
- `rationale`: 1 sentence encoding the survey context, e.g., `"TS + React; user picked 'before committing'."`

## Step 4 — Dedup + Confirm

Call `monitor_list_rules({ scope: "global" })` and skip any candidate whose intent overlaps with an existing rule (same `commandMatches` + same trigger pivot is a strong signal of duplication).

Show the remaining candidates as a numbered list with default-selected `[v]` checkmarks. Let the user toggle individual items, accept all (`y`/`all`), or edit a specific rule by number.

## Step 5 — Create

For each accepted rule, call `monitor_create_rule` with the fields prepared in Step 3. If the response includes `"created": false`, mention that the rule already existed and was skipped.

## Step 6 — Summarize

Print the list of created rule IDs and remind the user that they can manage rules at `http://127.0.0.1:5173/rules` (or whatever monitor address the user has configured). Suggest that they re-run `/setup-rules` whenever the project's stack changes.

---

**Conversation guidelines:**
- Be terse. Don't repeat what the user just said.
- Never auto-create rules without explicit confirmation.
- If the user types `skip survey` at any point after Q1, jump to Step 3 using only the detected signals.
- If no commands were detected and the survey didn't yield concrete patterns, tell the user honestly and exit without creating rules.
