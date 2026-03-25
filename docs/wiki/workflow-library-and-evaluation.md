# Workflow Library & Evaluation

Agent Tracer는 성공한 작업을 저장하고, 비슷한 작업을 다시 찾는 workflow library 기능을 가진다.

## 핵심 파일

- `packages/server/src/infrastructure/sqlite/sqlite-evaluation-repository.ts`
- `packages/server/src/application/workflow-context-builder.ts`
- `packages/web/src/components/WorkflowLibraryPanel.tsx`
- `packages/web/src/components/TaskEvaluatePanel.tsx`

## 주요 기능

- task 평가 저장
- workflow 목록 조회
- 유사 workflow 검색
- workflow context markdown 생성

## 유지보수 메모

- 검색 시 이벤트를 많이 다시 읽는 구조라 데이터가 커질수록 비용이 증가할 수 있다
