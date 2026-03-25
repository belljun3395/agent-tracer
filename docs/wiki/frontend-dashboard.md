# Frontend Dashboard

`packages/web`는 기능적으로는 풍부하고 테스트도 있는 편이지만,
구조적으로는 몇몇 거대 파일에 복잡도가 집중되어 있다.

## 현재 구조

```text
App.tsx                     # 루트 조합, 레이아웃, 검색, 패널 상태
store/
  useMonitorStore.tsx      # 전역 상태와 서버 fetch orchestration
  useWebSocket.ts          # socket 재연결 및 message debounce
  useSearch.ts             # 검색 상태
components/
  TaskList.tsx
  Timeline.tsx
  EventInspector.tsx
  WorkflowLibraryPanel.tsx
lib/
  insights.ts              # 타임라인 파생 계산
  timeline.ts              # 레이아웃/연결선 계산
```

## 현재 구조가 주는 장점

- 기능별 이름은 비교적 직관적이다.
- `useMonitorStore`가 fetch orchestration을 모으고 있어 API 호출 위치를 추적하기 쉽다.
- `lib/insights.ts`, `lib/timeline.ts`처럼 계산 로직을 UI에서 일부 분리해 둔 시도는 좋다.
- 테스트는 존재하고 실제 유틸 단위 검증도 들어 있다.

## 유지보수 리스크

### 루트 컴포넌트가 너무 많은 화면 상태를 가진다

- `App.tsx`는 대시보드 레이아웃, WebSocket 반응, 검색, 패널 리사이즈, 로컬 스토리지, 선택 상태 전달을 한 번에 관리한다.
- 문서 주석은 "레이아웃 조합만 담당"이라고 설명하지만, 실제 책임은 그보다 훨씬 넓다.

권장 분리:

- `useDashboardLayout`
- `useResizablePanels`
- `useSelectionState`
- `useRealtimeRefresh`

### 전역 스토어가 reducer + side effect + fetch orchestration을 모두 안고 있다

- `useMonitorStore.tsx`는 reducer, 캐시 병합, 초기 로딩, 해시 동기화, CRUD 액션, 낙관적 아닌 갱신까지 다 가진다.
- 상태 구조가 커질수록 effect 간 상호작용 추적이 어렵다.

권장 분리:

- state reducer
- async actions
- URL/hash sync
- task title derived cache

### 거대 UI 파일 두 개가 사실상 mini-application이 되었다

- `components/Timeline.tsx`
- `components/EventInspector.tsx`

두 파일 모두 보기/선택/필터/편집/요약/탭/상호작용을 강하게 결합하고 있다.
기능 추가는 가능하지만, 회귀 테스트와 코드 리뷰 비용이 빠르게 커질 구조다.

### 도메인 계산 유틸이 하나의 초대형 파일에 모여 있다

- `lib/insights.ts`

파일 통계, compact 분석, 태그 인사이트, 질문/투두 그룹, 모델 요약, 태스크 추출까지 한 파일에 있다.
이 패턴은 "찾기 쉬움"과 "변경 영향 좁힘" 사이에서 후자를 잃기 쉽다.

추천 분리:

- `insights/observability.ts`
- `insights/files.ts`
- `insights/compact.ts`
- `insights/questions.ts`
- `insights/todos.ts`
- `insights/task-extraction.ts`

### 평가 패널이 중복 fetch와 빈 task ID 호출을 만들 수 있다

- `EventInspector`와 `TaskEvaluatePanel`이 같은 평가 데이터를 각각 읽는 구조다.
- task가 아직 선택되지 않은 순간에도 빈 문자열 ID로 호출될 여지가 있다.

기능적으로는 작아 보여도, 이런 경계 문제는 나중에 캐싱과 로딩 UX를 복잡하게 만든다.
작고 확실한 부채라서 우선적으로 정리하기 좋다.

### WebSocket 이벤트를 활용하지 않고 전체 재조회로 대응한다

- `useWebSocket.ts`는 메시지를 받으면 debounce 후 콜백만 호출한다.
- `lib/realtime.ts`는 매번 overview와 selected task detail을 다시 조회한다.

작은 규모에서는 안전하지만, 이벤트 수가 많아질수록 네트워크 비용과 렌더 부하가 커진다.
서버가 이미 notification payload를 보내고 있으므로 점진 갱신으로 옮길 여지가 크다.

### 공통 타입이 `@monitor/core`와 분리돼 있다

- `packages/web/src/types.ts`

서버와 코어 계약이 커질수록 drift 위험이 커진다.
가능하면 공통 타입은 core에서 직접 import하고, 웹 전용 view-model만 별도 두는 편이 낫다.

### raw metadata 해석이 UI 전반에 퍼져 있다

- `Timeline`, `EventInspector`, `insights`가 모두 `metadata`의 raw key를 직접 읽는다.
- 이벤트 payload가 바뀌면 보기 레이어 여러 곳을 동시에 수정해야 한다.

권장 방향:

- raw event -> typed view model 변환 레이어 추가
- 컴포넌트는 의미 있는 필드만 받도록 축소

### 스타일 시스템이 둘로 갈라져 있다

- Tailwind class 기반 JSX
- `Timeline.css`, `legacy.css` 중심의 별도 스타일 체계

여기에 폰트 import 위치도 여러 군데라서, UI를 손볼 때 어느 레이어가 source of truth인지 애매해진다.
작은 시각 변경도 수정 범위를 키우는 구조다.

## 성능 관점

현재 즉시 체감되는 최적화보다 더 중요한 것은 "분리 가능한 구조"다.
하지만 중기적으로는 아래 두 가지가 실제 성능 이슈가 될 가능성이 높다.

1. WebSocket 수신마다 전체 재조회
2. 거대한 derived calculation을 루트 렌더 경로에서 여러 번 수행
3. 타임라인 레이아웃/연결선 계산과 O(n²) 성격의 그룹 계산
4. 현재 프로덕션 메인 번들 약 `393.56 kB` 수준의 단일 초기 로드

## 추천 리팩터링 순서

1. `types.ts` 정리와 shared contract 재수렴
2. evaluation fetch 중복 제거와 empty-id 방지
3. `insights.ts` 분해
4. `EventInspector` 탭별 분할
5. `Timeline`의 minimap / layout / filter control 분리
6. `App`의 레이아웃 상태와 실시간 갱신 훅 분리
7. notification payload 기반 점진 갱신 도입

## 먼저 읽어야 할 파일

- `packages/web/src/App.tsx`
- `packages/web/src/store/useMonitorStore.tsx`
- `packages/web/src/components/Timeline.tsx`
- `packages/web/src/components/EventInspector.tsx`
- `packages/web/src/lib/insights.ts`
- `packages/web/src/lib/timeline.ts`
