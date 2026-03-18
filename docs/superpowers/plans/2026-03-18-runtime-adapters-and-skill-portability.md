# Runtime Adapter Normalization And Skill Portability Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code, Codex, OpenCode/Oh My Opencode 모니터링 경로를 런타임별 어댑터로 정리하고, MCP 계약은 런타임 중립으로 유지하면서 native skill discovery 와 문서 정합성을 맞춘다.

**Architecture:** 서버와 MCP는 canonical monitoring contract 만 유지하고, 실제 런타임 차이는 `claude-hook`, `codex-skill`, `opencode-plugin`, `opencode-sse` 같은 adapter capability 레이어에서 처리한다. skill 은 현재 `skills/`를 source-of-truth 로 유지하되 `.agents/skills` 및 `.claude/skills` projection 으로 배포하고, OpenCode 는 native multi-directory discovery 를 그대로 활용한다.

**Tech Stack:** TypeScript, Node.js, Express, Zod, MCP SDK, Python hook scripts, OpenCode plugin API, Markdown skills/docs, Vitest, Supertest

> **Implementation status (2026-03-18):** capability registry, `monitor_task_link` parity, Claude/OpenCode/Codex docs, fallback policy, native skill projection, and UI runtime labels are implemented. `opencode-sse` is kept as a reserved experimental adapter in the capability model/docs; server startup wiring is deferred to a later follow-up.

---

## Success Criteria

- `packages/core`에 런타임 capability registry 가 추가되고, Claude/Codex/OpenCode 동작 차이가 문서와 코드에서 같은 용어로 표현된다.
- `monitor_task_link` MCP 도구가 추가되어 `/api/task-link` 경로가 MCP parity 를 갖는다.
- Claude 문서는 `UserPromptSubmit` raw capture 와 실제 Stop semantics 를 반영한다.
- OpenCode 문서는 `chat.message` raw capture 와 OmO wrapper 지원을 반영한다.
- `monitor-server` 미가용 시 동작 규칙이 `AGENTS.md`, `skills/monitor`, `skills/codex-monitor`, setup guide 들에서 한 문장으로 통일된다.
- native skill projection 이 `.agents/skills/...` 와 `.claude/skills/...` 에서 동작하도록 정리된다.
- `packages/mcp`, `packages/server`, `packages/core` 테스트가 모두 통과한다.
- 새 adapter source 값이 UI에도 반영되어 `packages/web/src/components/TaskList.tsx`에서 `codex-skill` / `opencode-sse` 가 일관되게 표시된다.
- OpenCode SSE bridge 는 opt-in 실험 기능으로 설계/구현되며, plugin 이 없는 환경에서도 추적 후보 surface 를 제공한다.

## Constraints And Decisions

- 기존 HTTP API 는 유지한다. adapter refactor 는 additive 하게 진행하고, 이후 정리 단계에서만 dead path 를 제거한다.
- `skills/` 디렉터리는 당장 없애지 않는다. 먼저 projection 을 추가한 뒤, 실제 runtime adoption 을 확인하고 canonical source 이동 여부를 결정한다.
- Claude Stop semantics 는 "세션 종료"와 "작업 완료"를 분리하는 쪽을 canonical 로 잡는다.
- OpenCode primary session 종료는 기존 `session-end + completeTask:true` 흐름을 유지하되, contract 문서가 그 예외를 명시하도록 수정한다.
- OmO 는 별도 runtime 으로 모델링하지 않고 `opencode-plugin`의 envelope/source variant 로 취급한다.
- SSE bridge 는 read-only shadow observer 로 시작한다. plugin 과 bridge 는 mutual exclusion 정책을 사용하고, 동일 세션에서 둘을 동시에 켜는 dedupe 문제는 1차 범위에서 다루지 않는다.
- 현재 worktree 에 `packages/web` 스타일링 작업이 진행 중이므로, 이 계획은 별도 worktree 에서 실행한다. 특히 `packages/web/src/components/TaskList.tsx` 변경은 현재 스타일링 브랜치와 직접 충돌할 수 있다.
- `rules/INDEX.yaml` hardening 은 별도 계획인 [2026-03-18-rule-index-hardening.md](/Users/okestro/Documents/code/agent-tracer/docs/superpowers/plans/2026-03-18-rule-index-hardening.md) 에서 다룬다. runtime adapter 작업과 rule tuning 을 한 번에 섞지 않는다.

