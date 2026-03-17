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
- 스킬 파일을 열고 실질적 작업 전에 흐름을 따름.
- monitor-server MCP 서버 미가용 시 작업 계속하고 마지막에 gap 리포트.
