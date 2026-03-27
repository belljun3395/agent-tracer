# Codex Skill Adapter

Codex 통합은 hook만으로 끝나지 않는다. Agent Tracer에서 Codex의
`assistant.response`와 고수준 planning context를 제대로 남기려면
`codex-monitor` skill + MCP 경로가 필요하다.

핵심 이유는 단순하다.

- Codex native hooks는 `user.message`, Bash, transcript backfill 같은 저수준 신호는 잡을 수 있다.
- 하지만 final assistant answer text는 native `Stop` payload에 들어오지 않는다.
- 따라서 `assistant.response`는 skill이 `monitor_assistant_response`를 직접 호출하는 방식이 캐노니컬이다.

## 핵심 파일

- `skills/codex-monitor/SKILL.md`
- `.agents/skills/codex-monitor/SKILL.md`
- `docs/guide/codex-setup.md`
- `packages/mcp/src/index.ts`
- `packages/server/test/presentation/create-app.test.ts`
- `scripts/sync-skill-projections.mjs`
- `AGENTS.md`

## 언제 이 경로를 쓰는가

다음 중 하나라도 필요하면 hook-only가 아니라 skill path를 써야 한다.

- final answer를 `assistant.response`로 남겨야 한다
- follow-up turn을 같은 Codex thread/topic task에 재사용해야 한다
- planning, thought, verification 같은 고수준 semantic event를 수동으로 남겨야 한다
- workflow library search/evaluation을 Codex에서도 같은 규칙으로 운영해야 한다

## 기본 흐름

1. Codex가 repo-local `codex-monitor` 스킬을 읽는다.
2. turn 시작 시 `monitor_runtime_session_ensure`를 호출한다.
3. `monitor_user_message`로 실제 사용자 요청을 기록한다.
4. 탐색, 계획, 검증, 터미널, 주요 도구 사용을 `monitor_*` 도구로 남긴다.
5. final answer 직전에 `monitor_assistant_response`를 남긴다.
6. turn 종료 시 `monitor_runtime_session_end`를 호출한다.
7. thread/topic 전체 작업이 끝났을 때만 `monitor_task_complete` 또는 `monitor_task_error`를 호출한다.

## `assistant.response`를 skill이 맡는 이유

현재 코드 기준으로:

- Codex hook path는 `UserPromptSubmit`, `PreToolUse`, `PostToolUse(Bash)`, `Stop`만 자동 관찰한다.
- `Stop`은 transcript backfill(`web_search_end`, `apply_patch`)과 turn 종료 처리에는 충분하다.
- 하지만 final assistant text는 `Stop` payload에 없다.

그래서 Codex의 대화 경계는 다음처럼 나뉜다.

- user side: `monitor_user_message`
- assistant side: `monitor_assistant_response`

이 둘이 Codex skill 경로에서 canonical conversation-boundary event다.

## runtime session 재사용 모델

Codex skill path는 `runtimeSource: "codex-skill"`을 사용한다.
같은 thread/topic 안 follow-up turn은 같은 `runtimeSessionId`를 계속 재사용한다.

이 설계의 효과:

- 첫 turn과 follow-up turn이 같은 task에 이어 붙는다
- 각 turn은 새로운 session row를 가질 수 있어도 task row는 재사용된다
- `assistant.response`는 같은 task 아래에 누적된다

서버 쪽 회귀 테스트는
`packages/server/test/presentation/create-app.test.ts`의
`"Codex runtime 세션은 같은 thread id에서 task를 재사용하고 assistant.response를 남긴다"`
케이스가 검증한다.

## hook 경로와의 관계

Codex에는 현재 두 경로가 공존한다.

- `codex-hook`
- `codex-skill`

이 둘은 역할이 다르고, 현재는 runtimeSource도 다르다.
즉 같이 켜면 task lineage도 분리될 수 있다.

### `codex-hook`

- 장점: 자동 Bash / transcript backfill
- 한계: `assistant.response` 본문 불가
- 적합한 용도: passive background tracing

### `codex-skill`

- 장점: `assistant.response`, planning, explicit semantic event
- 한계: 지침을 따라 수동 호출해야 함
- 적합한 용도: primary Codex tracing path

### 함께 쓸 때

- hook은 저수준 신호 보강용
- skill은 conversation-boundary + semantic context 용
- 대시보드에서는 `codex-hook`, `codex-skill` task가 별도로 보일 수 있음

## repo-local과 external discovery

repo-local:

- source-of-truth: `skills/codex-monitor/SKILL.md`
- Codex discovery path: `.agents/skills/codex-monitor/SKILL.md`
- `AGENTS.md`가 repo-local skill 사용을 유도

external project:

- `setup:external --mode codex`가 target repo의 `AGENTS.md` managed block을 갱신
- `.agents/skills/codex-monitor/SKILL.md`를 생성
- `.codex/config.toml`, `.codex/hooks.json`, `.agent-tracer/.codex/*`도 함께 준비 가능

skill source를 바꿨으면 `npm run sync:skills`가 필요하다.

## 실패 모드와 체크리스트

### `assistant.response`가 안 남는 경우

1. `monitor` MCP 서버가 Codex에 등록되어 있는지 확인
2. Codex가 `codex-monitor` 스킬을 실제로 읽었는지 확인
3. final answer 직전에 `monitor_assistant_response`를 호출하는지 확인
4. `monitor_runtime_session_end`를 answer 기록보다 먼저 호출하지 않았는지 확인

### skill이 로드되지 않는 경우

1. `.agents/skills/codex-monitor/SKILL.md`가 최신 projection인지 확인
2. `skills/codex-monitor/SKILL.md` 수정 뒤 `npm run sync:skills`를 실행했는지 확인
3. 현재 Codex thread를 재시작했는지 확인
4. 자동 트리거가 빗나가면 `$codex-monitor`를 명시

### hook과 skill이 둘 다 보여 혼란스러운 경우

- expected behavior일 수 있다
- `codex-hook` task는 low-level automatic path
- `codex-skill` task는 semantic/manual path
- assistant answer text를 찾을 때는 `codex-skill` lineage를 본다

## 장점과 한계

장점:

- assistant response를 안정적으로 남길 수 있다
- thread/topic 단위 task 재사용이 명시적이다
- planning/verification 같은 고신호 이벤트를 적극적으로 남길 수 있다

한계:

- automatic hook 수준의 관찰 범위는 없다
- skill이 로드되지 않거나 projection이 오래되면 기록 품질이 바로 떨어진다
- hook과 같이 켜면 현재는 별도 lineage가 생길 수 있다

## 관련 문서

- [Codex Setup Guide](../guide/codex-setup.md)
- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [MCP Tool Reference](./mcp-tool-reference.md)
- [setup:external Automation Script](./setup-external-automation-script.md)
