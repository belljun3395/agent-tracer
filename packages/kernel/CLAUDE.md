# packages/kernel

네 배포 단위(server·runtime·web·agents는 HTTP 경계 밖)가 공유하는 최내곽 패키지다.
프레임워크에 의존하지 않는다.

## 주제 폴더

계층이 아니라 어휘 주제로 나뉜다. 각 폴더는 DTO·상수·순수 판정 함수를 함께 담는다.

- `ingest/`: 이벤트 종류·계약 버전·수집 스키마. 골든 픽스처 테스트가 여기 산다.
- `rule/definition` `rule/evaluation` `rule/proposal`: 규칙 정의·판정·제안 계약.
- `recipe/` `task/` `timeline/`: 레시피·태스크·타임라인 계약.
- `job/` `agent/` `notification/` `settings/` `session/` `user/`: 잡·에이전트·알림·설정·세션·사용자 계약.
- `api/` `kafka/` `daemon/` `cleanup/` `observability/`: 경계 넘는 요청·브로커 토픽·소켓 계약·정리 정책·관측 어휘.

## 이 패키지만의 제약

- `zod`는 파일명이 `*.schema.ts`인 모듈에만 존재한다. 그 외 파일은 zod를 쓰지 않는다.
- runtime과 web은 `*.schema.ts`를 값으로 import하지 못한다. 훅 번들과 웹 번들이 자립해야
  하므로 타입으로만 참조한다. 스키마가 검증한 값의 타입을 재사용하고 싶으면 `z.infer`
  결과를 별도 `*.dto.ts`나 `*.model.ts`가 타입으로만 내보낸다.
- 여러 배포 단위가 같은 판정을 내려야 하는 순수 규칙(규칙 매칭, 레시피 매칭)이 여기 있다.
  로컬 플러그인이 오프라인에서 서버와 같은 판정을 내야 하므로 공유가 필연이다.
- 배포 단위를 가로질러 바이트 단위로 같아야 하는 골든 출력(수집 이벤트 조형 등)의
  고정 픽스처는 그 값을 검증하는 스키마 옆의 `__fixtures__/`에 둔다.
- `index.ts`가 유일한 배럴이다. 하위 폴더에 배럴을 추가로 두지 않는다.

## 검증

```bash
npx vitest run packages/kernel && npm run lint:deps
```

전체 게이트는 `npm run lint && npm run test && npm run lint:deps`다.
