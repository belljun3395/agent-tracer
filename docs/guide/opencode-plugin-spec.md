# OpenCode Plugin Hook Payload Spec

공식 문서: https://opencode.ai/docs/en/plugins/

각 hook이 플러그인에 전달하는 파라미터 구조를 정리한다.
`[실측]` 표기는 공식 스펙과 실제 동작이 다른 부분을 나타낸다.

---

## 플러그인 Hook 목록

OpenCode 플러그인은 공식 이벤트 타입과 별개로 다음 훅을 직접 등록한다:

| Hook 이름 | 트리거 | 파라미터 타입 |
|-----------|--------|--------------|
| `chat.message` | AI 응답 메시지 시작 시 | `{ sessionID, model, messageId, partsCount }` |
| `tool.execute.before` | 도구 실행 직전 | `{ sessionID, tool, callID, args }` |
| `tool.execute.after` | 도구 실행 완료 후 | `{ sessionID, tool, callID, args, outputTitle, outputMetadata }` |
| `command.execute.before` | CLI 커맨드 실행 전 | (공식 문서 미기재) |
| `event` | 내부 이벤트 발생 시 | `{ event: { type, ...payload } }` |

---

## Hook별 파라미터 상세

### chat.message

트리거: AI 모델이 응답 메시지를 시작할 때

| 필드 | 타입 | 예시 |
|------|------|------|
| `sessionID` | string | `"ses_2f5ed0abdffeLxAyEWhwyfyAxZ"` |
| `model` | object | `{ providerID: "openai", modelID: "gpt-5.3-codex-spark" }` |
| `model.providerID` | string | `"openai"` \| `"github-copilot"` \| `"opencode"` |
| `model.modelID` | string | `"gpt-5.3-codex-spark"` \| `"gpt-5-mini"` \| `"minimax-m2.5-free"` |
| `messageId` | string | `"msg_d0a12f556001YOZl4YUK9rD6m6"` |
| `partsCount` | number | `1` |

> **[실측]** 공식 문서에 `chat.message` hook 파라미터 상세 없음. 위 필드는 실측값.
> **[실측]** 서브에이전트 세션(병렬 `task` 도구 실행)에서도 동일 구조로 발화됨. `sessionID`로 어느 세션의 메시지인지 구분 가능.

---

### tool.execute.before

트리거: 도구 실행 직전

| 필드 | 타입 | 설명 |
|------|------|------|
| `sessionID` | string | 세션 ID |
| `tool` | string | 도구 이름 (아래 목록 참조) |
| `callID` | string | 도구 호출 고유 ID. `tool.execute.after`와 매칭 가능 |
| `args` | object | 도구별 입력 인자 |

**tool별 args 구조:**

```
read:            { filePath, offset?, limit? }
glob:            { pattern, path? }
grep:            { pattern, include?, path?, output_mode?, head_limit? }
bash:            { command, workdir?, description?, timeout? }
todowrite:       { todos: Array<{ content, status, priority }> }
websearch:       { query }
webfetch:        { url, format? }
apply_patch:     { patchText }
ast_grep_search: { pattern, lang, paths, context? }
task:            { subagent_type, load_skills, description, prompt, run_in_background? }
background_cancel: { taskId }
```

> **[실측]** 공식 문서에 `tool.execute.before` 파라미터 상세 없음. 위 구조는 실측값.
> **[실측]** Claude Code의 `tool_use_id`에 해당하는 필드가 OpenCode에서는 `callID`.
> **[실측]** `bash` 도구의 `args`에 `workdir` 필드가 존재 (Claude Code의 `command`만 있는 것과 다름).
> **[실측]** `task` 도구 (서브에이전트 실행)의 `args`에 `sessionId`는 없음 — `tool.execute.after`의 `outputMetadata`에서 확인 가능.
> **SDK 타입 주의**: `tool.execute.before` hook 시그니처는 `(input, output)` 구조. `sessionID`, `tool`, `callID`는 `input`에, `args`는 `output.args`에 있음. `tool.execute.after`는 `args`가 `input.args`에 있음.

---

### tool.execute.after

트리거: 도구 실행 완료 후

| 필드 | 타입 | 설명 |
|------|------|------|
| `sessionID` | string | 세션 ID |
| `tool` | string | 도구 이름 |
| `callID` | string | `tool.execute.before`와 동일한 ID |
| `args` | object | `tool.execute.before`와 동일한 입력 |
| `outputTitle` | string | 도구 결과 요약 제목 (빈 문자열 가능) |
| `outputMetadata` | object | 도구별 결과 메타데이터 (아래 참조) |

**outputMetadata 구조 (도구별):**

