# Saving & Rating Workflows

workflow library에 task를 저장할 때는 평가 정보를 함께 남긴다.

## 저장 필드

- `rating`
- `useCase`
- `workflowTags`
- `outcomeNote`

## 핵심 흐름

- UI 또는 MCP tool에서 평가 입력
- 서버가 task evaluation으로 upsert
- 이후 library 목록과 search에서 활용

## 관련 문서

- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