## File Map

**Create**
- `docs/guide/runtime-capabilities.md` — adapter capability matrix 와 runtime policy 문서
- `packages/core/src/runtime-capabilities.ts` — runtime adapter ID, capability model, helper
- `packages/core/test/runtime-capabilities.test.ts` — capability registry 회귀 테스트
- `scripts/sync-skill-projections.mjs` — `skills/` source를 native discovery path 로 projection 하는 스크립트
- `.agents/skills/codex-monitor/SKILL.md` — Codex native discovery projection
- `.agents/skills/monitor/SKILL.md` — generic/native discovery projection
- `.claude/skills/agent-tracer-monitor/SKILL.md` — Claude native fallback skill projection
- `packages/server/src/integration/opencode-sse-bridge.ts` — OpenCode `/global/event` 구독기
- `packages/server/test/integration/opencode-sse-bridge.test.ts` — SSE bridge 테스트
- `docs/guide/opencode-sse-bridge.md` — SSE bridge 사용 가이드
- `packages/server/test/index.test.ts` — SSE bridge startup wiring 테스트

**Modify**
- `AGENTS.md` — fallback policy, canonical skill/discovery 설명 정리
- `docs/guide/llm-setup.md` — adapter matrix 링크 및 contract 정리
- `docs/guide/claude-setup.md` — hook 목록, raw capture, stop semantics 정정
- `docs/guide/codex-setup.md` — `.agents/skills` projection 반영
- `docs/guide/opencode-setup.md` — raw capture, OmO wrapper, task-link parity, SSE bridge 옵션 추가
- `skills/codex-monitor/SKILL.md` — fallback policy, `monitor_task_link` usage, native projection 주석
- `skills/monitor/SKILL.md` — fallback policy 통일
- `.claude/settings.json` — hook 목록 검증용 source of truth 유지
- `.claude/hooks/session_stop.py` — task complete 분리 정책 반영
- `.opencode/plugins/monitor.ts` — OmO envelope metadata 보강, optional task-link MCP parity 주석/usage
- `packages/core/src/domain.ts` — contract 주석과 adapter 용어 정리
- `packages/core/src/index.ts` — capability export
- `packages/mcp/src/index.ts` — `monitor_task_link`, `monitor_session_end` 설명 정리
- `packages/mcp/test/client.test.ts` — 새 MCP tool 및 설명 흐름 테스트
- `packages/server/src/application/types.ts` — session-end / task-link contract 주석 정리
- `packages/server/src/index.ts` — SSE bridge startup wiring 및 mode gate
- `packages/server/src/presentation/create-app.ts` — 필요 시 task-link / runtime docs 주석만 조정
- `packages/server/src/seed.ts` — skill path / adapter source 예시 데이터 갱신
- `packages/server/test/claude-settings.test.ts` — `UserPromptSubmit` 와 guard 검증 강화
- `packages/server/test/opencode-monitor-plugin.test.ts` — raw capture / OmO metadata / wrapper 회귀 테스트
- `packages/server/test/presentation/create-app.test.ts` — `session-end` semantics 와 `task-link` regression
- `packages/web/src/components/TaskList.tsx` — 새 adapter source badge/label 반영
- `packages/web/src/components/TaskList.test.ts` — 새 adapter source badge/label 회귀 테스트

## Chunk 1: Runtime Contract And MCP Parity

### Task 1: Capture a focused baseline before touching contracts

**Files:**
- Modify: none
- Test: `packages/core/test`
- Test: `packages/mcp/test/client.test.ts`
- Test: `packages/server/test/presentation/create-app.test.ts`
- Test: `packages/server/test/opencode-monitor-plugin.test.ts`

- [ ] **Step 1: Run core baseline**

Run:

