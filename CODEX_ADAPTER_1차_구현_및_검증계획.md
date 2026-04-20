# Codex Adapter 1차 구현 및 검증 계획

## 목적

이 문서는 `feat/codex-adapter` 브랜치에서 진행 중인 Codex 어댑터 작업의
현재 상태를 정리하고, 1차 범위에서 무엇을 검증해야 하는지 명확히 하기
위해 작성한다.

이번 단계의 목표는 다음과 같다.

- Codex의 **공식 문서에 명시된 표면만** 사용해 Agent Tracer에 연결한다.
- 외부 프로젝트에서 **바로 실행 가능한 부트스트랩 경로**를 만든다.
- 구현 완료 선언이 아니라, **검증 가능한 상태**까지 만든 뒤 다음 단계의
  확장 방향을 정리한다.

이 문서는 최종 설계 문서가 아니다. 현재 브랜치의 구현 의도, 확인 대상,
남은 리스크를 정리하는 작업 문서다.

## 이번 단계 범위

### 포함

- Codex `hooks` 기반 최소 어댑터
  - `SessionStart`
  - `UserPromptSubmit`
  - `PreToolUse`
  - `PostToolUse` (`Bash` only)
  - `Stop`
- `setup:external`을 통한 외부 프로젝트용 Codex bootstrap
- Codex 사용 가이드 및 데이터 흐름 문서

### 제외

- Codex app-server 통합
- subagent/thread hierarchy 추적
- Codex 전용 session end 모델 정교화
- hook 경로와 exec 경로 사이의 dedupe 정책 정교화
- Claude Code 수준의 hook parity

## 현재 구현 상태

### 완료

- `packages/runtime/src/codex` 아래에 Codex 전용 런타임 어댑터 추가
- 최소 hook adapter 추가
- `setup:external`이 외부 프로젝트에 `.codex/config.toml`과
  `.codex/hooks.json`을 생성하도록 확장
- Codex 전용 가이드 추가
- 타입체크 / 테스트 / lint 통과

### 현재 구현 결과

#### 1. Interactive Codex 경로

repo-local hooks를 통해 다음 이벤트를 기본 수집한다.

- `context.saved`
- `user.message`
- `terminal.command` (`Bash` only)
- `assistant.response`

#### 2. 외부 프로젝트 bootstrap

`npm run setup:external -- --target /path/to/project` 실행 시 다음이 생성된다.

- `.claude/settings.json`
- `.codex/config.toml`
- `.codex/hooks.json`

즉, Codex는 외부 프로젝트에서 plain `codex`로 바로 시작 가능한 진입점을 갖는다.

## 확인이 필요한 시나리오

이번 단계에서 핵심은 "구현이 있다"가 아니라 "실제로 쓸 수 있다"를 확인하는
것이다.

### 시나리오 A: interactive Codex

목표:

- `.codex/hooks.json`이 실제로 읽힌다.
- interactive `codex` 세션에서 최소 hook 기반 이벤트가 수집된다.

확인 포인트:

- 세션 시작 시 `context.saved`
- 프롬프트 제출 시 `user.message`
- Bash 실행 시 `terminal.command`
- 응답 종료 시 `assistant.response`

### 시나리오 B: 외부 프로젝트 bootstrap

목표:

- setup 스크립트가 타깃 프로젝트를 반복 실행에도 안전하게 갱신한다.
- 생성된 `.codex/config.toml`과 `.codex/hooks.json`으로 plain `codex`가
  별도 수작업 없이 바로 동작한다.

확인 포인트:

- `.codex/config.toml` 생성/병합
- `.codex/hooks.json` 생성/병합
- plain `codex` 실행 시 hooks 동작
- `MONITOR_BASE_URL` 전달 확인

## 남은 리스크와 미포함 범위

### 1. hook coverage 한계

Codex 공식 hooks는 현재 Bash pre/post interception 중심이다. 따라서
interactive Codex만으로는 파일 수정, MCP 호출, 웹 조회, plan update를
Claude처럼 hook 단위로 풍부하게 받지 못한다.

### 2. session end / lineage 모델 부족

