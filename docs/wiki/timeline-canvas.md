# Timeline Canvas

timeline canvas는 Agent Tracer UI의 핵심 시각화 영역이다.

## 핵심 파일

- `packages/web/src/components/Timeline.tsx`
- `packages/web/src/lib/timeline.ts`
- `packages/web/src/lib/eventSubtype.ts`
- `packages/web/src/components/Timeline.css`

## 담당 역할

- lane별 이벤트 렌더링
- connector와 layout 계산
- zoom, filter, follow behavior
- minimap과 상태 badge 표시

## 유지보수 메모

- layout 계산과 보기 로직이 한 파일에 몰려 있다
- 일부 계산은 비용이 큰 편이라 분해와 캐시 전략을 검토할 시점이다