```bash
npm run test --workspace @monitor/core
```

Expected:
- PASS

- [ ] **Step 2: Run MCP baseline**

Run:

```bash
npm run test --workspace @monitor/mcp
```

Expected:
- PASS

- [ ] **Step 3: Run focused server baseline**

Run:

```bash
npm run test --workspace @monitor/server -- create-app.test.ts claude-settings.test.ts opencode-monitor-plugin.test.ts
```

Expected:
- PASS

- [ ] **Step 4: Snapshot current contract wording for later diff review**

Run:

```bash
rg -n "user-message-capture-unavailable|runtime-session|task-link|completeTask|UserPromptSubmit|chat.message" AGENTS.md docs skills packages .claude .opencode -S
```

Expected:
- output includes all current drift points described in the spec

- [ ] **Step 5: Confirm the runtime-label UI collision risk**

Run:

```bash
git status --short packages/web/src/components/TaskList.tsx packages/web/src/components/TaskList.test.ts
```

Expected:
- current worktree state is visible
- implementer understands this plan must run in a separate worktree before touching those files

- [ ] **Step 6: Commit nothing yet**

Do not commit in this task. This baseline is used to detect regressions in following tasks.

### Task 2: Add a runtime capability registry in `@monitor/core`

**Files:**
- Create: `packages/core/src/runtime-capabilities.ts`
- Create: `packages/core/test/runtime-capabilities.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/domain.ts`

- [ ] **Step 1: Create a runtime adapter ID model**

Target shape:

```ts
export type RuntimeAdapterId =
  | "claude-hook"
  | "codex-skill"
  | "opencode-plugin"
  | "opencode-sse";
```

- [ ] **Step 2: Define a capability contract**

Target shape:

```ts
export interface RuntimeCapabilities {
  readonly adapterId: RuntimeAdapterId;
  readonly canCaptureRawUserMessage: boolean;
  readonly canObserveToolCalls: boolean;
  readonly canObserveSubagents: boolean;
  readonly hasNativeSkillDiscovery: boolean;
  readonly hasEventStream: boolean;
  readonly endTaskOnSessionClose: "never" | "primary-only" | "always";
  readonly nativeSkillPaths: readonly string[];
}
```

- [ ] **Step 3: Add a single source-of-truth map**

Include at minimum:
- `claude-hook`
- `codex-skill`
- `opencode-plugin`
- `opencode-sse`

Important values:
- `claude-hook.canCaptureRawUserMessage = true`
- `claude-hook.endTaskOnSessionClose = "never"`
- `codex-skill.canObserveToolCalls = false`
- `opencode-plugin.hasEventStream = false`
- `opencode-sse.hasEventStream = true`

- [ ] **Step 4: Export capability helpers**

Expose helpers such as:

```ts
export function getRuntimeCapabilities(id: RuntimeAdapterId): RuntimeCapabilities
export function listNativeSkillPaths(id: RuntimeAdapterId): readonly string[]
```

- [ ] **Step 5: Update `domain.ts` comments to match the new model**

Adjust comments so they no longer claim all automatic runtimes behave identically.

Acceptance:
- comments explicitly separate Claude policy from OpenCode policy
- comments point readers to capability-based behavior, not product-name if/else text

- [ ] **Step 6: Add tests for each adapter**

Minimum assertions:
- Claude captures raw and does not auto-complete on session close
- Codex uses native skill path including `.agents/skills`
- OpenCode plugin captures raw but does not expose event stream
- OpenCode SSE exposes event stream and shares native skill paths with OpenCode

- [ ] **Step 7: Run core tests**

Run:

```bash
npm run test --workspace @monitor/core
```

Expected:
- PASS with new capability tests

- [ ] **Step 8: Commit the capability foundation**

```bash
git add packages/core/src/runtime-capabilities.ts packages/core/src/index.ts packages/core/src/domain.ts packages/core/test/runtime-capabilities.test.ts
git commit -m "feat(core): add runtime capability registry"
```

### Task 3: Add `monitor_task_link` MCP parity for background/subagent linking