```
read:
  { preview: string, truncated: boolean, loaded: [] }
  - preview: 파일 내용 앞부분 (200자 내외)
  - loaded: 항상 빈 배열 (실측)

bash:
  { output: string, exit: number, description: string, truncated: boolean }
  - output: stdout+stderr 결합 (200자 내외로 truncate됨)
  - exit: 종료 코드

glob / grep:
  { truncated: boolean }
  - outputTitle 항상 "" (실측)
  - 실제 결과 내용 없음 (실측)

websearch:
  { truncated: boolean }
  - 검색 결과 내용 없음 (실측)

webfetch:
  { truncated: boolean }
  - 페이지 내용 없음 (실측)

todowrite:
  { todos: Array<{ content, status, priority }>, truncated: boolean }
  - outputTitle: "N todos" (완료된 항목 제외한 pending/in_progress 개수)

apply_patch:
  { diff: string, files: Array<FileChange>, diagnostics: {}, truncated: boolean }
  - files[].filePath: 절대 경로
  - files[].relativePath: 상대 경로
  - files[].type: "update"
  - files[].diff: unified diff 문자열
  - files[].before: 변경 전 내용
  - files[].after: 변경 후 내용
  - files[].additions: 추가된 줄 수
  - files[].deletions: 삭제된 줄 수

task (서브에이전트):
  { truncated: boolean, prompt: string, agent: string, load_skills: [],
    description: string, run_in_background: boolean,
    sessionId: string, model: { providerID, modelID } }
  - sessionId: 서브에이전트의 실제 sessionID (before에는 없고 after에만 존재)
  - model: 서브에이전트가 사용한 모델 정보

background_cancel:
  { truncated: boolean }
  - 취소 성공 여부 정보 없음 (실측)
```

> **[실측]** `glob`/`grep`/`websearch`/`webfetch`의 `outputMetadata`에 실제 결과 내용이 없음.
> 플러그인에서 이 도구들의 출력을 intercept하기 어려움.
> **[실측]** `task` 도구 after에 `outputMetadata.sessionId`가 포함 — 어느 세션이 서브에이전트로 생성됐는지 추적 가능.
> **[실측]** `apply_patch`는 Claude Code의 `Edit`/`Write`에 해당하는 파일 편집 도구. 스펙 미문서.

---

### event

트리거: OpenCode 내부 이벤트 발생 시마다

파라미터: `{ event: EventObject }`

`event.type`으로 이벤트 종류를 구분. 대부분의 이벤트에서 `event`는 `type` 외 추가 필드가 없음.

**이벤트 타입별 `event.properties` 구조:**

플러그인 코드(`monitor.ts`)에서 실제로 접근하는 필드 기준 — SDK 타입이 정의하는 실제 구조.

| event.type | properties 구조 | 코드에서 사용하는 필드 |
|------------|----------------|----------------------|
| `session.created` | `{ info: { id, directory, title } }` | `info.id`, `info.directory`, `info.title` |
| `session.deleted` | `{ info: { id } }` | `info.id` |
| `session.idle` | `{ sessionID: string }` | `sessionID` |
| `message.updated` | `{ info: { role, id, sessionID, finish, error, time } }` | `info.role`, `info.id`, `info.sessionID`, `info.finish`, `info.error`, `info.time.completed` |
| `tui.command.execute` | `{ command: string }` | `command` |
| `command.executed` | `{ name?, command?, input?, args?, title? }` | exit 커맨드 감지에 사용 |
| `server.instance.disposed` | (미사용) | 세션 종료 트리거로만 사용 |
| `session.updated` / `session.status` / `session.diff` / `session.idle` 외 나머지 | SDK 타입 정의됨 | **플러그인에서 미사용** |

> **로그에서 대부분 `{}` 로 표시된 이유**: 로깅 코드가 `id` 필드만 추출하도록 작성됨.
> 실제 properties는 위 표처럼 풍부한 구조를 가짐. 로그 형식의 한계.

> **`session.error`**: properties 구조가 SDK에 정의되어 있으나, 플러그인에서 이 이벤트를 핸들링하지 않음.
> 서브에이전트 종료 시 발화되는 것으로 추정 (정상 종료에도 발화).

> **`message.part.delta`**: 공식 문서에 없는 이벤트. 스트리밍 텍스트 델타 전송 시 발화.
> 플러그인에서 핸들링하지 않음.

---

## 이벤트 발동 순서

```
세션 시작
  └─ event: session.created
  └─ event: session.updated

사용자 메시지 → AI 응답 시작
  └─ chat.message (모델 정보, messageId)
  └─ event: message.updated
  └─ event: message.part.updated (반복)
  └─ event: message.part.delta  (스트리밍 중 반복) [미문서]

도구 실행
  ├─ tool.execute.before
  ├─ (도구 실행)
  └─ tool.execute.after

task 도구 (서브에이전트 실행)
  ├─ tool.execute.before (tool: "task", run_in_background: true)
  ├─ event: session.created (서브에이전트 신규 세션)
  ├─ event: session.updated
  ├─ chat.message (서브에이전트 세션)
  ├─ tool.execute.before/after (서브에이전트 내부 도구들)
  ├─ event: session.error {} ← 서브에이전트 종료 시 [실측: 에러 아닐 수 있음]
  ├─ event: session.idle
  └─ tool.execute.after (tool: "task", outputMetadata.sessionId 포함)

세션 종료 (명시적 이벤트 없음) [실측]
  └─ event: session.idle (마지막 활동 후)
```

> **[실측]** `session.deleted` 이벤트 미관측. 세션 종료를 명시적으로 알 수 없음.
> `session.idle` 이후 더 이상 이벤트가 없으면 종료로 간주해야 함.
>
> **[실측]** 서브에이전트 종료 시 `session.error {}` 가 발화됨.
> 실제 에러가 아닌 정상 종료에도 동일하게 발화 — 에러 이벤트로 신뢰 불가.
