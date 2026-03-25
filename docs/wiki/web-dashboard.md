# Web Dashboard

`@monitor/web`는 task, timeline, inspector, workflow library를 시각화하는 React 대시보드다.

## 핵심 파일

- `packages/web/src/App.tsx`
- `packages/web/src/store/useMonitorStore.tsx`
- `packages/web/src/components/TaskList.tsx`
- `packages/web/src/components/Timeline.tsx`
- `packages/web/src/components/EventInspector.tsx`

## 주요 화면

- task list
- timeline canvas
- event inspector
- workflow library

## 유지보수 메모

- 기능은 풍부하지만 큰 파일에 책임이 집중돼 있다
- raw metadata 해석과 derived 계산이 여러 레이어에 퍼져 있다