**Files:**
- Modify: `packages/mcp/src/index.ts`
- Modify: `packages/mcp/test/client.test.ts`

- [ ] **Step 1: Add the MCP tool registration**

Target behavior:
- tool name: `monitor_task_link`
- route: `POST /api/task-link`
- schema matches `TaskLinkInput`

Suggested registration skeleton:

```ts
server.registerTool(
  "monitor_task_link",
  {
    title: "Monitor Task Link",
    description: "Link a monitored task to its parent/background context.",
    inputSchema: {
      taskId: z.string(),
      title: z.string().optional(),
      taskKind: z.enum(["primary", "background"]).optional(),
      parentTaskId: z.string().optional(),
      parentSessionId: z.string().optional(),
      backgroundTaskId: z.string().optional()
    }
  },
  async (input) => toToolResponse(await client.post("/api/task-link", input))
);
```

- [ ] **Step 2: Place the tool in lifecycle/parity docs inside the MCP server**

Acceptance:
- comments near task lifecycle tools mention `monitor_task_link`
- OpenCode background linking is no longer HTTP-only by design

- [ ] **Step 3: Extend client tests**

Add assertions for:
- tool registration name exists
- request path is `/api/task-link`
- payload forwards `parentTaskId`, `parentSessionId`, `backgroundTaskId`, `title`

- [ ] **Step 4: Re-run MCP tests**

Run:

```bash
npm run test --workspace @monitor/mcp
```

Expected:
- PASS

- [ ] **Step 5: Commit MCP parity**

```bash
git add packages/mcp/src/index.ts packages/mcp/test/client.test.ts
git commit -m "feat(mcp): add monitor_task_link tool"
```

### Task 4: Clarify `session-end` semantics without breaking OpenCode

**Files:**
- Modify: `packages/core/src/domain.ts`
- Modify: `packages/server/src/application/types.ts`
- Modify: `packages/mcp/src/index.ts`
- Modify: `packages/server/test/presentation/create-app.test.ts`

- [ ] **Step 1: Rewrite the comment-level contract**

New rule to encode:
- `session-end` is always the automatic runtime close path
- `completeTask` is adapter-dependent and explicit
- Claude uses `completeTask=false`
- OpenCode primary uses `completeTask=true`
- background tasks may auto-complete after last session close

- [ ] **Step 2: Update the MCP description string**

The description for `monitor_session_end` must stop saying “without completing the work item” as an unconditional rule.

Replace with wording equivalent to:

```text
End the current runtime session. Some adapters also pass completeTask=true when session closure is terminal for that runtime.
```

- [ ] **Step 3: Add HTTP tests for both branches**

Add/adjust tests covering:
- `POST /api/session-end` with `completeTask` omitted keeps primary task `running`
- `POST /api/session-end` with `completeTask:true` completes primary task
- background completion behavior remains unchanged

- [ ] **Step 4: Re-run focused tests**

Run:

