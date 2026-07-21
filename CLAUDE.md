# Agent Tracer

코딩 에이전트의 활동을 수집하고 조회하고 분석하는 모니터링 시스템이다.
쓰기와 읽기가 데이터베이스를 공유하지 않고 변경 데이터 캡처로 연결된다.

## 문서 지도

**구조를 바꾸거나 새 코드를 어디에 둘지 정할 때는 `ARCHITECTURE.md`를 먼저 읽는다.**
세 축(배포 단위·도메인·계층), 계층 어휘 다섯, 의존 방향, 중복 정책, 배포 단위별 구조가 전부
거기 있다. 그 문서 하나로 판단이 끝나야 하고, 끝나지 않으면 그것이 문서의 결함이다.

아래는 결정의 근거다. 각 문서는 자기완결이므로 필요한 하나만 열면 된다.

| 결정 문서 | 언제 읽는가 |
|---|---|
| `0001-cqrs-cdc-split` | 원장·읽기 모델·투영의 관계를 만질 때. 읽기 모델에 무엇을 넣어도 되는지 판단할 때 |
| `0002-run-from-source` | 빌드·번들·실행 명령을 바꿀 때 |
| `0003-node-version` | 의존성을 올리거나 테스트가 네이티브 바인딩으로 대량 실패할 때 |
| `0004-shared-kernel` | 배포 단위 사이에 무언가를 공유하고 싶을 때 |
| `0005-event-vocabulary` | 새 이벤트 종류나 속성 이름을 만들 때 |
| `0006-three-axes` | 새 폴더를 만들 때. 최상위에 무엇을 둘지 고민될 때 |
| `0007-layer-vocabulary` | 계층 이름과 파일 접미사를 정할 때. 유스케이스가 유스케이스를 부르고 싶을 때 |
| `0008-ports-owned-by-slice` | 바깥으로 나가는 의존을 추가할 때. 포트를 어디 둘지 고민될 때 |
| `0009-duplication-policy` | 두 도메인이 비슷한 코드를 가질 때. 공통 모듈을 만들고 싶을 때 |
| `0010-config-and-support` | 도메인에 속하지 않는 코드를 둘 자리를 찾을 때 |
| `0011-feature-axis-for-fanout` | 투영기를 만질 때. 투영을 추가할 때 |
| `0012-architecture-manifest` | 규칙을 추가하고 싶을 때. 파일 크기나 테스트 허용치를 올리고 싶을 때 |
| `0013-self-contained-docs` | 문서나 주석에 참조·링크·이력을 쓰고 싶을 때 |
| `0014-comments-and-tests` | 주석을 쓸지 테스트를 쓸지 판단할 때 |
| `0015-immediate-cutover` | 저장 포맷이나 계약을 바꿀 때 |
| `0016-commit-convention` | 커밋을 나눌 때 |
| `0017-agent-spec-owned-by-domain` | 프롬프트·출력 스키마·에이전트 도구를 만질 때 |
| `0018-temporal-orchestration` | AI 잡의 재시도·취소·시간 초과를 만질 때 |
| `0019-web-feature-sliced-design` | 웹에 화면이나 상태를 추가할 때 |
| `0020-agents-fetch-evidence-with-tools` | 에이전트가 볼 근거를 정할 때. 프롬프트에 정보를 붙이고 싶을 때 |
| `0021-model-citations-verified-against-a-ledger` | 모델이 낸 출력을 저장할 때. 검증을 느슨하게 풀고 싶을 때 |
| `0022-execution-outlives-the-connection` | 오래 걸리는 유료 실행을 부를 때 |
| `0023-entities-own-the-schema` | 컬럼·기본값·인덱스를 바꿀 때. 마이그레이션을 손으로 고치고 싶을 때 |
| `0024-rules-are-anchored-to-one-utterance` | 규칙이 언제 걸리는지 정할 때. 규칙을 재사용하고 싶을 때 |
| `0025-judgment-lives-until-fulfilled` | 규칙 이행 여부를 판정할 때. 턴을 막을지 정할 때 |
| `0026-two-backends-per-agent` | 에이전트의 도구·출력·예산·검증을 만질 때. 두 백엔드가 갈라졌는지 볼 때 |
| `0027-local-agent-meets-the-server-bar` | 데몬이 로컬에서 도는 규칙 생성기를 만질 때 |
| `0028-incremental-rule-evaluation` | 규칙 판정의 재조회·재평가 비용을 만질 때. 판정을 상태로 전진시킬 때 |
| `0029-retention-and-archival-ownership` | 보존 기간·아카이브·삭제 책임을 정할 때. 어떤 데이터가 언제까지 남는지 판단할 때 |
| `0030-projection-write-authorization-gap` | 인증을 도입할 때. 투영이 taskId 소유권을 강제하는지 판단할 때 |
| `0031-agents-read-through-views` | 파이썬 에이전트가 읽는 데이터를 바꿀 때. 뷰에 없는 열이 필요해질 때 |
| `0032-coordinator-and-specialists` | 조사를 나눌 때. 전문가를 더하거나 뺄 때. 예산 배분과 근거 장부 병합을 만질 때 |
| `0033-recipes-are-chosen-by-the-model` | 레시피가 에이전트에게 닿는 방식을 만질 때. 레시피의 성과를 재거나 도태시킬 때 |
| `0034-operational-logs-are-queried-by-name` | 로그를 더할 때. 이벤트 이름과 수준과 상관 식별자를 정할 때 |
| `0035-local-profile-runs-agents-on-subscription-auth` | 로컬에서 API 키 없이 에이전트를 돌릴 때. 프로파일이 인증과 기본 백엔드를 가를 때 |

