# Rule Index Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `rules/INDEX.yaml`을 저노이즈 규칙 집합으로 재구성해 lane/tag 분류 오탐을 줄이고, 실제 운영 규칙 파일에 대한 회귀 테스트를 추가한다.

**Architecture:** generic workflow verb(`read`, `plan`, `test`, `build`)는 `action-registry`가 맡고, `INDEX.yaml`은 domain/runtime-specific phrase 중심의 규칙만 유지한다. 가능한 한 rule은 tag-first 로 설계하고 lane override 는 꼭 필요한 경우에만 사용한다. background/coordination 같은 런타임 특화 분류는 현재 이벤트 모델과 실제 emitter 동작에 맞춰 별도 rule로 좁게 다룬다.

**Tech Stack:** YAML, TypeScript, `@monitor/core` classifier/rules loader, Vitest, `tsx`

> **Implementation status (2026-03-18):** real-index regression tests and the narrowed runtime/domain rule set are implemented in the matching branch.

---

## Success Criteria

- `rules/INDEX.yaml`에서 broad substring keyword가 제거되거나 매우 좁아진다.
- `action-registry`와 역할이 겹치는 generic workflow rule이 정리된다.
- `coordination` 및 `background` 관련 rule coverage 가 현재 런타임 모델에 맞게 추가된다.
- 실제 `rules/INDEX.yaml`을 직접 로드하는 회귀 테스트가 생긴다.
- 대표 샘플에서 기존 오분류가 사라진다.
  `Open checklist panel` 이 exploration으로 분류되지 않음
  `Update monitor-service implementation` 이 단지 `service` 때문에 backend로 분류되지 않음
  `Background task completed` 가 opencode async tag는 갖더라도 lane을 implementation으로 덮어쓰지 않음
- runtime adapter 계획과 충돌하지 않도록 별도 worktree/별도 commit 흐름으로 유지된다.

## Constraints And Decisions

- 이번 단계에서는 `rules.ts` 로더의 파일 포맷 계약은 유지한다. sidecar markdown 파일은 도입하지 않는다.
- 기본 방침은 `INDEX.yaml` 정리 우선, classifier 알고리즘 변경은 최소화다.
- 다만 `INDEX.yaml`만으로 false positive를 충분히 줄일 수 없으면 후속 단계에서 `matchMode` 같은 schema 확장을 고려한다.
- `action-registry`가 이미 더 정확한 token 기반 분류를 제공하므로, generic workflow lane 결정은 가능하면 거기로 몰아준다.
- 현재 `packages/web` 스타일링 작업이 진행 중이므로 이 계획은 별도 worktree 에서 실행한다.

## Proposed Rule Set Draft

아래는 구현 목표가 되는 `INDEX.yaml` 초안이다. 핵심은 broad verb를 빼고, domain/runtime phrase 중심으로 바꾸는 것이다.

