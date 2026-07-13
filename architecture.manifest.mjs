// 구조 규칙의 유일한 서술이며 의존 그래프 검사기와 린터와 경로 별칭 생성기가 모두 이것을 읽는다.

/** 슬라이스 안에서 각 계층이 import할 수 있는 계층. */
export const LAYERS = Object.freeze({
  inbound: ["application", "model"],
  application: ["port", "model"],
  port: ["model"],
  adapter: ["port", "model"],
  model: [],
});

/** 기술의 차이를 디렉터리 대신 말하는 파일 접미사. */
export const ROLES = Object.freeze({
  entrypoint: [".controller.ts", ".consumer.ts", ".workflow.ts", ".activity.ts", ".hook.ts"],
  usecase: [".usecase.ts"],
  step: [".projection.ts"],
  port: [".port.ts"],
  adapter: [".adapter.ts"],
});

/** 배포 단위이며 shape가 그 단위에 적용할 규칙 집합을 고른다. */
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

/** 서로를 직접 import하지 못하고 kernel로만 연결되는 우산. */
export const UMBRELLAS = Object.freeze(["server", "runtime", "web"]);

/** 위가 아래만 부르는 대시보드의 레이어. */
export const FSD = Object.freeze(["app", "pages", "widgets", "features", "entities", "shared"]);

/** 기술이 새지 않는 경계이며 allow는 경로 조각을, denyLayers는 계층 이름을 받는다. */
export const SEALS = Object.freeze([
  { pkg: "typeorm", denyLayers: ["inbound", "application", "port", "model"] },
  { pkg: "@nestjs", denyLayers: ["model", "port"] },
  { pkg: "@temporalio/worker", allow: ["/config/"] },
  { pkg: "zod", allowFileSuffix: ".schema.ts" },
]);

/** 예산 없이 지키는 상한. */
export const BUDGETS = Object.freeze({
  maxFileLines: 300,
  oversizedFiles: 0,
  untestedUsecases: 0,
});

/** shape가 sliced인 배포 단위의 이름. */
export const SLICED = Object.freeze(UNITS.filter((unit) => unit.shape === "sliced").map((unit) => unit.name));

/** 린터와 경로 별칭 생성기가 함께 쓰는 별칭 표. */
export const ALIASES = Object.freeze(
  Object.fromEntries(UNITS.map((unit) => [unit.alias, `${unit.dir}/src`])),
);

/** 워크스페이스 패키지 이름에서 소스 디렉터리로 가는 표. */
export const PACKAGES = Object.freeze(
  Object.fromEntries(UNITS.map((unit) => [`@monitor/${unit.name}`, `${unit.dir}/src`])),
);