```bash
npm run test --workspace @monitor/server -- create-app.test.ts
npm run test --workspace @monitor/mcp -- client.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit contract clarification**

```bash
git add packages/core/src/domain.ts packages/server/src/application/types.ts packages/mcp/src/index.ts packages/server/test/presentation/create-app.test.ts
git commit -m "docs(contract): clarify adapter-specific session end semantics"
```

## Chunk 2: Adapter Alignment, Skills, And Docs

### Task 5: Align Claude hooks, docs, and tests with actual raw-capture behavior

**Files:**
- Modify: `.claude/hooks/session_stop.py`
- Modify: `.claude/settings.json`
- Modify: `docs/guide/claude-setup.md`
- Modify: `docs/guide/llm-setup.md`
- Modify: `packages/server/test/claude-settings.test.ts`
- Modify: `packages/server/test/presentation/create-app.test.ts`

- [ ] **Step 1: Settle the Claude Stop policy**

Change `.claude/hooks/session_stop.py` so Claude Stop ends the runtime session without closing the task.

Target payload:

```py
_post("/api/runtime-session-end", {
    "runtimeSource": "claude-hook",
    "runtimeSessionId": session_id,
    "summary": "Claude Code session ended"
})
```

Acceptance:
- `completeTask` is omitted or explicitly `False`

- [ ] **Step 2: Make the guide list the real hook set**

`docs/guide/claude-setup.md` must list:
- `session_start.py`
- `user_prompt.py`
- `ensure_task.py`
- `terminal.py`
- `tool_used.py`
- `explore.py`
- `agent_activity.py`
- `session_stop.py`

- [ ] **Step 3: Rewrite the raw prompt section**

Replace the “raw prompt unavailable” claim with:
- `UserPromptSubmit` captures raw prompt text when Claude provides it
- fallback gap event should only be used when payload lacks prompt text

- [ ] **Step 4: Rewrite the session lifecycle table**

New expected row for Stop:
- `session_stop.py` ends the session only
- task remains `running`
- explicit task completion still uses MCP `monitor_task_complete`

- [ ] **Step 5: Strengthen the Claude settings test**

Add assertions for:
- `UserPromptSubmit` exists
- its command points to `.claude/hooks/user_prompt.py`
- all hook commands still include the OpenCode guard
- `Stop` exists and points to `.claude/hooks/session_stop.py`

- [ ] **Step 6: Add real endpoint coverage for `runtime-session-end`**

Add/adjust `packages/server/test/presentation/create-app.test.ts` so the `POST /api/runtime-session-end` block proves:
- omitted `completeTask` keeps the ensured task `running`
- explicit `completeTask:true` completes the ensured task
- reopening after a non-completing end still reuses the same task

Suggested test flow:

```ts
const ensured = await request(app)
  .post("/api/runtime-session-ensure")
  .send({ runtimeSource: "claude-hook", runtimeSessionId: "sess-stop", title: "Claude Hook Task" });

await request(app)
  .post("/api/runtime-session-end")
  .send({ runtimeSource: "claude-hook", runtimeSessionId: "sess-stop" });

const task = await request(app).get(`/api/tasks/${ensured.body.taskId}`);
expect(task.body.task.status).toBe("running");
```

- [ ] **Step 7: Re-run focused tests**

Run:

```bash
npm run test --workspace @monitor/server -- claude-settings.test.ts create-app.test.ts
```

Expected:
- PASS

- [ ] **Step 8: Commit Claude alignment**

```bash
git add .claude/hooks/session_stop.py .claude/settings.json docs/guide/claude-setup.md docs/guide/llm-setup.md packages/server/test/claude-settings.test.ts packages/server/test/presentation/create-app.test.ts
git commit -m "fix(claude): align hook docs and stop semantics"
```

### Task 6: Align OpenCode docs with actual raw capture and preserve OmO envelope metadata

**Files:**
- Modify: `.opencode/plugins/monitor.ts`
- Modify: `docs/guide/opencode-setup.md`
- Modify: `packages/server/test/opencode-monitor-plugin.test.ts`

- [ ] **Step 1: Preserve normalized envelope metadata in the plugin**

When `deriveUserMessageFields()` strips OmO wrapper markers, keep metadata so future debugging can see what happened.

Suggested metadata additions:

```ts
metadata: {
  ...,
  messageEnvelope: "oh-my-opencode",
  rawBody: text,
  normalizedBody: message.body
}
```

Only include `messageEnvelope` when wrapper markers are detected.

- [ ] **Step 2: Keep the raw `user-message` event path unchanged**

Do not change:
- `captureMode: "raw"`
- `source: "opencode-plugin"`
- `phase` calculation

This task is metadata enrichment plus docs sync, not a contract rewrite.

- [ ] **Step 3: Update the OpenCode setup guide**

Rewrite the raw capture section so it states:
- `chat.message` is used for raw user prompts
- OmO wrapped prompts are normalized before logging
- wrapper support is tested in-repo

- [ ] **Step 4: Add/adjust plugin tests**

Cover:
- `chat.message` still posts `/api/user-message`
- wrapped OmO content still extracts `filePaths`
- new metadata fields are present only when wrapper markers exist

- [ ] **Step 5: Re-run focused plugin tests**

Run:

```bash
npm run test --workspace @monitor/server -- opencode-monitor-plugin.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit OpenCode alignment**

