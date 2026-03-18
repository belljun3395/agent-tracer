# External Onboarding Docs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the documentation so an external user can start at the repository README and successfully attach Agent Tracer to another project.

**Architecture:** Make the README external-first, add a shared external setup hub for the common installation flow, and narrow the runtime-specific guides to runtime-only setup and validation details. Keep the docs honest about what `setup:external` automates today and what still requires manual setup.

**Tech Stack:** Markdown documentation, existing setup scripts, existing guide structure under `docs/guide`.

---

### Task 1: Define The New Entry Path

**Files:**
- Modify: `README.md`
- Create: `docs/guide/external-setup.md`

- [ ] Describe the shared external installation flow before the repo-local development flow.
- [ ] Link the README to a single external setup hub guide.
- [ ] State clearly that `setup:external` automates Claude Code and OpenCode, not Codex.

### Task 2: Re-scope The Guide Documents

**Files:**
- Modify: `docs/guide/llm-setup.md`
- Modify: `docs/guide/claude-setup.md`
- Modify: `docs/guide/opencode-setup.md`
- Modify: `docs/guide/codex-setup.md`

- [ ] Turn `llm-setup.md` into a guide map and integration overview.
- [ ] Make Claude/OpenCode guides external-project friendly first, then repo-local second.
- [ ] Clarify that Codex external integration is manual/repo-local only for now.
- [ ] Remove stale setup guidance that no longer matches the recommended onboarding path.

### Task 3: Verify The New Flow

**Files:**
- Verify: `README.md`
- Verify: `docs/guide/external-setup.md`
- Verify: `docs/guide/llm-setup.md`
- Verify: `docs/guide/claude-setup.md`
- Verify: `docs/guide/opencode-setup.md`
- Verify: `docs/guide/codex-setup.md`

- [ ] Confirm the README points to the external setup hub.
- [ ] Confirm the hub points to the correct runtime guides.
- [ ] Confirm stale `cc-session` references are removed from the user-facing guide path.
- [ ] Confirm the documented commands match the existing scripts and package scripts.
