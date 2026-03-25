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

workflow library용 평가를 저장한다. `rating`, `use_case`, `workflow_tags`,
`outcome_note`, `evaluated_at`가 핵심 필드다.

## migration의 역할

`sqlite-schema-migrator.ts`는 기존 DB에 빠진 컬럼을 점진적으로 추가한다.
현재는 `cli_source`, `task_kind`, parent/background lineage 관련 컬럼 보강과
runtime source backfill을 담당한다.

## evaluation 저장소의 최근 변화

`SqliteEvaluationRepository`는 이제 두 종류의 읽기 경로를 지원한다.

- `getEvaluation(taskId)` - 단일 task 평가
- `listEvaluations(rating?)` - workflow library 전체 목록
- `searchSimilarWorkflows(query, tags?, limit?)` - 유사 워크플로우 검색

`listEvaluations()`는 `task_evaluations`, `monitoring_tasks`, `timeline_events`를 조합해
웹 패널이 바로 렌더링할 수 있는 `WorkflowSummary` 배열을 반환한다.

## 비용이 커질 수 있는 지점

- `displayTitle` 같은 파생 값이 read path에서 추가 계산된다.
- workflow similarity search는 매칭된 task마다 전체 이벤트를 다시 읽어
  `workflowContext`를 만든다.
- 장기적으로는 read model materialization이 필요할 수 있다.

## 실제 경로와 legacy 구분

현재 활성 경로는 `src/infrastructure/sqlite/*`다.
`packages/server/src/infrastructure/monitor-database.ts`는 현재 조합 루트에서 사용되지 않는
legacy 성격 파일이므로 신규 작업에서는 이 경로를 기준으로 읽지 않는 편이 낫다.

## 관련 문서

- [Monitor Server](./monitor-server.md)
- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [Saving & Rating Workflows](./saving-and-rating-workflows.md)