현재는 Codex용 session 종료 모델과 subagent lineage 모델을 충분히 설계하지
않았다. 이 부분은 app-server 통합과 함께 다뤄야 한다.

## Claude 대비 현재 Codex 대응 표

| 항목 | Claude Code | Codex 1차 | 비고 |
|---|---|---|---|
| 배포 방식 | plugin | repo-local hooks + config | Codex는 plugin 경로 없음 |
| 기본 실행 방식 | `claude --plugin-dir ...` 또는 marketplace | plain `codex` | `setup:external`이 `.codex/config.toml` 작성 |
| 세션 시작 캡처 | 가능 | 가능 | `SessionStart` |
| 사용자 프롬프트 캡처 | 가능 | 가능 | `UserPromptSubmit` |
| Bash 명령 캡처 | 가능 | 가능 | `PostToolUse(Bash)` |
| 파일 수정 캡처 | 가능 | 불가 | Codex hooks 현재 미지원 |
| MCP 호출 캡처 | 가능 | 불가 | Codex hooks 현재 미지원 |
| 웹 조회 캡처 | 가능 | 불가 | Codex hooks 현재 미지원 |
| compaction / instructions lifecycle | 가능 | 불가 | Codex 공식 hook surface에 없음 |
| subagent lifecycle | 가능 | 불가 | 후속 단계 필요 |
| richer interactive item stream | hook만으로는 제한적 | 후속 단계 예정 | Codex는 app-server로 확장 계획 |

## 1차 완료 기준

다음이 확인되면 1차는 완료로 본다.

- external setup으로 Codex bootstrap 가능
- interactive Codex에서 최소 hook 이벤트 수집 가능
- 문서만 보고 재현 가능한 수준의 가이드가 존재

아직 이 기준은 "merge-ready"가 아니라 "validation-ready"에 가깝다.
실제 사용 중 관찰되는 보완점을 반영한 뒤에야 안정화 단계로 넘어간다.

## app-server 단계에서 기대하는 확장 범위

1차는 hooks-only interactive capture에 집중한다. 그 다음 단계는
Codex app-server JSON-RPC를 사용해 richer capture를 추가하는 것이다.

공식 문서 기준으로 app-server 단계에서 기대하는 방향은 다음과 같다.

- `thread/*` 이벤트 수집
- `turn/*` 이벤트 수집
- `item/*` 이벤트 수집
- `commandExecution` item 수집
- `fileChange` item 수집
- `mcpToolCall` item 수집
- `turn/plan/updated` 수집
- approval request / resolution 흐름 반영

즉, hooks로는 잡을 수 없는 파일 수정, MCP 호출, richer turn lifecycle을
app-server에서 보강하는 방향이다.

## 전체 로드맵 초안

### 1단계: 공식 지원 표면 연결

목표:

- 공식 hooks
- 외부 bootstrap

상태:

- 현재 브랜치에서 구현 완료
- 검증 진행 중

### 2단계: 사용성 보강

목표:

- plain `codex` 사용 경험 개선
- setup 결과물이 더 자연스럽게 작동하도록 정리
- smoke test 절차 정리

예상 작업:

- plain `codex` 사용 흐름 정리
- smoke test 자동화 또는 반자동화

### 3단계: richer runtime integration

목표:

- Codex app-server JSON-RPC 기반 richer adapter
- thread / turn / item lifecycle 정교화
- subagent hierarchy 모델 도입

예상 작업:

- app-server JSON-RPC 이벤트 매핑
- session 종료 규칙 정교화
- parent/child task linkage

### 4단계: 안정화

목표:

- Claude / Codex 간 공통 스펙 정합성 강화
- capability 문서 정리
- 운영 중 버전 변화에 대한 대응력 확보

예상 작업:

- adapter regression test 확대
- 버전별 호환성 메모
- 운영 가이드 보강

## 다음 논의 포인트

전체 로드맵 논의는 다음 순서로 하는 것이 좋다.

1. 1단계 완료 기준을 어디까지 볼지
2. 2단계에서 plain `codex` UX를 어디까지 다듬을지
3. 3단계에서 app-server 범위를 어디까지 볼지
4. Codex adapter를 Claude adapter와 어느 수준까지 맞출지