```bash
git add .opencode/plugins/monitor.ts docs/guide/opencode-setup.md packages/server/test/opencode-monitor-plugin.test.ts
git commit -m "feat(opencode): document raw capture and preserve omo envelope metadata"
```

### Task 7: Unify fallback policy when `monitor-server` is unavailable

**Files:**
- Modify: `AGENTS.md`
- Modify: `skills/codex-monitor/SKILL.md`
- Modify: `skills/monitor/SKILL.md`
- Modify: `docs/guide/codex-setup.md`
- Modify: `docs/guide/claude-setup.md`
- Modify: `docs/guide/opencode-setup.md`

- [ ] **Step 1: Pick one canonical sentence**

Use this policy everywhere:

```text
If monitor-server / monitor MCP is unavailable, continue the user task and report the monitoring gap in the final response.
```

- [ ] **Step 2: Rewrite both skill quick-start sections**

Replace “없으면 중단” wording in:
- `skills/codex-monitor/SKILL.md`
- `skills/monitor/SKILL.md`

- [ ] **Step 3: Align AGENTS and guide language**

Acceptance:
- no doc says “stop work”
- no doc claims monitoring is mandatory for the task itself to proceed

- [ ] **Step 4: Verify wording drift is gone**

Run:

```bash
rg -n "없으면 중단|중단하고 서버 먼저 시작|gap 리포트" AGENTS.md skills docs/guide -S
```

Expected:
- only the canonical continue+gap wording remains

- [ ] **Step 5: Commit fallback policy sync**

```bash
git add AGENTS.md skills/codex-monitor/SKILL.md skills/monitor/SKILL.md docs/guide/codex-setup.md docs/guide/claude-setup.md docs/guide/opencode-setup.md
git commit -m "docs(skills): unify monitor-server fallback policy"
```

### Task 8: Add native skill projections and a sync script

**Files:**
- Create: `scripts/sync-skill-projections.mjs`
- Create: `.agents/skills/codex-monitor/SKILL.md`
- Create: `.agents/skills/monitor/SKILL.md`
- Create: `.claude/skills/agent-tracer-monitor/SKILL.md`
- Modify: `docs/guide/codex-setup.md`
- Modify: `docs/guide/claude-setup.md`
- Modify: `docs/guide/llm-setup.md`
- Modify: `packages/server/src/seed.ts`

- [ ] **Step 1: Define projection strategy**

Keep canonical sources:
- `skills/codex-monitor/SKILL.md`
- `skills/monitor/SKILL.md`

Generated targets:
- `.agents/skills/codex-monitor/SKILL.md`
- `.agents/skills/monitor/SKILL.md`
- `.claude/skills/agent-tracer-monitor/SKILL.md`

- [ ] **Step 2: Implement the sync script**

Suggested behavior:
- read source skill files
- prepend generated-file banner
- write target files
- support `--check` and default write mode

Suggested banner:

```md
<!-- GENERATED FILE: edit skills/... source, then run node scripts/sync-skill-projections.mjs -->
```

- [ ] **Step 3: Generate initial projections**

Run:

```bash
node scripts/sync-skill-projections.mjs
```

Expected:
- all projection files are created

- [ ] **Step 4: Update Codex and Claude docs to point at native discovery/fallback**

`docs/guide/codex-setup.md` should explain:
- current repo still has `skills/` as canonical source
- Codex-native discovery happens through `.agents/skills`
- the projection files are generated artifacts

`docs/guide/claude-setup.md` should explain:
- hooks remain the primary monitoring path
- `.claude/skills/agent-tracer-monitor/SKILL.md` is only a manual fallback/native discovery aid
- fallback skill should not replace hook-based automatic monitoring

- [ ] **Step 5: Update seed/example data**

If `packages/server/src/seed.ts` renders `skillPath`, switch example data to a projected path or explicitly annotate it as canonical source path.

Acceptance:
- seed data no longer implies only `skills/...` is used at runtime

