# Agent Tracer — 에이전트 설정 가이드

## 서버 아키텍처 (generic runtime boundary)

`packages/server`는 특정 런타임에 종속되지 않은 범용 모니터 서버입니다.

- **`POST /api/runtime-session-ensure`** / **`POST /api/runtime-session-end`** — 상태 비저장 런타임 어댑터가 호출하는 범용 헬퍼 엔드포인트. Claude 훅은 `runtimeSource: "claude-hook"`을 전달하여 이 엔드포인트를 사용합니다.
- **OpenCode 플러그인 및 MCP/수동 경로** — `task-start` + 시맨틱 이벤트 엔드포인트 + `/api/session-end` 를 사용하는 표준 범용 진입점입니다. `runtime-session-*` 헬퍼가 필요하지 않습니다.
- **`POST /api/cc-session-ensure`** / **`POST /api/cc-session-end`** — 임시 호환성 래퍼입니다. 신규 통합에는 범용 `runtime-session-*` 엔드포인트를 사용하세요.
- 도메인 모델의 런타임 소스 필드는 `runtimeSource` 파생 읽기 모델로 표준화되었습니다 (이전 CLI 전용 필드 대체).

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

## Thought-Flow Read Model

서버는 runtime event를 그대로 다시 보여주는 것 외에 observability read model도 제공한다.

- `GET /api/tasks/:taskId/observability`
  - 선택 task의 phase breakdown, duration, session 상태, relation coverage, focus summary
- `GET /api/observability/overview`
  - 전체 task 기준 prompt capture / explicit flow / stale running summary
- `GET /api/overview`
  - 기존 stats + rules와 함께 `observability` 스냅샷 포함

웹 대시보드는 이 JSON을 이용해 Top bar diagnostics와 Inspector `Flow` / `Health` 탭을 그린다.

## 시맨틱 트레이스 계약 (v1)

Agent Tracer는 9개 레인에서 thought-flow를 읽는다.

- `user`
- `questions`
- `todos`
- `planning`
- `coordination`
- `exploration`
- `implementation`
- `rules`
- `background`

### 새 이벤트 종류

| Kind | Lane | 용도 |
|------|------|------|
| `question.logged` | `questions` (asked/answered) / `planning` (concluded) | 에이전트가 던지거나 결론낸 질문 흐름 |
| `todo.logged` | `planning` | 태스크 내 항목의 상태 전이 (added → in_progress → completed/cancelled) |
| `thought.logged` | `planning` | 요약 안전한 추론 스냅샷. raw 체인오브소트 덤프 **금지** |
| `agent.activity.logged` | `coordination` | MCP 호출, skill 사용, delegation, handoff, bookmark, search 같은 coordination 신호 |

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

- 별도 `model.logged` / `mcp.logged` 최상위 이벤트 종류는 없고, 관련 정보는 metadata와 coordination lane으로 표현한다.
- `thought.logged`는 요약만. raw 체인오브소트 퍼시스트 금지.
- 모델 식별은 태스크/세션 기본값 + 이벤트별 오버라이드(다를 때만).
- 새 메타데이터가 없는 기존 이벤트는 변경 없이 렌더링됨.