```yaml
version: 1
rules:
  - id: ui-surface
    title: Dashboard UI Surface
    description: Web dashboard components, styling system, and timeline rendering files.
    keywords:
      - "@monitor/web"
      - tasklist.tsx
      - eventinspector.tsx
      - topbar.tsx
      - timeline.tsx
      - timeline.module.css
      - lanetheme.ts
      - styles/tokens.css
      - styles/base.css
      - tailwind
      - vite.config.ts
    tags:
      - frontend
      - ui
      - web

  - id: server-runtime
    title: Server Runtime
    description: Express app, monitor service, database, and runtime session APIs.
    keywords:
      - "@monitor/server"
      - monitor-service.ts
      - create-app.ts
      - monitor-database.ts
      - runtime-session
      - task-link
      - better-sqlite3
      - express
      - websocket
    tags:
      - backend
      - server
      - runtime

  - id: mcp-surface
    title: MCP Surface
    description: MCP server and monitor MCP tool names.
    keywords:
      - "@monitor/mcp"
      - modelcontextprotocol
      - monitor_task_link
      - monitor_user_message
      - monitor_session_end
      - monitor_agent_activity
      - mcp
    tags:
      - mcp
      - coordination

  - id: claude-runtime
    title: Claude Runtime
    description: Claude hook scripts, settings, and runtime-specific integration paths.
    keywords:
      - claude-hook
      - userpromptsubmit
      - .claude/hooks/
      - user_prompt.py
      - ensure_task.py
      - session_stop.py
      - agent_activity.py
      - settings.json
    tags:
      - claude
      - hooks
      - runtime

  - id: codex-runtime
    title: Codex Runtime
    description: Codex skill-based integration paths and native discovery files.
    keywords:
      - codex
      - codex-monitor
      - .agents/skills/
      - agents.md
      - codex-skill
    tags:
      - codex
      - runtime
      - skills

  - id: opencode-runtime
    title: OpenCode Runtime
    description: OpenCode plugin/runtime integration and Oh My Opencode envelopes.
    keywords:
      - opencode-plugin
      - .opencode/plugins/monitor.ts
      - chat.message
      - tool.execute.after
      - session.created
      - session.deleted
      - oh-my-opencode
    tags:
      - opencode
      - runtime
      - plugin

  - id: background-lifecycle
    title: Background Lifecycle
    description: Runtime-specific background task lifecycle markers and tool names.
    lane: background
    keywords:
      - run_in_background
      - background_output
      - prompt_async
      - async_task_
      - background task completed
      - all background tasks complete
      - asyncstatus
      - asynctaskid
    tags:
      - background
      - async
      - lifecycle

  - id: coordination-surface
    title: Coordination Surface
    description: Skill use, MCP calls, delegation, handoff, bookmark, and search activity.
    lane: coordination
    keywords:
      - skill_use
      - delegation
      - handoff
      - subagent
      - bookmark
      - mcpserver
      - mcptool
      - monitor_agent_activity
    tags:
      - coordination
      - orchestration
```

## Rule Review Summary

### Remove Or Replace

- `exploration`
  이유: `read`, `check`, `list`, `find`, `explore` 같은 broad keyword가 substring 오탐을 만든다.
- `planning`
  이유: `review`, `design`, `plan`, `approach`는 action-registry가 더 정확하게 처리한다.
- `test-build`
  이유: `git commit`, `git push`, `npm install`, `pnpm`이 rules lane에 섞여 의미가 흐려진다.
- `hooks`
  이유: `hook`, `explore`는 너무 broad하다. `claude-runtime`으로 대체한다.

### Narrow Or Split

- `frontend` → `ui-surface`
  broad keyword `component`, `style`, `css` 제거
- `backend` → `server-runtime`
  broad keyword `api`, `service` 제거
- `opencode-async` → `opencode-runtime` + `background-lifecycle`
  일반 runtime tagging 과 background lifecycle lane shaping 을 분리

### Keep Out Of Scope For This Pass

- `rules.ts` 파일 포맷 대개편
- markdown sidecar 도입
- classifier의 full-text tokenization 전면 교체

## File Map

**Create**
- `packages/core/test/rules-index.test.ts` — 실제 `rules/INDEX.yaml` 기반 회귀 테스트

**Modify**
- `rules/INDEX.yaml` — broad rule 제거 및 v2 draft 반영
- `packages/core/test/core.test.ts` — 필요 시 기존 synthetic test 일부 축소/정리
- `docs/superpowers/plans/2026-03-18-runtime-adapters-and-skill-portability.md` — 이 계획이 별도 트랙임을 짧게 링크

## Chunk 1: Stabilize The Rule Set

### Task 1: Baseline the current rule behavior with the real `INDEX.yaml`

**Files:**
- Modify: none
- Test: `packages/core/test`

- [ ] **Step 1: Run the current core test suite**

Run:

```bash
npm run test --workspace @monitor/core
```

Expected:
- PASS

- [ ] **Step 2: Snapshot current real-rule classifications**

Run:

