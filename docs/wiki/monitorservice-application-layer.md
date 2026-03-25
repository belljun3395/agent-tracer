# MonitorService: Application Layer

`MonitorService`는 현재 서버 유스케이스의 대부분이 모여 있는 핵심 진입점이다.

## 현재 책임

- task/session lifecycle
- runtime session ensure/end
- event logging
- bookmark/search
- workflow evaluation

## 장점

- 진입점이 하나라 따라가기 쉽다
- 테스트 커버리지가 있다

## 현재 리스크

- 책임 집중이 심하다
- 변경 영향 범위가 넓다
- read path 비용과 in-memory dedupe state 관리가 결합돼 있다
