# Codex CLI Hook Payload Spec

공식 문서: https://developers.openai.com/codex/hooks

Codex CLI hook이 `stdin`으로 받는 JSON payload와 `stdout`/exit code 규칙을 정리한다.
`[실측]` 표기는 공식 문서와 현재 런타임(`codex-cli 0.116.0-alpha.1`)에서 실제로 관측한 차이를 뜻한다.

---

## 활성화와 위치

Codex hook은 feature flag가 켜져 있어야 동작한다.

```toml
[features]
codex_hooks = true
```

공식 문서 기준 Codex가 주로 보는 위치:

- `~/.codex/hooks.json`
- `<repo>/.codex/hooks.json`

주의사항:

- 여러 `hooks.json`이 있으면 모두 로드된다.
- 같은 이벤트에 매칭된 command hook들은 병렬로 실행된다.
- 현재 Windows에서는 hook이 비활성화되어 있다.

---

## Config Shape

공식 문서 기준 `hooks.json` 구조는 다음 3단계다.

1. hook event (`SessionStart`, `PreToolUse`, `Stop` 등)
2. matcher group
3. 하나 이상의 hook handler

예시:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.codex/hooks/session_start.py"
          }
        ]
      }
    ]
  }
}
```

메모:

- `timeout` 단위는 초다.
- `timeoutSec`도 alias로 허용된다.
- timeout 생략 시 기본값은 `600`초다.
- command는 세션의 `cwd`에서 실행된다.
- repo-local hook은 상대 경로보다 git root 기준 경로를 권장한다.

---

## Matcher 동작

공식 문서 기준 matcher 지원 범위:

| Event | matcher 대상 | 비고 |
|------|------|------|
| `SessionStart` | `source` | 현재 값은 `startup`, `resume` |
| `PreToolUse` | `tool_name` | 현재는 사실상 `Bash`만 옴 |
| `PostToolUse` | `tool_name` | 현재는 사실상 `Bash`만 옴 |
| `UserPromptSubmit` | 지원 안 함 | matcher가 있어도 무시됨 |
| `Stop` | 지원 안 함 | matcher가 있어도 무시됨 |

---

## 공통 입력 필드

공식 문서상 모든 command hook의 공통 입력:

| 필드 | 타입 | 설명 |
|------|------|------|
| `session_id` | string | 현재 session/thread id |
| `transcript_path` | string \| null | session transcript 경로 |
| `cwd` | string | 현재 작업 디렉토리 |
| `hook_event_name` | string | 현재 hook 이벤트 이름 |
| `model` | string | 활성 모델 slug |

> **[실측]** 현재 런타임 payload에는 공식 문서에 없는 `permission_mode`가 같이 들어왔다.
>
> **[실측]** 공식 문서는 `transcript_path`를 공통 필드로 적지만, `SessionStart`와 `Stop` payload에서는 실제로 누락된 케이스를 관측했다.

---

## 공통 출력 필드

공식 문서상 `SessionStart`, `UserPromptSubmit`, `Stop`은 아래 JSON 출력을 공통으로 지원한다.

```json
{
  "continue": true,
  "stopReason": "optional",
  "systemMessage": "optional",
  "suppressOutput": false
}
```

| 필드 | 효과 |
|------|------|
| `continue` | `false`면 해당 hook run을 중단 상태로 기록 |
| `stopReason` | 중단 이유 기록 |
| `systemMessage` | UI/event stream 경고 메시지 |
| `suppressOutput` | 파싱은 되지만 아직 미구현 |

공식 문서 메모:

- exit code `0` + no output 은 성공으로 처리된다.
- `PreToolUse`는 `systemMessage`만 실질 지원한다.
- `PostToolUse`는 `systemMessage`, `continue: false`, `stopReason`을 지원한다.
- `Stop`은 성공 시 plain text `stdout`이 아니라 JSON 또는 빈 출력이어야 안전하다.

---

## 이벤트별 Payload

### SessionStart

트리거: 세션 시작 또는 재개

추가 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `source` | string | `startup` \| `resume` |

공식 문서 메모:

- matcher는 `source`에 적용된다.
- plain text `stdout`은 developer context로 추가된다.
- JSON `stdout`은 `hookSpecificOutput.additionalContext`를 지원한다.

> **[실측]** 현재 런타임 `SessionStart` payload에는 `permission_mode`가 있었고, `transcript_path`는 없었다.

---

### PreToolUse

트리거: Bash 실행 직전

추가 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `turn_id` | string | 현재 turn id |
| `tool_name` | string | 현재는 항상 `Bash` |
| `tool_use_id` | string | tool 호출 id |
| `tool_input.command` | string | 실행 예정 shell command |

공식 문서 메모:

- 현재 `PreToolUse`는 Bash만 지원한다.
- JSON `stdout`으로 `permissionDecision: "deny"` 또는 legacy `decision: "block"`을 반환해 차단할 수 있다.
- exit code `2` + `stderr` reason도 차단 경로로 지원된다.
- `permissionDecision: "allow"`, `"ask"`, `updatedInput`, `continue: false`, `stopReason` 등은 파싱되지만 아직 fail-open이다.

---

### PostToolUse

트리거: Bash 실행 직후

추가 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `turn_id` | string | 현재 turn id |
| `tool_name` | string | 현재는 항상 `Bash` |
| `tool_use_id` | string | tool 호출 id |
| `tool_input.command` | string | 방금 실행한 shell command |
| `tool_response` | JSON value | Bash 결과 payload. 현재는 JSON string인 경우가 많음 |

공식 문서 메모:

- 현재 `PostToolUse`도 Bash만 지원한다.
- plain text `stdout`은 무시된다.
- JSON `stdout`의 `hookSpecificOutput.additionalContext`는 developer context로 추가된다.
- `decision: "block"`은 이미 실행된 command를 되돌리지 않고, 원래 tool result를 hook 피드백으로 대체한다.
- `continue: false`를 주면 원래 tool result 처리를 멈추고 hook 메시지로 계속 진행한다.

> **[실측]** 공식 문서 설명대로 non-interactive `codex exec`에서도 Bash post-tool payload를 관측했다.

---

### UserPromptSubmit

트리거: 사용자 프롬프트 제출 직전

추가 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `turn_id` | string | 현재 turn id |
| `prompt` | string | 전송 직전 사용자 프롬프트 |

공식 문서 메모:

- matcher는 현재 사용되지 않는다.
- plain text `stdout`은 developer context로 추가된다.
- JSON `stdout`의 `hookSpecificOutput.additionalContext`도 지원한다.
- `decision: "block"` 또는 exit code `2`로 프롬프트를 차단할 수 있다.

> **[실측]** `codex-cli 0.116.0-alpha.1`에서 실제 session transcript에는 `user_message`가 남았지만, `.codex/hooks.log`에는 `UserPromptSubmit` payload가 관측되지 않았다.
>
> **[실측]** 그래서 현재 adapter는 `UserPromptSubmit`을 1차 경로로 두되, `Stop` 시 transcript/session-file backfill로 `user.message`를 복구하는 fallback이 필요하다.

---

### Stop

트리거: turn 종료 시

추가 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `turn_id` | string | 현재 turn id |
| `stop_hook_active` | boolean | 이 turn이 이전 `Stop` hook으로 이미 continuation 되었는지 |
| `last_assistant_message` | string \| null | 최신 assistant 메시지 |

공식 문서 메모:

- matcher는 현재 사용되지 않는다.
- 이 이벤트는 plain text `stdout`을 허용하지 않는다.
- `decision: "block"`은 turn을 reject하지 않고, reason을 새 user prompt로 삼아 Codex를 계속 진행시킨다.
- `continue: false`는 다른 `Stop` continuation보다 우선한다.

> **[실측]** 현재 런타임에서 관측한 `Stop` payload는 다음 필드만 안정적으로 포함했다:
> `session_id`, `cwd`, `hook_event_name`, `model`, `permission_mode`, `stop_hook_active`, `last_assistant_message`
>
> **[실측]** 공식 문서 표에 있는 `turn_id`와 공통 필드 `transcript_path`는 실제 payload에서 빠져 있었다.
>
> **[실측]** 다만 `~/.codex/sessions/.../rollout-*-<session_id>.jsonl` session 파일에는 `task_started`, `user_message`, `task_complete`, `response_item.custom_tool_call(apply_patch)` 같은 row가 남았고, 여기서 현재 turn을 역으로 복구할 수 있었다.

---

## 실측 Session Transcript 메모

현재 Codex session JSONL에서 확인한 대표 row 타입:

```text
session_meta
event_msg { type: "task_started" }
event_msg { type: "user_message" }
response_item { type: "custom_tool_call", name: "apply_patch" }
event_msg { type: "task_complete", last_agent_message: ... }
```

이 transcript는 공식 `Stop` payload가 빈약할 때 backfill 근거로 쓸 수 있다.

---

## 이벤트 발동 순서

공식 문서 기준 기본 흐름:

```text
세션 시작
  └─ SessionStart

사용자 입력
  └─ UserPromptSubmit

도구 실행
  ├─ PreToolUse
  ├─ (Bash 실행)
  └─ PostToolUse

turn 종료
  └─ Stop
```

> **[실측]** 현재 runtime에서는 `UserPromptSubmit`이 빠지는 경우가 있어, 실제 adapter는 `SessionStart` → `PreToolUse/PostToolUse` → `Stop`만 들어온다고 가정하고 설계하는 편이 안전했다.

---

## 구현 체크리스트

Codex CLI hook adapter를 구현할 때는 다음을 지키는 편이 안전하다.

- `UserPromptSubmit`와 `Stop`에는 matcher를 기대하지 말 것
- `PreToolUse` / `PostToolUse`는 현재 Bash 전용으로 취급할 것
- `Stop`에서 `turn_id`와 `transcript_path`가 항상 있다고 가정하지 말 것
- repo-local hook command는 git root 기준으로 hook 파일을 찾을 것
- `Stop` hook은 plain text를 `stdout`에 쓰지 말 것
- transcript backfill이 필요하면 session id만으로 `~/.codex/sessions`를 역조회하는 fallback을 둘 것
