# Codex App Server Capture Plan

## 목적

이 문서는 Codex app-server JSON-RPC를 사용해 Agent Tracer의 Codex capture
범위를 확장하는 2차 계획을 정리한다.

현재 1차 구현은 hooks 중심이다. 이 문서는 hooks를 대체하는 계획이 아니라,
**hooks로 유지하는 기본 capture 위에 app-server를 추가해 richer capture를
얹는 계획**이다.

## 현재 전제

현재 Codex 1차 integration은 다음을 제공한다.

- plain `codex` 사용
- repo-local `.codex/config.toml`
- repo-local `.codex/hooks.json`
- 최소 hook 기반 capture
  - `context.saved`
  - `user.message`
  - `terminal.command` (`Bash` only)
  - `assistant.response`

즉, app-server 단계는 “지금 있는 것을 버리는 단계”가 아니라, **현재 hooks가
잡지 못하는 interactive lifecycle과 item-level capture를 보강하는 단계**다.

## 결론 먼저

### hooks는 유지한다

이유:

- plain `codex` 사용자 경험을 그대로 살릴 수 있다.
- setup이 단순하다.
- 기본적인 세션/프롬프트/Bash/응답 캡처는 이미 충분히 실용적이다.

### app-server는 추가한다

이유:

- hooks가 못 잡는 richer interactive state를 캡처할 수 있다.
- file change, MCP call, turn lifecycle, plan update, approval 흐름을
  구조적으로 다룰 수 있다.

즉, 방향은 다음과 같다.

- **1차:** hooks-only baseline
- **2차:** hooks + app-server hybrid

## 공식 문서 기준으로 기대하는 표면

기준 문서:

- Hooks: https://developers.openai.com/codex/hooks
- App Server: https://developers.openai.com/codex/app-server

app-server 문서 기준으로 관심 있는 축은 다음이다.

### thread lifecycle

- `thread/start`
- `thread/resume`
- `thread/fork`
- `thread/read`
- `thread/started`
- `thread/status/changed`
- `thread/closed`

### turn lifecycle

- `turn/start`
- `turn/interrupt`
- `turn/completed`
- `turn/diff/updated`
- `turn/plan/updated`

### item stream

- `item/started`
- `item/completed`
- `item/agentMessage/delta`
- `item/commandExecution/outputDelta`
- `item/fileChange/outputDelta`

### item types

- `agentMessage`
- `reasoning`
- `plan`
- `commandExecution`
- `fileChange`
- `mcpToolCall`

### approval / server request 흐름

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`
- `serverRequest/resolved`

## hooks 대비 app-server로 추가되는 가치

| 범주 | hooks | app-server |
|---|---|---|
| 세션 시작/프롬프트/최종 응답 | 가능 | 가능 |
| turn 시작/완료/중단 | 제한적 | 가능 |
| 중간 agent message delta | 불가 | 가능 |
| reasoning 요약/텍스트 | 불가 | 가능 |
| file change | 불가 | 가능 |
| MCP call | 불가 | 가능 |
| plan update | 불가 | 가능 |
| approval 흐름 | 불가 | 가능 |
| thread 상태 변화 | 불가 | 가능 |

따라서 app-server를 붙이면 Codex 쪽 capture는 다음처럼 확장된다.

- “프롬프트 제출과 최종 응답만 보는 흐름”
- 에서
- “interactive turn이 어떤 단계로 진행되었고, 어떤 파일을 바꾸려 했고,
  어떤 도구를 불렀고, 어떤 승인 과정을 거쳤는지 보는 흐름”

으로 올라간다.

## Agent Tracer 관점의 2차 MVP 범위

2차에서 한 번에 모든 event를 다 넣기보다, capture 가치가 큰 순서대로
좁히는 것이 맞다.

### MVP-1: turn lifecycle

우선 수집:

- `turn/start`
- `turn/completed`
- `turn/interrupt`

목적:

- session/turn 상태 모델 확보
- hooks-only보다 더 정확한 진행 상태 표현

예상 매핑:

- `turn/start` -> workflow/action 계열
- `turn/completed` -> verification / lifecycle 보강
- `turn/interrupt` -> action / verification 보강

### MVP-2: item skeleton

우선 수집:

- `item/started`
- `item/completed`

목적:

- interactive timeline의 기본 뼈대 확보
- 이후 item subtype capture 확장의 공통 프레임 마련

### MVP-3: commandExecution / fileChange

우선 수집:

- `commandExecution`
- `fileChange`

목적:

- hooks-only의 가장 큰 빈 곳 보강
- 파일 수정과 명령 실행을 richer하게 추적

예상 매핑:

- `commandExecution` -> `terminal.command`
- `fileChange` -> `tool.used`

### MVP-4: mcpToolCall / plan

우선 수집:

- `mcpToolCall`
- `turn/plan/updated`
- 최종 `plan` item

목적:

- coordination / planning 관측 강화

예상 매핑:

- `mcpToolCall` -> `agent.activity.logged`
- `plan` / `turn/plan/updated` -> `plan.logged`

### MVP-5: approval 흐름

우선 수집:

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`
- `serverRequest/resolved`

