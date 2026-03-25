# Codex Skill Adapter

Codex는 native hook가 아니라 skill + MCP 경로를 통해 Agent Tracer와 연결된다.

## 핵심 파일

- `skills/codex-monitor/SKILL.md`
- `docs/guide/codex-setup.md`
- `scripts/sync-skill-projections.mjs`

## 특징

- 수동/명시적 기록 경로라서 관찰 범위가 분명하다
- 대신 자동 관찰 범위는 hook 기반 런타임보다 좁다

## 운영 메모

- skill source와 projection을 혼동하지 않도록 주의
- skill 수정 후 projection sync가 필요하다
