# Workflow Library & Evaluation

workflow library는 Agent Tracer가 "좋은 작업 방식을 다시 찾는 도구"로 동작하게 하는 레이어다.
핵심은 단순한 평가 메모만 저장하는 것이 아니라, task timeline에서 `Workflow Snapshot`과 `Workflow Context`를 만들고
그 결과를 재검색 가능한 형태로 남기는 데 있다.

## 핵심 파일

- `packages/core/src/domain/types.ts`
- `packages/core/src/workflow-snapshot.ts`
- `packages/core/src/workflow-context.ts`
- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/application/ports/evaluation-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-evaluation-repository.ts`
- `packages/server/src/presentation/http/routes/evaluation-routes.ts`
- `packages/web/src/api.ts`
- `packages/web/src/components/TaskEvaluatePanel.tsx`
- `packages/web/src/components/workflowPreview.ts`
- `packages/web/src/components/WorkflowLibraryPanel.tsx`

## 데이터 모델

### `WorkflowEvaluationData`

평가 메타데이터의 공통 베이스다.

- `useCase`
- `workflowTags`
- `outcomeNote`
- `approachNote`
- `reuseWhen`
- `watchouts`

### `ReusableTaskSnapshot`

재사용 가능한 task 요약본이다.
`buildReusableTaskSnapshot()`가 timeline 이벤트와 evaluation 데이터를 합쳐 아래 필드를 만든다.

- `objective`
- `originalRequest`
- `outcomeSummary`
- `approachSummary`
- `reuseWhen`
- `watchItems`
- `keyDecisions`
- `nextSteps`
- `keyFiles`
- `modifiedFiles`
- `verificationSummary`
- `searchText`

### `TaskEvaluation` / 저장 레코드

기본 평가 타입인 `TaskEvaluation`에는 아래가 들어간다.

- `taskId`
- `rating`
- `evaluatedAt`
- `WorkflowEvaluationData`의 모든 필드

서버 저장 레코드(`StoredTaskEvaluation`)는 여기에 아래를 추가한다.

- `workflowSnapshot`
- `workflowContext`
- `searchText`

### `WorkflowSummary` / `WorkflowSearchResult` / `WorkflowContentRecord`

- `WorkflowSummary`는 library 목록용 타입이다.
- `WorkflowSearchResult`는 similar search 결과용 타입이며 `workflowContext` markdown을 포함한다.
- `WorkflowContentRecord`는 전체 snapshot/context 상세 보기용 타입이며 `workflowSnapshot`, `workflowContext`, `searchText`, `source(saved|generated)`를 포함한다.

즉, 목록과 검색 결과는 가벼운 요약 타입이고, 전체 snapshot/context는 별도 content read path로 조회한다.

## Workflow Snapshot 생성 규칙

`packages/core/src/workflow-snapshot.ts`의 `buildReusableTaskSnapshot()`가 생성 규칙의 source of truth다.

### 입력

- `objective`: 보통 task title 또는 파생 `displayTitle`
- `events`: task timeline 전체
- `evaluation`: 선택 입력. `WorkflowEvaluationData` 일부 또는 전체

### 필드 생성 방식

- `originalRequest`
  첫 번째 `user.message` 이벤트의 `body` 또는 `title`
- `outcomeSummary`
  `evaluation.outcomeNote` 우선, 없으면 마지막 `assistant.response`, 그것도 없으면 수정 파일 수와 verification 요약으로 추론
- `approachSummary`
  `evaluation.approachNote` 우선, 없으면 planning/implementation/coordination 이벤트에서 추린 decision line 상위 2개
- `reuseWhen`
  `evaluation.reuseWhen`
- `watchItems`
  `evaluation.watchouts`를 줄 단위/구분자 기준으로 분해한 값 + 실패한 verification/rule 제목
- `keyDecisions`
  planning/implementation/coordination 레인의 이벤트를 사람이 읽기 좋은 한 줄 설명으로 변환한 뒤 dedupe
- `nextSteps`
  미완료 todo 제목 + 아직 concluded 되지 않은 question prompt
- `keyFiles`
  수정된 파일 + 이벤트 metadata의 `filePaths`
- `modifiedFiles`
  `file.changed` 이벤트 중 `writeCount > 0` 인 파일
- `verificationSummary`
  verification/rule 이벤트 수를 바탕으로 만든 `Checks: X (Y pass, Z fail)` 요약
- `searchText`
  objective, originalRequest, useCase, outcomeSummary, approachSummary, reuseWhen, tags, watchItems, keyDecisions, keyFiles를 합쳐 만든 검색용 문자열

## Workflow Context 생성 규칙

`packages/core/src/workflow-context.ts`의 `buildWorkflowContext()`가 markdown 조립의 source of truth다.

생성 순서는 아래와 같다.

1. `# Workflow: <taskTitle>`
2. snapshot 기반 섹션
3. `## Plan`
4. lane별 섹션
5. `## Modified Files`
6. `## Open TODOs`
7. `## Verification Summary`

