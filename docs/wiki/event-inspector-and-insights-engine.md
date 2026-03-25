# Event Inspector & Insights Engine

event inspector는 선택된 event/task의 의미를 읽기 좋게 재구성하는 패널이다.

## 핵심 파일

- `packages/web/src/components/EventInspector.tsx`
- `packages/web/src/lib/insights.ts`
- `packages/web/src/store/useEvaluation.ts`

## 담당 역할

- event metadata 표시
- tag/rule 탐색
- file activity, compact, task extraction, model summary
- evaluation 패널과 handoff 패널 연결

## 유지보수 메모

- UI와 derived analytics가 과도하게 결합돼 있다
- evaluation fetch 중복과 raw metadata 직접 해석 문제를 먼저 정리하는 편이 좋다
