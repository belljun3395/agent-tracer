# SQLite Infrastructure & Schema

Agent Tracer의 실제 저장 경로는 `packages/server/src/infrastructure/sqlite`다.
이 디렉터리는 schema, migration, repository 구현, 포트 조합을 모두 포함하고 있다.

## 핵심 파일

- `packages/server/src/infrastructure/sqlite/index.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-schema.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-schema-migrator.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-task-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-session-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-event-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-runtime-binding-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-bookmark-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-evaluation-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-json.ts`

## 조합 방식

`createSqliteMonitorPorts()`가 이 레이어의 진입점이다.

- DB 디렉터리를 만든다.
- `better-sqlite3` 연결을 연다.
- `journal_mode = WAL`을 켠다.
- `case_sensitive_like = OFF`를 설정한다.
- schema 생성과 migration을 실행한다.
- task/session/event/runtime-binding/bookmark/evaluation repository를 묶어 반환한다.

## 주요 테이블

### `monitoring_tasks`

task row를 저장한다. `task_kind`, `parent_task_id`, `parent_session_id`,
`background_task_id`, `workspace_path`, `cli_source` 같은 lineage와 출처 필드가 포함된다.

### `task_sessions`

개별 monitor session을 저장한다.

### `timeline_events`

모든 event의 canonical 저장소다. `metadata_json`, `classification_json`을
JSON 문자열로 보관하고 `task_id + created_at` 인덱스를 둔다.

### `runtime_session_bindings`

외부 런타임의 stable session ID를 monitor task/session에 연결한다.

### `bookmarks`

task 또는 event 기반 bookmark를 저장한다.

### `task_evaluations`

workflow library용 평가를 저장한다.
현재는 `rating`, `use_case`, `workflow_tags`, `outcome_note`뿐 아니라
`approach_note`, `reuse_when`, `watchouts`, `workflow_snapshot_json`, `workflow_context`, `search_text`, `evaluated_at`까지 함께 관리한다.

## migration의 역할

`sqlite-schema-migrator.ts`는 기존 DB에 빠진 컬럼을 점진적으로 추가한다.
현재는 `cli_source`, `task_kind`, parent/background lineage 관련 컬럼 보강과
runtime source backfill을 담당한다.

## evaluation 저장소의 현재 동작

`SqliteEvaluationRepository`는 workflow library에 대해 여러 read path를 지원한다.

- `getEvaluation(taskId)` - 단일 task 평가
- `getWorkflowContent(taskId)` - snapshot/context 상세 조회
- `listEvaluations(rating?)` - workflow library 전체 목록
- `searchWorkflowLibrary(query, rating?, limit?)` - library 목록 검색
- `searchSimilarWorkflows(query, tags?, limit?)` - 유사 워크플로우 검색

`listEvaluations()`는 `task_evaluations`, `monitoring_tasks`, `timeline_events`를 조합해
웹 패널이 바로 렌더링할 수 있는 `WorkflowSummary` 배열을 반환한다.

`getWorkflowContent()`는 저장된 `workflowSnapshot`/`workflowContext`가 있으면 그것을 우선 사용하고,
없으면 timeline에서 다시 생성한 값을 `source: "saved" | "generated"`와 함께 돌려준다.

이 문맥의 JSON 문자열 파싱은 repository 공통 유틸인
`parseJsonField()`(`sqlite-json.ts`)로 일원화돼 예외 처리와 타입 변환이 일관화됐다.

## 비용이 커질 수 있는 지점

- `displayTitle` 같은 파생 값이 read path에서 추가 계산된다.
- workflow similarity search와 workflow content detail은 매칭된 task마다 전체 이벤트를 다시 읽어
  `workflowSnapshot`/`workflowContext`를 hydrate한다.
- 장기적으로는 read model materialization이 필요할 수 있다.

## 실제 경로

현재 활성 저장 경로는 `src/infrastructure/sqlite/*`다.
문서를 읽을 때도 이 경로를 기준으로 보는 것이 맞다.

## 관련 문서

- [Monitor Server](./monitor-server.md)
- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [Saving & Rating Workflows](./saving-and-rating-workflows.md)
