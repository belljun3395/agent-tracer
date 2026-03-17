# Agent Tracer — 에이전트 설정 가이드

## 에이전트별 선택

| 에이전트 | 방법 | 가이드 |
|----------|------|--------|
| Claude Code | 자동 훅 | `docs/guide/claude-setup.md` |
| OpenCode | TypeScript 플러그인 훅 (자동) | `docs/guide/opencode-setup.md` |
| Codex | MCP + `codex-monitor` 스킬 | `docs/guide/codex-setup.md` |
| 기타 (Cursor 등) | MCP + `monitor` 스킬 | MCP 등록 후 `monitor` 스킬 사용 |

## 공통 전제

서버가 실행 중이어야 함:

```bash
curl -sf http://127.0.0.1:${MONITOR_PORT:-3847}/api/overview | python3 -m json.tool
```

미실행 시:

```bash
npm run dev:server
# 또는
npm run build && npm run start:server
```

기본 서버 URL: `http://127.0.0.1:3847`
