# Domain Model: Tasks, Sessions & Timeline Events

Agent Tracer는 세 가지 중심 엔터티로 기록을 조직한다.

## Task

- 사용자 목표 단위
- 상태: `running`, `waiting`, `completed`, `errored`
- parent/background 관계를 가질 수 있다

## Session

- 하나의 task 안에서 실제 에이전트 실행 구간을 뜻한다
- runtime-session 기반으로 이어붙을 수 있다

## Timeline Event

- tool 사용, user message, question, verify, thought 같은 개별 기록
- lane, title, body, metadata, classification을 가진다

## 왜 중요한가

- 서버 API
- MCP tool payload
- 웹 timeline/inspector

모두 이 모델을 전제로 움직인다.