## 놓치기 쉬운 규칙

- 최상위에 계층 이름이 보이면 축이 뒤집힌 것이다. `src/domain/<슬라이스>/<계층>`이다.
- 한 도메인 안의 중복은 금지, 도메인 사이의 중복은 허용이다. 공통 모듈로 끌어올리지 않는다.
- 아웃바운드 의존은 시계와 난수까지 전부 포트 뒤에 둔다.
- 아키텍처 규칙이 특정 파일 이름을 인용해야 한다면 그 파일이 잘못된 자리에 있는 것이다.
- 문서와 주석에 링크·다른 문서 참조·이력 서술을 쓰지 않는다.
- 동작은 테스트가 소유한다. 주석은 포트 계약, 와이어 타입의 의미, 외부 제약만 담는다.
- 300줄 초과 파일과 테스트 없는 유스케이스의 허용치는 0이다. 올리지 않는다.
- 루트의 작업 노트(`*.md`)는 의도적으로 추적하지 않는다. `git add -A`를 쓰지 않는다.
- 커밋 본문에 `Constraint:` `Rejected:` `Confidence:` `Tested:` 같은 정형 블록을 쓰지 않는다.
  본문은 없거나 네 줄 이내다. 도구가 제 습관대로 붙이면 지우고 커밋한다.
- 커밋 훅을 건너뛰지 않는다. `--no-verify`로 만든 커밋은 푸시할 때 다시 걸린다.
- 지침은 이 파일 하나가 소유한다. 옆의 `AGENTS.md`는 Codex가 같은 내용을 읽게 하는 링크다.
  `CLAUDE.md`를 새로 두면 그 자리에 링크도 함께 세운다. 구조 검사가 빠진 링크를 잡는다.

## 명령

| 목적 | 명령 |
|---|---|
| 인프라 기동 (PG×2·Redpanda·OpenSearch·Temporal) | `npm run infra:up` |
| 인프라 종료 | `npm run infra:down` |
| 전체 dev 서버 (인프라 선행 필수, agents 포함) | `npm run dev` |
| 배포되는 이미지 그대로 전체 기동 (진입점 `127.0.0.1:3847`) | `npm run stack:up` / `stack:down` / `stack:logs` |
| 위 스택을 AI 잡만 Claude SDK+구독 토큰으로 (`CLAUDE_CODE_OAUTH_TOKEN` 필요) | `npm run stack:up:local` |
| 관측 스택(Grafana·Prometheus·Loki·Tempo) 동반 기동 | `npm run monitoring:up` / `monitoring:down` |
| 배포 이미지 일곱 빌드와 내용 검사 (CI가 부르는 것과 같다) | `npm run check:images` |
| `packages/agents`(Python)만 기동 | `npm run dev:agents` |
| 검증 (작업 완료 전 필수) | `npm run lint && npm run test && npm run lint:deps` |
| 의존 그래프 규칙 검사 | `npm run lint:deps` |
| 마이그레이션 생성/실행 (tracer DB) | `npm run migration:generate` / `npm run migration:run` |
| 마이그레이션 생성/실행 (runtime DB) | `npm run migration:generate:runtime` / `npm run migration:run:runtime` |
| 배포 선행 마이그레이션 일괄 실행 | `npm run migrate:all` |
| 읽기 모델 투영 통째 재생성 | `npm run projection:rebuild -- --confirm` |
| 검색 인덱스 재인덱싱 | `npm run search:reindex` |
| 결정적 실패 시나리오 (인프라 필요, 느림) | `npm run e2e:failure` |
| 외부 프로젝트에 Claude Code 플러그인 연결 | `npm run setup:external -- --target <path>` |

## 작업 완료 판정

1. `npm run lint && npm run test && npm run lint:deps` 통과
2. 구조나 명령을 바꿨다면 해당 `CLAUDE.md`를 갱신한다
3. 커밋이 수직 슬라이스 하나이고 메시지가 규약을 따름
