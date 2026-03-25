# Event Classification Engine

이 페이지는 이벤트가 어떤 lane과 tag를 갖게 되는지 설명한다.

## 핵심 파일

- `packages/core/src/classifier.ts`
- `packages/core/src/action-registry.ts`
- `packages/core/src/domain.ts`

## 동작 개요

1. 이벤트 kind에서 기본 lane 후보를 잡는다.
2. action name 기반 매치를 확인한다.
3. 명시적 lane이 있으면 우선한다.
4. 최종 classification에 lane, tags, matches를 저장한다.

## 현재 주의점

- `question.logged` 같은 일부 이벤트는 문서상 richer semantics가 있지만,
  classifier 입력 모델은 그 정보를 충분히 표현하지 못한다.
