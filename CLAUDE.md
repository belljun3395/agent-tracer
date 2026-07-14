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

## 놓치기 쉬운 규칙

- 최상위에 계층 이름이 보이면 축이 뒤집힌 것이다. `src/domain/<슬라이스>/<계층>`이다.
- 한 도메인 안의 중복은 금지, 도메인 사이의 중복은 허용이다. 공통 모듈로 끌어올리지 않는다.
- 아웃바운드 의존은 시계와 난수까지 전부 포트 뒤에 둔다.
- 아키텍처 규칙이 특정 파일 이름을 인용해야 한다면 그 파일이 잘못된 자리에 있는 것이다.
- 문서와 주석에 링크·다른 문서 참조·이력 서술을 쓰지 않는다.
- 동작은 테스트가 소유한다. 주석은 포트 계약, 와이어 타입의 의미, 외부 제약만 담는다.
- 300줄 초과 파일과 테스트 없는 유스케이스의 허용치는 0이다. 올리지 않는다.
- 루트의 작업 노트(`*.md`)는 의도적으로 추적하지 않는다. `git add -A`를 쓰지 않는다.

## 명령

| 목적 | 명령 |
|---|---|
| 인프라 기동 (PG×2·Redpanda·OpenSearch·Temporal) | `npm run infra:up` |
| 인프라 종료 | `npm run infra:down` |
| 전체 dev 서버 (인프라 선행 필수, agents 포함) | `npm run dev` |
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