- [ ] **Step 6: Add a projection drift check**

Run:

```bash
node scripts/sync-skill-projections.mjs --check
```

Expected:
- PASS with exit code 0 after generation

- [ ] **Step 7: Smoke-check both native discovery targets**

Run:

```bash
rg -n "GENERATED FILE" .agents/skills .claude/skills -S
```

Expected:
- generated banner appears in both `.agents/skills/...` and `.claude/skills/...`

- [ ] **Step 8: Commit native skill projection**

```bash
git add scripts/sync-skill-projections.mjs .agents/skills .claude/skills docs/guide/codex-setup.md docs/guide/claude-setup.md docs/guide/llm-setup.md packages/server/src/seed.ts
git commit -m "feat(skills): add native skill projections for codex and claude"
```

### Task 9: Document the runtime capability matrix and reflect adapter labels in the web UI

**Files:**
- Create: `docs/guide/runtime-capabilities.md`
- Modify: `docs/guide/llm-setup.md`
- Modify: `packages/web/src/components/TaskList.tsx`
- Modify: `packages/web/src/components/TaskList.test.ts`

- [ ] **Step 1: Add a comparison table**

The doc must include columns for:
- adapter ID
- raw prompt capture
- tool call capture
- subagent capture
- native skill paths
- event stream availability
- session-close completion policy

- [ ] **Step 2: Include one row per adapter**

Required rows:
- `claude-hook`
- `codex-skill`
- `opencode-plugin`
- `opencode-sse`

- [ ] **Step 3: Link every setup guide back to the matrix**

Acceptance:
- `llm-setup.md` has one short section pointing readers to `runtime-capabilities.md`

- [ ] **Step 4: Update `TaskList` runtime badge helpers**

Handle at minimum:
- `claude-hook` → `Claude Code`
- `codex-skill` → `Codex`
- `opencode-plugin` → `OpenCode`
- `opencode-sse` → `OpenCode SSE`

Acceptance:
- unknown sources still fall back to the raw source string
- `codex-skill` and `opencode-sse` no longer render as `other`

- [ ] **Step 5: Add focused UI tests**

Add test cases in `packages/web/src/components/TaskList.test.ts` for:
- runtime badge text for `codex-skill`
- runtime badge text for `opencode-sse`
- fallback behavior for an unknown source

- [ ] **Step 6: Re-run focused web tests**

Run:

```bash
npm run test --workspace @monitor/web -- TaskList.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit docs matrix and UI labels**

```bash
git add docs/guide/runtime-capabilities.md docs/guide/llm-setup.md packages/web/src/components/TaskList.tsx packages/web/src/components/TaskList.test.ts
git commit -m "feat(runtime): add adapter capability matrix and ui labels"
```

### Task 10: Add an opt-in OpenCode SSE bridge

**Files:**
- Create: `packages/server/src/integration/opencode-sse-bridge.ts`
- Create: `packages/server/test/integration/opencode-sse-bridge.test.ts`
- Create: `docs/guide/opencode-sse-bridge.md`
- Create: `packages/server/test/index.test.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `docs/guide/opencode-setup.md`

- [ ] **Step 1: Implement a read-only bridge module**

Target responsibilities:
- connect to OpenCode `/global/event`
- parse SSE frames
- map `session.created`, `session.deleted`, and selected message/tool events to Agent Tracer HTTP calls
- never mutate OpenCode state

- [ ] **Step 2: Wire the bridge into server startup**

Modify `packages/server/src/index.ts` so startup can optionally launch the bridge.

Target shape:

```ts
export interface ServerRuntimeOptions {
  readonly port?: number;
  readonly databasePath?: string;
  readonly rulesDir?: string;
  readonly opencodeMonitoringMode?: "plugin" | "sse";
  readonly opencodeSseBaseUrl?: string;
}
```

Boot rule:
- only start the bridge when `opencodeMonitoringMode === "sse"`
- require `opencodeSseBaseUrl`
- default mode remains `plugin`

- [ ] **Step 3: Use mutual exclusion instead of cross-adapter dedupe**

