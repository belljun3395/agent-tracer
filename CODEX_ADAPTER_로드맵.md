# Codex Adapter 로드맵

## 문서 목적

이 문서는 Agent Tracer의 Codex 어댑터를 어떤 단계로 확장할지 정리한
중장기 로드맵이다.

[`CODEX_ADAPTER_1차_구현_및_검증계획.md`](./CODEX_ADAPTER_1%EC%B0%A8_%EA%B5%AC%ED%98%84_%EB%B0%8F_%EA%B2%80%EC%A6%9D%EA%B3%84%ED%9A%8D.md)
이 현재 브랜치의 작업 상태와 검증 계획을 다룬다면, 이 문서는 그 바깥의
전체 방향, 단계 우선순위, 완료 기준을 정리한다.

## 최종 목표

Codex를 Claude Code와 동일하게 복제하는 것이 목표는 아니다.

목표는 다음과 같다.

- Codex의 공식 표면을 우선 활용해 Agent Tracer에 안정적으로 연결한다.
- Codex의 interactive 사용을 우선 관찰 가능한 경로로 만든다.
- shared 이벤트 스펙을 중심으로 Codex 전용 adapter를 확장한다.
- 이후 richer surface(app-server)를 붙여 interactive 관측 품질을 높인다.

## 설계 원칙

### 1. 공식 지원 우선

문서화된 표면을 우선 사용한다.

- Codex hooks
- Codex app-server

비공식 내부 구현이나 reverse engineering에 기대는 방식은 우선순위를 낮춘다.

### 2. shared 중심

Codex 어댑터는 독자적인 이벤트 모델을 만들지 않는다.
가능한 한 `packages/runtime/src/shared/*` 스펙에 맞춰 정규화한다.

### 3. 구현보다 검증 우선

어댑터는 연결만 되어서는 부족하다.
실제 사용 흐름에서 재현 가능한 bootstrap, smoke test, 관측 결과 확인 경로가
함께 있어야 한다.

### 4. 단계적 확장

한 번에 Claude 수준 parity를 노리지 않는다.
기본 연결 -> 사용성 -> richer runtime -> 안정화 순서로 간다.

## 현재 위치

현재 브랜치 기준으로는 **1단계 중반**이다.

이미 구현된 것:

- Codex hooks 최소 어댑터
- external setup 기반 Codex bootstrap
- Codex 가이드 문서

아직 남은 것:

- 실제 사용 검증 보강
- plain `codex` 경험 정리
- 중복 수집 정책
- app-server 확장

## 단계별 로드맵

## 1단계: 공식 지원 표면 연결

### 목표

Codex의 공식 문서에 명시된 표면만 사용해 Agent Tracer와 연결한다.

### 범위

- interactive hooks
- 외부 프로젝트 bootstrap
- 최소 문서화

### 산출물

- Codex 전용 runtime adapter
- `setup:external`에서 생성되는 Codex bootstrap
- Codex 가이드

### 완료 기준

- 외부 프로젝트에서 setup 후 Codex를 바로 실행할 수 있다.
- interactive Codex에서 최소 hook 이벤트가 들어온다.
- 문서만 보고 재현 가능하다.

### 현재 상태

- 구현 완료
- 검증 진행 중

## 2단계: 사용성 보강

### 목표

현재 구현을 “쓸 수 있는 상태”에서 “헷갈리지 않고 반복 사용 가능한 상태”로
올린다.

### 핵심 과제

- plain `codex` 사용 경험 정리
- bootstrap 결과물 사용 흐름 단순화
- smoke test 절차 고정

### 세부 작업

- setup 결과를 사용자가 자연스럽게 이해할 수 있도록 안내 정리
- 외부 프로젝트 기준 검증 체크리스트 확정

### 완료 기준

- 팀원이 문서를 보고 setup 후 바로 사용 가능
- 최소 smoke test 결과를 반복 재현 가능

## 3단계: 중복 수집 및 lifecycle 정리

### 목표

Codex 경로에서 발생할 수 있는 중복 이벤트와 session lifecycle을 정리한다.

### 핵심 과제

- session end 규칙
- failure / cancellation 처리 기준

### 세부 작업

- session 종료 이벤트의 생성 시점 확정

### 완료 기준

