# Task List & Global State

task selection, bookmark 상태, URL hash sync, overview fetch orchestration은 현재 전역 store 계층에서 관리된다.

## 핵심 파일

- `packages/web/src/store/useMonitorStore.tsx`
- `packages/web/src/components/TaskList.tsx`
- `packages/web/src/components/TopBar.tsx`

## 현재 역할

- task/bookmark/selection 상태
- task detail 로드
- task title/status 편집
- 일부 derived title cache

## 유지보수 메모

- reducer, effect, async action, router sync가 한 provider에 결합돼 있다
- 장기적으로는 data hook과 UI state를 나누는 편이 낫다
