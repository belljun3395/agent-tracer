## Skills

A skill is a set of local instructions stored in a `SKILL.md` file.

### Available skills

- monitor: MCP가 있는 모든 환경에서 Agent Tracer 모니터링 기록. Cursor, Windsurf, 웹 IDE 등 CLI 비전용 환경에 적합. (file: skills/monitor/SKILL.md)
- codex-monitor: Codex CLI 전용 모니터링. apply_patch/view_file 등 Codex 도구명 컨벤션 포함. (file: skills/codex-monitor/SKILL.md)

### How to use skills

- **Trigger rules:**
  - Codex CLI → `codex-monitor` 스킬 사용
  - 그 외 MCP 지원 환경 → `monitor` 스킬 사용
  - OpenCode → 플러그인 훅 자동 동작 (스킬 불필요)
  - Claude Code → hook 자동 동작 (스킬 불필요)
- 네이티브 discovery projection:
  - Codex/OpenCode → `.agents/skills/...`
  - Claude fallback → `.claude/skills/agent-tracer-monitor/SKILL.md`
  - human-edited source는 계속 `skills/...`
- 스킬 source를 수정한 뒤에는 `npm run sync:skills` 로 projection 갱신.
- Codex는 새 `AGENTS.md` / `.agents/skills` 내용을 새 스레드에서 더 안정적으로 읽는다.
- 자동 트리거가 빗나가면 프롬프트에 `$codex-monitor` 를 명시해 강제 호출.
- 스킬 파일을 열고 실질적 작업 전에 흐름을 따름.
- monitor-server MCP 서버 미가용 시 작업 계속하고 마지막에 gap 리포트.

### 캐노니컬 user.message 경로

- MCP/수동 환경 → `monitor_user_message` (`captureMode="raw"`) 으로 실제 사용자 프롬프트 기록
- `monitor_save_context`는 raw 프롬프트 경로가 아닌 계획·체크포인트 전용
- `monitor_session_end`는 세션만 종료; 작업 항목 종료는 `monitor_task_complete`만 사용
- OpenCode/Claude 자동 통합은 raw 프롬프트를 우선 기록하고, 훅 페이로드에 raw 프롬프트가 없을 경우
  `ruleId: user-message-capture-unavailable` 규칙 이벤트로 gap을 명시적으로 기록