- 동일 작업에서 중복 이벤트가 통제 가능
- 종료 상태와 실패 상태가 일관되게 표현됨

## 4단계: app-server 기반 richer adapter

### 목표

interactive Codex에서 richer lifecycle과 item stream을 관측할 수 있게 한다.

### 범위

- Codex app-server JSON-RPC
- thread / turn / item 이벤트 수집
- richer interactive timeline

### 기대 효과

- `commandExecution`, `fileChange`, `mcpToolCall`, `turn/plan/updated` 등을
  보다 정교하게 다룰 수 있음

### 의사결정 포인트

- app-server를 주력 interactive 경로로 볼지
- hooks는 보조 표면으로 유지할지

### 완료 기준

- interactive Codex에서 richer event capture가 가능
- hooks-only 경로보다 관측 품질이 확실히 개선됨

## 5단계: subagent / lineage 모델

### 목표

Codex의 subagent / thread 관계를 Agent Tracer task/session 모델에 맞춰 정리한다.

### 핵심 과제

- parent / child task 연결
- spawned thread lineage
- background work 표현

### 완료 기준

- Codex subagent 흐름이 timeline과 task hierarchy에서 일관되게 보임

## 6단계: 안정화 및 운영화

### 목표

Codex 어댑터를 운영 가능한 품질로 정리한다.

### 범위

- 회귀 테스트 확대
- 버전 변화 대응
- capability 문서 정리
- 운영 가이드 정리

### 완료 기준

- Codex CLI 버전 변화에 대한 대응 규칙이 문서화됨
- 회귀 테스트가 핵심 정규화 경로를 보호함
- 신규 사용자가 가이드만으로 설치와 검증 가능

## 우선순위 제안

현재 시점의 권장 우선순위는 다음과 같다.

1. 1단계 검증 완료
2. 2단계 사용성 보강
3. 3단계 lifecycle / dedupe 정리
4. 4단계 app-server 통합
5. 5단계 lineage 모델
6. 6단계 안정화

즉, 지금은 richer integration보다 먼저 **사용성 정리와 검증 완료**가 우선이다.

## Claude 대비 현재 Codex 대응 표

| 항목 | Claude Code | Codex 현재 방향 | 비고 |
|---|---|---|---|
| 기본 연결 방식 | plugin | repo-local hooks + config | Codex는 plugin surface 없음 |
| 기본 실행 방식 | `claude` + plugin | plain `codex` | setup이 `.codex/config.toml` 작성 |
| 기본 capture 축 | hook 중심 | hook 중심 | 1차 범위 |
| richer interactive capture | 제한적 | app-server 예정 | Codex 쪽 장점 |
| file/MCP/web capture | hook에서 가능 | 후속 단계 | app-server로 해결 방향 |
| subagent lineage | 일부 가능 | 후속 단계 | app-server / lineage 설계 필요 |

## app-server 확장 방향

현재 판단은 다음 단계의 핵심이 **app-server 우선**이라는 것이다.

이유:

- interactive Codex 관측 품질을 가장 먼저 끌어올릴 수 있다.
- 현재 hooks의 한계를 보완하는 데 직접적이다.
- thread / turn / item lifecycle과 approval 흐름을 더 잘 다룰 수 있다.
- capture 중심 요구와 가장 직접적으로 맞닿아 있다.

## 지금 당장 결정해야 할 사항

다음 논의에서 우선 정해야 할 항목은 네 가지다.

1. 1단계 완료 기준을 validation-ready로 둘지 merge-ready로 둘지
2. 2단계에서 plain `codex` UX를 어디까지 다듬을지
3. 3단계 dedupe 정책을 언제 시작할지
4. 4단계 app-server 통합 범위를 최소 프로토타입으로 시작할지, interactive 주력 경로로 설계할지

## 문서 연결

- 현재 브랜치 기준 구현 및 검증 상태:
  [`CODEX_ADAPTER_1차_구현_및_검증계획.md`](./CODEX_ADAPTER_1%EC%B0%A8_%EA%B5%AC%ED%98%84_%EB%B0%8F_%EA%B2%80%EC%A6%9D%EA%B3%84%ED%9A%8D.md)
- 현재 구현된 Codex adapter의 데이터 흐름:
  [`packages/runtime/CODEX_DATA_FLOW.md`](./packages/runtime/CODEX_DATA_FLOW.md)
