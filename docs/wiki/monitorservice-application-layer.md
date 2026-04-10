# MonitorService: Application Layer

`MonitorService`는 현재 서버의 주 유스케이스를 거의 모두 들고 있는 애플리케이션 서비스다.
태스크 시작부터 workflow evaluation 검색까지 대부분의 요청이 결국 이 클래스로 들어온다.

## 핵심 파일

- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/application/types.ts`
- `packages/server/src/application/services/event-recorder.ts`
- `packages/server/src/application/services/session-lifecycle-policy.ts`
- `packages/server/src/application/services/trace-metadata-factory.ts`
- `packages/server/src/application/services/task-display-title-resolver.helpers.ts`
- `packages/server/src/application/services/task-display-title-resolver.constants.ts`
- `packages/server/src/application/services/event-recorder.helpers.ts`
- `packages/server/src/application/services/trace-metadata-factory.helpers.ts`
- `packages/server/src/application/workflow-context-builder.helpers.ts`

## 주요 책임

### Task/session lifecycle

- `startTask()`
- `completeTask()`
- `errorTask()`
- `endSession()`
- `ensureRuntimeSession()`
- `endRuntimeSession()`
- `linkTask()`

이 경로가 task state, running session count, background lineage를 함께 다룬다.

### Event logging

- `logToolUsed()`
- `logTerminalCommand()`
- `saveContext()`
- `logExploration()`
- `logPlan()`
- `logAction()`
- `logVerification()`
- `logRule()`
- `logQuestion()`
- `logAssistantResponse()`
- `logQuestion()`
- `logTodo()`
- `logThought()`

### SessionId 결합 규칙

`MonitorService`는 이벤트 기록 입력을 두 가지 방식으로 결합한다:

- `user.message` 계열은 `sessionId`가 필수이므로 그대로 사용한다.
- `assistant.response`, `question`, `todo`, `thought`, `tool-used` 같은 일부 이벤트는
  `sessionId` 생략 시 `resolveSessionId(taskId, sessionId)`로 해당 task의
  현재 active session을 조회해 사용한다.
- 실제 이벤트 payload에 포함할 때는 공통 헬퍼 `withSessionId()`를 통해
  `...(resolvedSessionId ? { sessionId: resolvedSessionId } : {})` 형태로 통일해 기록한다.

이 규칙은 특히 `question`, `todo`, `thought`처럼 런타임에서 context 기반 호출이 잦은 이벤트에서 일관된 세션 바인딩을 보장한다.

실제 event insert는 `EventRecorder`가 맡고, `MonitorService`는 입력 검증 이후의
유스케이스와 lifecycle 맥락을 조정한다.

### Bookmark, search, workflow library

- bookmark 저장/삭제/조회
- full-text search
- task evaluation 저장/조회
- workflow library 목록 조회
- 유사 워크플로우 검색

최근 코드 기준으로 `listEvaluations()`가 추가돼
`GET /api/workflows`와 웹 workflow library 패널을 직접 지원한다.

## helper service의 역할

### `EventRecorder`

분류와 저장을 묶는다. `classifyEvent()`를 호출하고,
필요하면 `file.changed` 파생 이벤트도 만든다.

### `SessionLifecyclePolicy`

primary/background task가 언제 자동 완료되거나 waiting으로 이동할지 판단한다.

### `TraceMetadataFactory`

relation, activity, compact, verification, question/todo metadata를 정리하고 tag를 도출한다.

### `deriveTaskDisplayTitle`

task title이 너무 generic할 때 user prompt와 초반 이벤트를 바탕으로 더 의미 있는 표시 제목을 추론한다.
`task-display-title-resolver.ts`는 분해되어 더 이상 단일 파일이 아니며
`task-display-title-resolver.helpers.ts` + `task-display-title-resolver.constants.ts`
로 나뉘었고, `session/task` repository에서 사용된다.

## 읽기 경로와 쓰기 경로

### 쓰기 경로

route -> schema -> `MonitorService` -> `EventRecorder`/repository -> notifier

### 읽기 경로

route -> `MonitorService` -> repository 집계 -> read-model 응답

workflow search와 display title 계산처럼 읽기 경로에도 꽤 많은 파생 계산이 들어가므로,
이 클래스는 단순 command handler보다는 "작은 read-model service" 역할도 함께 가진다.

## 강점

- 서버 유스케이스가 한 진입점에 모여 있어 추적이 쉽다.
- port interface 기반이라 테스트가 비교적 잘 붙는다.
- runtime session helper와 workflow library까지 같은 task model 위에서 묶을 수 있다.

## 현재 리스크

- 책임 집중이 심해 변경 영향 범위가 넓다.
- read path 비용과 lifecycle 판단이 한 클래스에 모여 있다.
- async dedupe 상태(`seenAsyncEvents`)가 메모리에 남는다.
- bookmark/search/evaluation까지 같이 들어 있어 응집도가 높지 않다.

## 분리 후보

- `TaskLifecycleService`
- `RuntimeSessionService`
- `EventLoggingService`
- `BookmarkService`
- `WorkflowEvaluationService`
- `TaskQueryService`

## 관련 문서

- [Monitor Server](./monitor-server.md)
- [HTTP API Reference](./http-api-reference.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
