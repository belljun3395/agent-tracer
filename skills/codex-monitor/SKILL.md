---
name: codex-monitor
description: Codex CLI 전용 Agent Tracer 모니터링. apply_patch, view_file 등 Codex 도구명 컨벤션 포함. monitor-server MCP 사용 불가 시 사용 중단.
---

# Codex Agent Tracer Monitor

Codex CLI 환경에서 Agent Tracer에 태스크를 동기화하는 primary 경로.
네이티브 훅이 지원되지 않는 Codex에서 MCP 도구로 수동 추적.

## Quick Start

1. `monitor-server` MCP 서버 확인. 없으면 중단.
2. 첫 탐색·수정·검증 전에 `monitor_task_start` 호출.
3. 반환된 `task.id`와 `sessionId`를 이후 모든 호출에 재사용.
4. 고신호 마일스톤 기록.
5. `monitor_task_complete` 또는 `monitor_task_error`로 종료.

## 이벤트 매핑

(monitor 스킬과 동일 + Codex 특화 컨벤션)

- `monitor_explore` — `read_file`, `web_search`, 의존성 확인
- `monitor_save_context` + `lane="planning"` — 계획·분석·트레이드오프
- `monitor_terminal_command` — `lane="rules"` for test/lint/build, 그 외 `lane="implementation"`
- `monitor_tool_used` — `apply_patch`, `view_image` 등 핵심 Codex 도구

## Codex 컨벤션

- **태스크 제목**: `Codex - <workspace-name>` (예: `Codex - agent-tracer`)
- **시작 요약**: 한 문장으로 사용자 목표 서술
- **계획 제목**: 동사로 시작 (예: `Inspect current integration`, `Switch to skill-based monitoring`)
- **도구명**: 실제 Codex 도구명 사용 (`apply_patch`, `view_file`, `read_file`, `web_search`)
- **실패 요약**: 무엇이 실패했고 어떤 후속 작업이 남았는지 명시

## 최소 흐름

1. `monitor_task_start` (`title`: `Codex - <workspace>`)
2. `monitor_explore` — 코드베이스·레퍼런스 탐색
3. `monitor_save_context` (`lane="planning"`) — 계획 스냅샷
4. `monitor_terminal_command` + `monitor_tool_used` — 구현
5. `monitor_task_complete` 또는 `monitor_task_error`
