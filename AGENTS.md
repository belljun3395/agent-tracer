## 워크플로우 라이브러리 — 작업 시작 전 규칙

새 작업을 시작하기 전에 반드시 아래 절차를 따를 것 (모든 런타임 공통):

1. `monitor_find_similar_workflows` MCP 도구로 유사한 과거 워크플로우를 검색한다.
   - 검색어는 `java`, `typescript refactor` 처럼 **짧은 핵심 키워드**를 사용할 것. 검색 방식이 SQLite LIKE 패턴 매칭(`%{query}%`)이므로, 긴 문장을 넣으면 매칭에 실패한다.
   - **`tags` 파라미터는 사용하지 않는다.** 저장된 워크플로우의 태그와 정확히 일치해야만 동작하므로, 추측으로 넣으면 실제 존재하는 워크플로우가 걸러진다. `description`만으로 검색할 것.
2. 결과가 1개 이상이면 각 워크플로우의 `useCase`, `rating`, `outcomeNote`, `tags`를 요약해 사용자에게 보여준다.
3. "이 워크플로우를 참고할까요?" 라고 물어본 뒤 사용자 답변에 따라 접근 방식을 결정한다.
4. 결과가 없거나 모니터 서버 미응답 시 검색 단계를 건너뛰고 바로 작업을 시작한다.

## 워크플로우 라이브러리 — 작업 완료 후 평가 규칙

작업이 마무리된 것 같으면 반드시 아래 절차를 따를 것 (모든 런타임 공통):

1. `monitor_question`으로 사용자에게 평가 의사를 먼저 확인한다.
   - 예: "이 작업을 워크플로우 라이브러리에 저장할까요?"
2. 사용자가 원하면 아래 정보를 물어본다 (한 번에 물어봐도 됨):
   - `rating`: `good` (잘 됐다) / `skip` (제외)
   - `useCase`: 어떤 종류의 작업이었는지 (예: `"java 최신 조사"`)
   - `workflowTags`: 태그 목록 (예: `["java", "research"]`)
   - `outcomeNote`: 어떤 접근이 잘 됐는지 — 다음에 참고할 힌트
3. 현재 taskId는 `GET http://localhost:3847/api/tasks?limit=1` 로 가장 최근 태스크를 조회해 얻는다.
4. `monitor_evaluate_task`를 호출해 저장한다.

> 모니터 서버가 응답하지 않으면 이 단계를 건너뛴다.

## 캐노니컬 user.message 경로

- Claude Code → hook 자동 동작 (별도 스킬 불필요)
- MCP 지원 환경(자동 hook 없음) → `monitor_user_message` (`captureMode="raw"`) 으로 실제 사용자 프롬프트 기록
- `monitor_save_context`는 raw 프롬프트 경로가 아닌 계획·체크포인트 전용
- `monitor_runtime_session_end`는 runtime session 종료 경로다. 작업을 즉시 닫아야 할 때만 `completeTask=true`를 사용하고, 그 외 작업 종료는 `monitor_task_complete`로 명시한다.