목적:

- 단순 “실행됨”이 아니라
  “승인 요청 -> 사용자 응답 -> 해소” 흐름 자체를 보이기 위함

예상 매핑:

- `requestApproval` -> `action.logged` 또는 `question.logged`
- `serverRequest/resolved` -> `action.logged`

## shared event 매핑 초안

이 단계에서는 기존 shared 스펙을 최대한 재사용한다.

| app-server event/item | Agent Tracer shared event |
|---|---|
| `thread/started` | `context.saved` |
| `turn/start` | `action.logged` 또는 workflow 계열 |
| `turn/completed` | `verification.logged` / lifecycle 보강 |
| `turn/plan/updated` | `plan.logged` |
| `agentMessage` | `assistant.response` |
| `reasoning` | `thought.logged` |
| `commandExecution` | `terminal.command` |
| `fileChange` | `tool.used` |
| `mcpToolCall` | `agent.activity.logged` |
| approval request | `action.logged` / `question.logged` |

## 구현 전략

## 1. hooks는 그대로 둔다

hooks를 지우지 않는다.

이유:

- plain `codex` baseline은 계속 필요하다.
- app-server가 없거나 꺼져 있어도 최소 capture는 살아 있어야 한다.

즉, hooks는 fallback이 아니라 **baseline**이다.

## 2. app-server capture는 별도 adapter로 추가한다

권장 구조:

- `packages/runtime/src/codex-app-server/*`
  또는
- `packages/runtime/src/codex/app-server/*`

역할:

- JSON-RPC transport 연결
- thread/turn/item event 수집
- shared 이벤트로 정규화
- monitor ingest

## 3. 중복 정책은 명시적으로 둔다

hooks와 app-server가 동시에 켜질 수 있으므로, 중복 규칙이 필요하다.

초기 가정:

- `context.saved`, `user.message`, `assistant.response`, `terminal.command`
  는 중복 가능성이 높다.
- app-server 경로가 존재하면 richer event를 우선 신뢰한다.
- hooks는 baseline / fallback 성격으로 둔다.

이 정책은 2차 구현에서 별도 정리해야 한다.

## open question

### 1. app-server를 어떻게 attach할 것인가

정해야 할 것:

- setup:external이 app-server 연결까지 자동화할지
- 아니면 별도 개발자 도구/bridge로 둘지

### 2. interactive 주력 경로를 바꿀 것인가

선택지:

- plain `codex` + hooks 유지
- app-server가 있을 때 richer capture만 추가
- 장기적으로 app-server를 interactive 주력으로 올림

현재 판단:

- 당장은 hooks 유지 + app-server 추가가 맞다.

### 3. approval 흐름을 어느 shared kind로 둘 것인가

현재 shared 스펙에서:

- `action.logged`
- `question.logged`

중 어디가 더 자연스러운지 결정이 필요하다.

## 다음 구현 순서 제안

1. app-server event 매핑 문서 고정
2. `turn/*` + `item/started|completed` 최소 adapter 구현
3. `commandExecution` / `fileChange` 추가
4. `mcpToolCall` / `plan` 추가
5. approval 흐름 추가
6. hooks + app-server dedupe 규칙 정리

## 문서 연결

- 현재 1차 상태:
  [`CODEX_ADAPTER_1차_구현_및_검증계획.md`](./CODEX_ADAPTER_1%EC%B0%A8_%EA%B5%AC%ED%98%84_%EB%B0%8F_%EA%B2%80%EC%A6%9D%EA%B3%84%ED%9A%8D.md)
- 전체 단계 로드맵:
  [`CODEX_ADAPTER_로드맵.md`](./CODEX_ADAPTER_%EB%A1%9C%EB%93%9C%EB%A7%B5.md)
- 현재 hooks 기반 데이터 흐름:
  [`packages/runtime/CODEX_DATA_FLOW.md`](./packages/runtime/CODEX_DATA_FLOW.md)
