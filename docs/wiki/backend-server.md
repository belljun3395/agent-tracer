# Backend Server

`packages/server` 는 Agent Tracer 의 저장과 조회를 책임지는 중심 패키지다.

## 구조

```text
bootstrap/
  create-nestjs-monitor-runtime.ts # 현재 서버 조합 루트
  runtime.types.ts                 # runtime public types
  ../index.ts                      # 프로세스 진입점
application/
  monitor-service.ts               # 핵심 유스케이스 진입점
  services/                        # 보조 정책/메타데이터 처리
  ports/                           # 저장소/알림 인터페이스
presentation/
  nestjs/controllers/              # HTTP 표면
  ws/                              # WebSocket broadcaster
infrastructure/sqlite/
  *.repository.ts                  # SQLite 구현체
```

## 주요 흐름

### 1. 조합

- `index.ts` 가 `bootstrap/create-nestjs-monitor-runtime.ts` 를 호출한다.
- `create-nestjs-monitor-runtime.ts` 는 NestJS 앱, SQLite ports, `MonitorServiceProvider`, WebSocket 서버를 조합한다.

### 2. HTTP

- 현재 HTTP 표면은 `presentation/nestjs/controllers` 다.
- `presentation/schemas.ts` 의 Zod 스키마로 입력 검증을 먼저 하고 `MonitorService` 로 위임한다.

### 3. 애플리케이션 서비스

- `MonitorService` 가 태스크 시작/종료, 런타임 세션, 이벤트 기록, 검색, 북마크, 평가까지 처리한다.
- 진입은 쉽지만 책임이 넓으므로 유지보수 시 분해 포인트를 계속 봐야 한다.

### 4. 영속성

- 실제 사용 경로는 `infrastructure/sqlite/*.repository.ts` + `infrastructure/sqlite/index.ts` 다.
- 저장소 인터페이스가 있어 테스트하기 좋은 편이다.

## 유지보수 리스크

### `MonitorService` 책임 집중

lifecycle, runtime-session binding, generic event logging, bookmark CRUD,
search, evaluation / workflow library 가 한 서비스에 모여 있다.

### 스키마와 DTO 병행 진화

- `presentation/schemas.ts`
- `application/types.ts`

필드가 많아질수록 Zod schema 와 TS interface 가 같이 수정돼야 한다.

### 읽기 경로 비용

- task list 조회 시 display title 을 만들기 위해 이벤트 이력을 다시 읽는 경로가 있다.
- 규모가 커지면 write-model 과 read-model 분리를 더 강하게 고려해야 한다.

## 서버 문서를 읽을 때 함께 보면 좋은 파일

- `packages/server/src/bootstrap/create-nestjs-monitor-runtime.ts`
- `packages/server/src/presentation/nestjs/controllers/`
- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/application/services/session-lifecycle-policy.ts`
- `packages/server/src/application/services/trace-metadata-factory.ts`
- `packages/server/src/infrastructure/sqlite/index.ts`

## 우선 개선 제안

1. `MonitorService` 를 유스케이스 단위 서비스로 분리
2. async dedupe map 에 정리 정책 추가
3. schema/DTO 선언 중복 축소
4. endpoint 등록 반복을 선언형 메타데이터로 축소