```bash
npx tsx --eval "import { classifyEvent, loadRulesIndex } from './packages/core/src/index.ts'; const index = loadRulesIndex('./rules'); const samples = [{ kind:'tool.used', title:'Open checklist panel' }, { kind:'tool.used', title:'Update monitor-service implementation' }, { kind:'tool.used', title:'git commit release prep' }, { kind:'tool.used', title:'Background task completed' }]; for (const sample of samples) { const c = classifyEvent(sample, index); console.log(JSON.stringify({ title: sample.title, lane: c.lane, matches: c.matches.map(m => m.ruleId) }, null, 2)); }"
```

Expected:
- current false positives are visible and captured in terminal history for comparison

- [ ] **Step 3: Commit nothing yet**

This task exists only to capture the baseline.

### Task 2: Replace broad workflow rules with domain-specific rules

**Files:**
- Modify: `rules/INDEX.yaml`

- [ ] **Step 1: Remove generic lane-driving rules**

Delete:
- `exploration`
- `planning`
- `test-build`
- `hooks`

Acceptance:
- generic workflow verbs are no longer in `INDEX.yaml`
- workflow lane choice now relies on action-registry or explicit emitter lane

- [ ] **Step 2: Rename and narrow domain rules**

Replace:
- `frontend` → `ui-surface`
- `backend` → `server-runtime`

Acceptance:
- `component`, `style`, `css`, `api`, `service`, `endpoint` 같은 broad keyword는 빠진다
- file path / runtime phrase 중심 keyword만 남는다

- [ ] **Step 3: Split OpenCode concerns**

Replace:
- `opencode-async`

With:
- `opencode-runtime`
- `background-lifecycle`

Acceptance:
- generic OpenCode runtime tagging 과 background lane shaping 이 분리된다
- `pending`, `completed`, `cancelled`, `interrupt` 같은 broad status word는 제거된다

- [ ] **Step 4: Add MCP and coordination rules**

Add:
- `mcp-surface`
- `coordination-surface`

Acceptance:
- `coordination` lane/tag coverage가 생긴다
- MCP/skill/delegation 관련 용어를 broad generic rule이 아니라 dedicated rule이 받는다

- [ ] **Step 5: Keep the rule file format stable**

Do not add:
- `matchMode`
- extra YAML schema fields
- markdown sidecars

This pass is about safe narrowing, not format expansion.

- [ ] **Step 6: Re-run the spot-check command**

Run:

```bash
npx tsx --eval "import { classifyEvent, loadRulesIndex } from './packages/core/src/index.ts'; const index = loadRulesIndex('./rules'); const samples = [{ kind:'tool.used', title:'Open checklist panel' }, { kind:'tool.used', title:'Update monitor-service implementation' }, { kind:'tool.used', title:'git commit release prep' }, { kind:'tool.used', title:'Background task completed' }]; for (const sample of samples) { const c = classifyEvent(sample, index); console.log(JSON.stringify({ title: sample.title, lane: c.lane, matches: c.matches.map(m => m.ruleId) }, null, 2)); }"
```

Expected:
- `Open checklist panel` no longer matches exploration
- `Update monitor-service implementation` no longer matches backend solely because of `service`
- `git commit release prep` no longer matches rules
- `Background task completed` is handled by `background-lifecycle` or explicit event lane, not by a broad implementation rule

- [ ] **Step 7: Commit the rule rewrite**

```bash
git add rules/INDEX.yaml
git commit -m "refactor(rules): narrow index keywords and add runtime-specific rules"
```

## Chunk 2: Add Real Regression Coverage

### Task 3: Add tests against the production `INDEX.yaml`

**Files:**
- Create: `packages/core/test/rules-index.test.ts`
- Modify: `packages/core/test/core.test.ts`

- [ ] **Step 1: Create a dedicated real-index test file**

Test file responsibilities:
- load `rules/INDEX.yaml`
- assert expected rule IDs exist
- assert representative samples classify as intended

- [ ] **Step 2: Add existence coverage for the new rule set**

Minimum assertions:
- `ui-surface`
- `server-runtime`
- `mcp-surface`
- `claude-runtime`
- `codex-runtime`
- `opencode-runtime`
- `background-lifecycle`
- `coordination-surface`

