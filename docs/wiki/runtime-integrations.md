# Runtime Integrations

Agent Tracer의 강점 중 하나는 특정 런타임 하나에 묶이지 않는다는 점이다.
이 확장성은 `@monitor/core`, 서버 API, MCP surface가 같은 방향을 보기에 가능하다.

## 핵심 파일

- `packages/core/src/domain.ts`
- `packages/core/src/classifier.ts`
- `packages/core/src/runtime-capabilities.ts`
- `packages/mcp/src/index.ts`
- `docs/guide/runtime-capabilities.md`
- `docs/guide/api-integration-map.md`

## 역할 분담

### Core

- 이벤트 종류
- 타임라인 레인
- 분류 결과
- runtime capability
- workflow evaluation 타입

즉, 시스템 전체가 공유해야 할 계약을 가진다.

### Server

- core 계약을 영속화하고 조회 API로 노출한다.

### MCP

- 서버 API를 agent-friendly tool surface로 포장한다.

### Guide 문서

- 런타임별 설정 절차와 엔드포인트 사용 방식을 설명한다.

## 좋은 점

- capability table이 실제 코드와 문서 양쪽에 존재해 런타임 추가 시 기준점이 있다.
- MCP 도구 이름과 서버 엔드포인트가 일관적이라 추적이 쉽다.
- "수동 MCP 경로"와 "자동 hook/plugin 경로"를 구분하는 관점이 분명하다.

## 유지보수 리스크

### 계약의 중심은 core인데, 일부 소비자는 다시 타입을 복제한다

이 문제는 런타임 확장이 늘수록 커진다.
core에서 새 이벤트 필드가 추가돼도 웹이 별도 타입을 쓰면 문서-서버-UI 동기화가 깨질 수 있다.

### phase semantics가 일부 이벤트에서 완전히 닫혀 있지 않다

- `question.logged`
- `user.message`

문서와 MCP 입력은 richer semantics를 설명하지만,
core 분류 모델과 실제 enforcement는 그 기대를 완전히 담고 있지 않다.
즉, "문서상 가능한 것"과 "모델상 보장되는 것" 사이에 틈이 있다.

권장 방향:

- discriminated union 기반 canonical event contracts
- schema refinement로 invariants 강제
- lane/phase semantics를 core에서 직접 표현

### MCP surface가 core를 직접 소비하는 방식이 약하다

현재 MCP는 잘 동작하지만, shared manifest 없이 큰 등록 파일을 수동 유지하는 구조다.
tool 수가 늘수록 drift 가능성이 커진다.

### MCP 등록 파일이 선언형 메타데이터 없이 커지고 있다

`packages/mcp/src/index.ts`는 안정적으로 동작하지만,
tool 수가 늘수록 다음 세 가지를 계속 수동 동기화해야 한다.

- tool name
- input schema
- target API path

중기적으로는 descriptor table 기반 등록이 더 적합하다.

### slug/path 처리의 국제화와 운영체제 호환성이 약하다

- slug는 비 ASCII 제목에서 빈 문자열이 될 수 있다.
- path normalization은 Windows 경로를 부분적으로만 흡수한다.

현재 대상 환경에서는 크게 티 나지 않아도,
외부 프로젝트 연결 범위를 넓히면 금방 표면화될 가능성이 있다.

### route/schema/MCP가 함께 늘어나는 구조다

새 이벤트를 하나 추가하면 보통 다음을 같이 바꿔야 한다.

- core 타입
- server application type
- server schema
- server route
- MCP tool registration
- guide docs

이 작업 흐름이 명시적으로 문서화되어 있지 않으면, 새 기여자가 한 부분만 수정하고 끝낼 가능성이 있다.

## 권장 개선

1. "새 이벤트 추가 체크리스트"를 위키에 고정 문서로 유지
2. MCP 등록을 descriptor 기반으로 리팩터링
3. core 계약에서 웹 타입을 직접 파생하도록 정리
4. capability registry와 guide 문서를 교차 링크
5. non-ASCII slug와 cross-platform path 관련 테스트 추가
6. canonical contract 위반 케이스를 schema/test에서 명시적으로 실패시키기

## 새 런타임을 추가할 때 확인할 것

1. raw user prompt를 캡처할 수 있는가
2. tool call을 관찰할 수 있는가
3. subagent/background를 추적할 수 있는가
4. session close 시 task를 자동 종료해야 하는가
5. skill discovery 경로는 어디인가

기존 `docs/guide/api-integration-map.md`와 `docs/guide/runtime-capabilities.md`는 이 판단의 좋은 출발점이다.
