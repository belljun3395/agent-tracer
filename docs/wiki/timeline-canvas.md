# Timeline Canvas

timeline canvas는 Agent Tracer UI의 핵심 시각화다.
저장된 timeline event를 단순 리스트가 아니라 "lane을 가진 공간적 흐름"으로 보여 준다.

## 핵심 파일

- `packages/web/src/components/Timeline.tsx`
- `packages/web/src/lib/timeline.ts`
- `packages/web/src/lib/eventSubtype.ts`
- `packages/web/src/components/Timeline.css`
- `packages/web/src/lib/ui/laneTheme.ts`

## 무엇을 하는가

- base lane별 카드 렌더링
- subtype 기반 lane row 확장
- connector와 relation path 계산
- timestamp ruler와 relative time 표시
- zoom, filter, auto-follow, drag scroll
- minimap과 observability badge 표시
- task title/status 편집 UI 제공

## lane 구조

core에는 8개 canonical lane이 있지만, canvas는 여기에 subtype row 개념을 더 얹는다.
특히 `exploration`, `implementation`, `coordination`은 `eventSubtype.ts`를 통해
더 세분화된 row로 확장될 수 있다.

즉, 문서상 "8 lanes"와 화면상 "더 많은 줄"은 서로 모순이 아니라 레이어가 다르다.

## 레이아웃 계산

`lib/timeline.ts`는 아래 계산을 담당한다.

- `buildTimelineLayout()`
- `buildTimestampTicks()`
- `buildTimelineConnectors()`
- `buildTimelineRelations()`
- `buildTimelineContextSummary()`

UI 컴포넌트가 복잡해 보이는 이유는 렌더링뿐 아니라 상당한 도메인 계산도 함께 들고 있기 때문이다.

## 사용성 기능

- running task에서는 오른쪽 끝을 따라가는 auto-follow
- task가 바뀌면 selected event가 유효한지 확인 후 follow reset
- lane filter toggle
- zoom slider 연동
- minimap에서 현재 viewport 위치 확인
- selection에 따른 connector 강조

## 최근 코드 기준 포인트

- minimap과 follow 동작은 여전히 component 내부에 강하게 묶여 있다.
- timeline은 task status 변경과 title 편집 UI까지 함께 품고 있다.
- typed realtime message 도입으로 refresh 입력은 더 명확해졌지만,
  timeline 자체는 여전히 refresh된 task detail 전체를 기준으로 다시 계산한다.

## 유지보수 관점의 리스크

- layout 계산과 보기 로직이 같은 파일에 몰려 있다.
- connector/path 계산은 이벤트 수가 많을수록 비용이 커질 수 있다.
- subtype row, filter, selection, follow 상태가 모두 얽혀 있어 변경이 쉽지 않다.

## 관련 문서

- [Event Classification Engine](./event-classification-engine.md)
- [Event Inspector & Insights Engine](./event-inspector-and-insights-engine.md)
- [Web Dashboard](./web-dashboard.md)
