// 구조 규칙의 유일한 서술이다. 의존 그래프 검사기와 린터가 이것을 읽어 규칙을 계산하고,
// 경로 별칭이 여기서 생성된다. 같은 경계를 두 곳에 손으로 적지 않는다.

/** 슬라이스 안에서 각 계층이 import할 수 있는 계층. */
export const LAYERS = Object.freeze({
  inbound: ["application", "model"],
  application: ["port", "model"],
  port: ["model"],
  adapter: ["port", "model"],
  model: [],
});

/** 역할을 말하는 파일 접미사. 기술의 차이는 디렉터리가 아니라 여기가 말한다. */
export const ROLES = Object.freeze({
  entrypoint: [".controller.ts", ".consumer.ts", ".workflow.ts", ".activity.ts", ".hook.ts"],
  usecase: [".usecase.ts"],
  step: [".projection.ts"],
  port: [".port.ts"],
  adapter: [".adapter.ts"],
});

/**
 * 배포 단위. shape는 그 단위가 어떤 규칙 집합을 받는지 정한다.
 * sliced는 도메인 슬라이스와 다섯 계층, lib는 공개 표면을 가진 라이브러리,
 * kernel은 아무 배포 단위도 알지 않는 최내곽, fsd는 여섯 레이어, plugin은 수집기다.
 */
export const UNITS = Object.freeze([
  { name: "kernel", dir: "packages/kernel", alias: "~kernel", shape: "kernel", importable: true },
  { name: "platform", dir: "packages/server/libs/platform", alias: "~platform", shape: "lib", importable: true },
  { name: "tracer-domain", dir: "packages/server/libs/tracer-domain", alias: "~tracer-domain", shape: "lib", importable: true },
  { name: "runtime-api", dir: "packages/server/apps/runtime-api", alias: "~runtime-api", shape: "sliced", importable: false },
  { name: "tracer-api", dir: "packages/server/apps/tracer-api", alias: "~tracer-api", shape: "sliced", importable: false },
  { name: "projector", dir: "packages/server/apps/projector", alias: "~projector", shape: "sliced", importable: false },
  { name: "ai-agent-worker", dir: "packages/server/apps/ai-agent-worker", alias: "~ai-agent-worker", shape: "sliced", importable: false },
  { name: "runtime", dir: "packages/runtime", alias: "~runtime", shape: "plugin", importable: false },
  { name: "web", dir: "packages/web", alias: "~web", shape: "fsd", importable: false },
]);

/** 서로를 직접 import하지 못하는 우산. 넷은 kernel로만 연결된다. */
export const UMBRELLAS = Object.freeze(["server", "runtime", "web"]);

/** 대시보드의 레이어. 위가 아래를 부르고 같은 레이어끼리는 부르지 않는다. */
export const FSD = Object.freeze(["app", "pages", "widgets", "features", "entities", "shared"]);

/** 기술이 새지 않는 경계. allow는 경로 조각, denyLayers는 계층 이름이다. */
export const SEALS = Object.freeze([
  { pkg: "typeorm", allow: ["/adapter/", "/config/", "/migration/", "/libs/tracer-domain/"] },
  { pkg: "@temporalio/worker", allow: ["/config/"] },
  { pkg: "@nestjs", denyLayers: ["model", "port"] },
  { pkg: "zod", allowFileSuffix: ".schema.ts" },
]);

/** 넘기지 않는 선. 예산을 두고 백로그를 관리하지 않는다. */
export const BUDGETS = Object.freeze({
  maxFileLines: 300,
  oversizedFiles: 0,
  untestedUsecases: 0,
});

/** shape가 sliced인 배포 단위의 이름. */
export const SLICED = Object.freeze(UNITS.filter((unit) => unit.shape === "sliced").map((unit) => unit.name));

/** 별칭에서 소스 디렉터리로 가는 표. 린터와 경로 별칭 생성기가 함께 쓴다. */
export const ALIASES = Object.freeze(
  Object.fromEntries(UNITS.map((unit) => [unit.alias, `${unit.dir}/src`])),
);

/** 워크스페이스 패키지 이름에서 소스 디렉터리로 가는 표. */
export const PACKAGES = Object.freeze(
  Object.fromEntries(UNITS.map((unit) => [`@monitor/${unit.name}`, `${unit.dir}/src`])),
);