- [ ] **Step 3: Add representative classification assertions**

Minimum cases:

```ts
expect(classify("Open checklist panel").matches.map(m => m.ruleId)).not.toContain("exploration");
expect(classify("Update monitor-service implementation").matches.map(m => m.ruleId)).not.toContain("backend");
expect(classify("git commit release prep").matches.map(m => m.ruleId)).not.toContain("test-build");
expect(classify("run_in_background worker").matches.map(m => m.ruleId)).toContain("background-lifecycle");
expect(classify("Skill: codex-monitor").matches.map(m => m.ruleId)).toContain("coordination-surface");
```

- [ ] **Step 4: Keep synthetic loader tests lightweight**

If `packages/core/test/core.test.ts` becomes redundant after the new test file:
- keep only loader/schema normalization behavior there
- move real-rule assertions into `rules-index.test.ts`

- [ ] **Step 5: Run the core suite**

Run:

```bash
npm run test --workspace @monitor/core
```

Expected:
- PASS

- [ ] **Step 6: Commit real-index coverage**

```bash
git add packages/core/test/rules-index.test.ts packages/core/test/core.test.ts
git commit -m "test(core): cover production rules index"
```

## Chunk 3: Decide If Classifier Changes Are Still Needed

### Task 4: Evaluate whether YAML-only narrowing is sufficient

**Files:**
- Modify: none by default

- [ ] **Step 1: Re-run the real-index tests and spot checks**

Run:

```bash
npm run test --workspace @monitor/core
npx tsx --eval "import { classifyEvent, loadRulesIndex } from './packages/core/src/index.ts'; const index = loadRulesIndex('./rules'); const samples = [{ kind:'tool.used', title:'Open checklist panel' }, { kind:'tool.used', title:'Update monitor-service implementation' }, { kind:'tool.used', title:'Component styling cleanup' }]; for (const sample of samples) { const c = classifyEvent(sample, index); console.log(JSON.stringify({ title: sample.title, lane: c.lane, matches: c.matches.map(m => ({ ruleId: m.ruleId, reasons: m.reasons })) }, null, 2)); }"
```

Expected:
- remaining false positives, if any, are easy to identify

- [ ] **Step 2: Stop if noise is acceptable**

If the remaining output is acceptable:
- do not change classifier schema or algorithm in this plan

- [ ] **Step 3: Only if still noisy, open a follow-up plan**

Possible follow-up topics:
- `matchMode: token | substring`
- `laneEffect: none | override`
- per-rule weights

Do not implement those in this pass unless a concrete failing test proves they are necessary.

## Final Verification

- [ ] **Step 1: Re-run core tests**

Run:

```bash
npm run test --workspace @monitor/core
```

Expected:
- PASS

- [ ] **Step 2: Diff the rule set for reviewability**

Run:

```bash
git diff -- rules/INDEX.yaml packages/core/test/core.test.ts packages/core/test/rules-index.test.ts
```

Expected:
- broad keyword removals are obvious
- new rules are easy to inspect

- [ ] **Step 3: Confirm the runtime plan remains separate**

Open:

```bash
sed -n '1,80p' docs/superpowers/plans/2026-03-18-runtime-adapters-and-skill-portability.md
```

Expected:
- runtime adapter work and rule hardening are clearly tracked as separate plans

- [ ] **Step 4: Final worktree check**

Run:

```bash
git status --short
```

Expected:
- worktree is clean because each task already committed its own changes

## Review Notes For The Implementer

- 가장 중요한 원칙은 `INDEX.yaml`이 generic verb classifier가 아니라는 점이다. broad workflow verb는 action-registry가 맡아야 한다.
- lane override 는 꼭 필요한 rule에만 사용하라. tag-only rule이 더 안전하다.
- `Background task completed` 같은 문구가 다시 `implementation` 쪽으로 끌려가면 이 계획은 실패한 것이다.
- runtime adapter 계획과 이 계획을 같은 worktree 에서 섞지 말라. 특히 현재 `packages/web` 스타일 변경과 충돌할 가능성이 있다.
