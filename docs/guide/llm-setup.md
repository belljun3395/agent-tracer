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

## 시맨틱 트레이스 계약 (v1)

Agent Tracer는 5개 레인(user / exploration / planning / implementation / rules) 안에서 다음 이벤트 종류를 지원합니다.

### 새 이벤트 종류

| Kind | Lane | 용도 |
|------|------|------|
| `question.logged` | `user` (asked/answered) / `planning` (concluded) | 에이전트가 던지거나 결론낸 질문 흐름 |
| `todo.logged` | `planning` | 태스크 내 항목의 상태 전이 (added → in_progress → completed/cancelled) |
| `thought.logged` | `planning` | 요약 안전한 추론 스냅샷. raw 체인오브소트 덤프 **금지** |

### 안정 메타데이터 필드 (TRACE_METADATA_KEYS)

| 필드 | 설명 |
|------|------|
| `questionId` | 같은 질문의 여러 단계를 묶는 안정 식별자 |
| `questionPhase` | `asked` / `answered` / `concluded` |
| `todoId` | 같은 항목의 상태 전이를 묶는 안정 식별자 |
| `todoState` | `added` / `in_progress` / `completed` / `cancelled` |
| `sequence` | 같은 밀리초 이벤트의 결정론적 정렬 |
| `modelName` | 이벤트를 처리한 AI 모델명 |
| `modelProvider` | 모델 공급자 (`anthropic` 등) |
| `mcpServer` | MCP 서버 이름 |
| `mcpTool` | 호출된 MCP 도구명 |

### 규칙

- 6번째 레인 없음. `model.logged` / `mcp.logged` 최상위 이벤트 종류 없음.
- `thought.logged`는 요약만. raw 체인오브소트 퍼시스트 금지.
- 모델 식별은 태스크/세션 기본값 + 이벤트별 오버라이드(다를 때만).
- 새 메타데이터가 없는 기존 이벤트는 변경 없이 렌더링됨.