Document and enforce:
- plugin and SSE bridge must not be enabled for the same OpenCode environment
- if mode is `plugin`, bridge startup is skipped
- if mode is `sse`, `.opencode/plugins/monitor.ts` should not be installed for that environment

No shared dedupe contract is in scope for this phase.

- [ ] **Step 4: Keep the bridge narrow**

Initial event support only:
- session lifecycle
- user message stream if present
- tool/message-part updates needed for observability

Explicitly defer:
- every low-level UI event
- write-side commands back into OpenCode

- [ ] **Step 5: Add tests with mocked SSE frames and startup wiring**

Test cases:
- bridge connects and parses frames
- supported events emit the expected Agent Tracer HTTP calls
- `startMonitoringServer()` does not start the bridge in `plugin` mode
- `startMonitoringServer()` starts the bridge in `sse` mode when base URL is provided

- [ ] **Step 6: Document when to use the bridge**

`docs/guide/opencode-sse-bridge.md` should say:
- plugin remains primary path
- SSE bridge is for environments where plugin installation is not possible or where server-level observation is needed
- plugin mode and SSE mode are mutually exclusive

- [ ] **Step 7: Re-run server tests**

Run:

```bash
npm run test --workspace @monitor/server -- index.test.ts opencode-sse-bridge.test.ts opencode-monitor-plugin.test.ts create-app.test.ts
```

Expected:
- PASS

- [ ] **Step 8: Commit the experimental bridge**

```bash
git add packages/server/src/index.ts packages/server/src/integration/opencode-sse-bridge.ts packages/server/test/index.test.ts packages/server/test/integration/opencode-sse-bridge.test.ts docs/guide/opencode-sse-bridge.md docs/guide/opencode-setup.md
git commit -m "feat(opencode): add experimental sse bridge"
```

## Final Verification

- [ ] **Step 1: Run package test suites**

Run:

```bash
npm run test --workspace @monitor/core
npm run test --workspace @monitor/mcp
npm run test --workspace @monitor/server
npm run test --workspace @monitor/web -- TaskList.test.ts
```

Expected:
- all PASS

- [ ] **Step 2: Run package builds**

Run:

```bash
npm run build --workspace @monitor/core
npm run build --workspace @monitor/mcp
npm run build --workspace @monitor/server
npm run build --workspace @monitor/web
```

Expected:
- all PASS

- [ ] **Step 3: Run a wording drift check across docs and skills**

Run:

```bash
rg -n "raw prompt unavailable|user-message-capture-unavailable|monitor-server.*중단|skills/codex-monitor/SKILL.md" AGENTS.md docs skills .claude .agents .opencode packages -S
```

Expected:
- only intentional fallback references remain
- stale claims are gone

- [ ] **Step 4: Manual smoke-check the three runtime surfaces**

Verify manually:
- Claude hook path logs raw prompt and leaves task running after Stop
- Codex path can discover projected `.agents/skills` content and still use MCP monitoring
- Claude fallback path can discover `.claude/skills/agent-tracer-monitor/SKILL.md` without disturbing hook-based monitoring
- OpenCode plugin logs raw `chat.message`, preserves OmO envelope metadata, and background link handling still works
- OpenCode SSE mode starts only when explicitly configured and is not enabled alongside plugin mode

- [ ] **Step 5: Final worktree check**

```bash
git status --short
```

Expected:
- worktree is clean because each task already committed its own changes
- if anything remains, treat it as a missed task-specific commit and fix that task instead of creating a catch-all integration commit

## Review Notes For The Implementer

- Do not silently change OpenCode task completion policy while fixing Claude policy. The runtime matrix exists to preserve that intentional difference.
- Keep `skills/` source files human-edited and projection targets generated. Do not start hand-editing projected files.
- Prefer focused test additions over new ad-hoc scripts unless a runtime truly cannot be exercised in Vitest.
- If the SSE bridge proves too unstable in one pass, land Chunks 1-2 first and gate Chunk 10 behind a separate follow-up PR without blocking the main contract cleanup.
