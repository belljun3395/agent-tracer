# MCP Tool Reference

현재 MCP surface는 24개 도구를 제공한다. 이 문서는 이름만 나열하는 대신,
어떤 문제를 해결하려고 있는 도구인지 묶음별로 설명한다.

## 1. Task Lifecycle

- `monitor_task_start`
- `monitor_task_complete`
- `monitor_task_error`
- `monitor_task_link`
- `monitor_runtime_session_ensure`
- `monitor_runtime_session_end`
- `monitor_session_end`

이 묶음은 task/session 생성과 종료, background lineage 연결을 담당한다.
runtime-scoped 경로와 explicit session-end 경로가 둘 다 있는 점이 특징이다.

## 2. Event Logging

- `monitor_tool_used`
- `monitor_terminal_command`
- `monitor_save_context`
- `monitor_plan`
- `monitor_action`
- `monitor_verify`
- `monitor_rule`
- `monitor_explore`
- `monitor_user_message`
- `monitor_assistant_response`

timeline의 대부분은 이 묶음에서 생성된다.
특히 `monitor_user_message`와 `monitor_assistant_response`는 대화 경계의 캐노니컬 경로다.

## 3. Semantic Flow / Coordination

- `monitor_async_task`
- `monitor_agent_activity`
- `monitor_question`
- `monitor_todo`
- `monitor_thought`

이 묶음은 단순 로그보다 더 구조화된 의미를 기록한다.
background task, delegation, question flow, todo state, summarized thought 같은 정보를 남긴다.

## 4. Workflow Library

- `monitor_evaluate_task`
- `monitor_find_similar_workflows`

작업이 끝난 뒤 좋은 예시를 저장하고, 다음 작업에서 유사 워크플로우를 찾는 기능이다.

## 실제로 많이 함께 쓰이는 조합

### 수동 런타임 경로

- `monitor_runtime_session_ensure`
- `monitor_user_message`
- `monitor_explore` / `monitor_terminal_command` / `monitor_plan`
- `monitor_assistant_response`
- `monitor_runtime_session_end`

### Claude plugin 보조 경로

- 자동 hook이 놓친 경우 `monitor_rule`, `monitor_verify`, `monitor_async_task` 같은 수동 보강 도구

### 작업 평가 경로

- `monitor_question`으로 사용자 평가 의사 확인
- `monitor_evaluate_task`로 저장
- 다음 작업 시작 시 `monitor_find_similar_workflows`로 검색

## 유지보수 메모

- 새 tool을 추가하면 HTTP route, guide 문서, skill 문서까지 같이 봐야 한다.
- 도구명은 snake_case 기반으로 유지하고, user-facing 설명은 명확한 동사로 쓰는 편이 좋다.
- 지금은 선언형 manifest 없이 수동 등록이라 목록과 구현이 쉽게 어긋날 수 있다.

## 관련 문서

- [MCP Server](./mcp-server.md)
- [HTTP API Reference](./http-api-reference.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