### snapshot 기반 섹션

snapshot과 evaluation에 값이 있을 때만 아래 섹션이 포함된다.

- `## Original Request`
- `## Use Case`
- `## Outcome`
- `## What Worked`
- `## Reuse When`
- `## Key Decisions`
- `## Next Steps`
- `## Watchouts`
- `## Key Files`
- `## Verification Snapshot`

### lane별 섹션

현재 workflow context에 포함되는 lane은 아래 순서로 고정돼 있다.

- `Exploration`
- `Implementation`
- `Questions`
- `TODOs`
- `Background`
- `Coordination`

`planning`은 별도 `## Plan` 섹션으로 빠지고, `user` lane은 lane summary에 다시 넣지 않는다.

또한 `context.saved`, `terminal.command`, generic title(`action logged`, `tool used` 등)은 title보다 detail을 우선 보여줘
context markdown이 덜 장황하게 보이도록 조정한다.

## 생성 및 저장 흐름

### 웹

`TaskEvaluatePanel`은 selected task timeline을 받아 다음 흐름으로 동작한다.

1. 평가 입력값으로 `WorkflowEvaluationData`를 만든다.
2. `buildReusableTaskSnapshot()`으로 snapshot을 자동 생성한다.
3. `buildWorkflowContext()`로 context markdown을 자동 생성한다.
4. 사용자는 Preview/Edit fields/Regenerate로 snapshot과 context를 수정할 수 있다.
5. 저장 시 `POST /api/tasks/:id/evaluate`에 평가 메타데이터와 `workflowSnapshot`, `workflowContext`를 함께 보낸다.

`workflowPreview.ts`는 snapshot draft를 textarea 편집용 문자열 형태로 바꾸고, 다시 `ReusableTaskSnapshot`으로 파싱하는 보조 유틸이다.

### 서버

`MonitorService.upsertTaskEvaluation()`는 아래 규칙으로 저장한다.

- task와 events를 읽는다.
- `deriveTaskDisplayTitle()`이 있으면 원래 title 대신 그것을 workflow title로 쓴다.
- 요청에 `workflowSnapshot`이 없으면 서버에서 생성한다.
- 요청에 `workflowContext`가 없거나 빈 문자열이면 서버에서 생성한다.
- 저장 시 `searchText`는 `snapshot.searchText`를 기준으로 함께 기록한다.

### 저장본과 생성본의 관계

`SqliteEvaluationRepository.getWorkflowContent()`는 저장된 snapshot/context가 있으면 그것을 우선 사용한다.
없으면 현재 timeline에서 다시 생성한 값을 반환한다.
그래서 `WorkflowLibraryPanel` 상세 보기에는 `source: "saved" | "generated"`가 함께 노출된다.

## 서버 기능

- `POST /api/tasks/:id/evaluate`
- `GET /api/tasks/:id/evaluate`
- `GET /api/workflows`
- `GET /api/workflows/similar`
- `GET /api/workflows/:id/content`

`/api/workflows/similar`은 search 결과와 함께 `workflowContext`를 돌려준다.
full snapshot/context detail은 `/api/workflows/:id/content`가 담당한다.

## 웹 기능

### `TaskEvaluatePanel`

- 평가 메타데이터 입력
- snapshot/context 자동 생성
- Preview / Edit fields / Regenerate
- 최종 저장

### `WorkflowLibraryPanel`

- library 목록 조회
- rating / text filter
- 선택한 workflow의 snapshot/context 상세 조회
- 저장본인지 생성본인지 표시

## 현재 리스크

- workflow content 조회와 similar search 결과 hydration은 여전히 전체 이벤트를 다시 읽는 read-heavy 경로다.
- lexical search는 `title`, `useCase`, `workflowTags`, `outcomeNote`, `approachNote`, `reuseWhen`, `watchouts`, `searchText` 품질에 민감하다.
- semantic ranking은 embedding service가 있을 때만 켜지며, 실패하면 lexical search로 안전하게 폴백한다.
- 생성 품질은 timeline title/body/metadata 품질에 직접 영향을 받는다.

## 관련 문서

- [Saving & Rating Workflows](./saving-and-rating-workflows.md)
- [Searching Similar Workflows](./searching-similar-workflows.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)
