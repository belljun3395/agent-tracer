# Domain Model: Tasks, Sessions & Timeline Events

Agent Tracer는 모든 기록을 task, session, timeline event라는 세 축으로 정리한다.
이 모델을 이해하면 서버 API, MCP payload, 대시보드 UI가 왜 현재 형태인지 거의 모두 설명된다.

## Task

task는 "하나의 사용자 목표"를 뜻한다. 예를 들면 "문서 갱신", "타입 에러 수정",
"새 런타임 통합" 같은 주제 단위다.

핵심 필드:

- `id`, `title`, `slug`
- `status`: `running`, `waiting`, `completed`, `errored`
- `workspacePath`
- `taskKind`: `primary`, `background`
- `parentTaskId`, `parentSessionId`, `backgroundTaskId`
- `runtimeSource`

특징:

- background task는 parent lineage를 가질 수 있다.
- runtime session binding이 끊겼다가 다시 이어져도 task 자체는 유지될 수 있다.
- `displayTitle`은 read model 성격의 파생값이며, 원본 title과 다를 수 있다.

## Session

session은 task 안의 개별 실행 구간이다. Claude plugin 처럼 turn이 여러 번 나뉘는 런타임에서는
하나의 task에 여러 session이 생긴다.

핵심 필드:

- `id`
- `taskId`
- `status`: `running`, `completed`, `errored`
- `summary`
- `startedAt`, `endedAt`

session이 필요한 이유:

- 같은 task 안에서도 turn 사이 경계를 남길 수 있다.
- runtime adapter마다 session close 정책이 다르다.
- background task가 끝났는지, primary task를 waiting으로 둘지 판단할 수 있다.

## Timeline Event

timeline event는 실제 관측 단위다. user prompt, MCP call, terminal command,
todo state change, verification, assistant response 같은 기록이 모두 여기에 담긴다.

핵심 필드:

- `kind`
- `lane`
- `title`, `body`
- `metadata`
- `classification`
- `createdAt`
- 필요 시 `sessionId`

`classification`에는 lane, tags, match 정보가 들어가고,
`metadata`에는 relation, work item, MCP, skill, question/todo phase 같은 부가 의미가 들어간다.

## Task-Session-Event 관계

```text
MonitoringTask
  ├─ has many MonitoringSession
  └─ has many TimelineEvent

runtime_session_bindings
  └─ maps external runtime session -> task + monitor session
```

실제 저장소에서는 여기에 bookmarks와 evaluations가 추가로 task를 참조한다.

## 상태 전이 관점에서 보기

### Primary task

- 시작 시 `running`
- runtime turn이 끝났지만 follow-up이 예상되면 `waiting`
- 명시적으로 끝나면 `completed`
- 실패로 마무리되면 `errored`

### Background task

- 보통 parent task 안에서 파생된다.
- 마지막 running session이 끝나면 자동 complete될 수 있다.

### Event 흐름

- task/session lifecycle 이벤트는 구조 자체를 바꾼다.
- 일반 event는 timeline을 풍성하게 만든다.
- evaluation과 workflow search는 task가 충분히 쌓인 뒤의 2차 기능이다.

## 함께 움직이는 주변 모델

### Runtime session binding

외부 런타임의 thread/session ID를 monitor session에 연결한다.
Claude plugin과 수동 클라이언트가 각자 다른 session semantics를 가져도
Agent Tracer 안에서는 일관된 task/session 모델로 읽을 수 있는 이유다.

### Bookmark

task 전체 또는 특정 event를 저장해 나중에 다시 찾을 수 있게 한다.

### Evaluation

task를 `good` 또는 `skip`으로 평가해 workflow library에 넣는다.

## 관련 파일

- `packages/core/src/domain.ts`
- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/application/services/session-lifecycle-policy.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-task-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-session-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-event-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-runtime-binding-repository.ts`

## 관련 문서

- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
