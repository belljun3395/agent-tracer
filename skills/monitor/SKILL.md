---
name: monitor
description: MCP가 있는 모든 환경에서 Agent Tracer 모니터링 기록. Cursor, Windsurf, 웹 IDE, 기타 MCP 지원 환경에서 사용.
---

# Agent Tracer Monitor

`monitor` MCP 도구로 한 번의 사용자 요청에 하나의 모니터링 태스크를 동기화.

## Quick Start

1. `monitor-server` MCP 서버 사용 가능 여부 확인. 없으면 이 스킬을 중단하고 서버 먼저 시작.
2. 첫 번째 실질적 작업 전에 `monitor_task_start` 호출.
3. 이후 모든 모니터링 도구 호출에 반환된 `task.id`와 `sessionId` 재사용.
4. 작업 중 주요 마일스톤 기록.
5. `monitor_task_complete` 또는 `monitor_task_error`로 종료.

## 이벤트 매핑

- `monitor_explore` — 파일 읽기, 코드 검색, 문서 조회
- `monitor_save_context` + `lane="planning"` — 계획, 분석, 접근 결정
- `monitor_save_context` + `lane="user"` — 사용자가 볼 만한 주요 체크포인트
- `monitor_terminal_command` — 셸 명령. test/lint/build는 `lane="rules"`, 그 외 `lane="implementation"`
- `monitor_tool_used` — 파일 수정, patch 적용 등 핵심 도구 사용
- `monitor_task_complete` — 작업 완료 및 검증 후
- `monitor_task_error` — 실패·차단·중단 시

## 필수 리듬

- 첫 탐색 전에 모니터링 시작
- 첫 수정 전에 planning 스냅샷 하나 저장
- 검증 명령은 요약 이벤트에 숨기지 말고 개별 기록
- 고신호 이벤트만 기록, 노이즈는 생략
- 파일이 이벤트에 중요하면 `filePaths`에 절대 경로 전달
- MCP 도구 실패 시 작업 계속 후 마지막에 모니터링 gap 리포트

## 최소 흐름

1. `monitor_task_start`
2. `monitor_explore` — 탐색
3. `monitor_save_context` — 계획 스냅샷
4. `monitor_terminal_command` / `monitor_tool_used` — 구현
5. `monitor_task_complete` 또는 `monitor_task_error`
