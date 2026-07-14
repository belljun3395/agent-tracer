# packages/server/libs/platform

네 앱이 함께 쓰는 기술 기반이다. 도메인 어휘를 모른다.

## 폴더

- `config/`: 설정 로딩과 병합, 비밀값 암호화, 콜드 티어 설정, 에이전트 그래프
  접속 설정.
- `db/`: 데이터베이스 연결 팩토리.
- `kafka/`: 브로커 클라이언트 팩토리.
- `opensearch/`: 검색 클라이언트 팩토리.
- `temporal/`: Temporal 클라이언트 팩토리.
- `auth/`: 인증 토큰, 쿠키, 요청 제한.
- `primitives/`: 시계, ULID, 데드라인, 도메인 오류 베이스.

## 이 패키지만의 제약

- 도메인 어휘가 들어오면 이 패키지가 아니라 해당 앱의 `domain/`이 소유해야 한다.
  이 라이브러리는 기술 팩토리와 원시 타입만 만든다.
- 시계와 난수까지 포트 뒤에 두는 규칙의 기준 구현이 `primitives/clock.ts` 등에 있다.
  각 앱의 슬라이스는 이 구현을 자기 포트에 바인딩만 하고, 위임만 하는 어댑터를
  새로 쓰지 않는다.
- 설정 스키마를 바꾸면 `config/application.config.schema.ts`와
  루트 `application.yaml`을 함께 갱신한다.

## 검증

```bash
npx vitest run packages/server/libs/platform && npm run lint:deps
```

전체 게이트는 `npm run lint && npm run test && npm run lint:deps`다.
