import { FSD, LAYERS, SEALS, SLICED, UMBRELLAS } from "./architecture.manifest.mjs";

// 규칙은 파일 이름을 모른다. 디렉터리 역할과 파일 접미사만이 피연산자다.
// 슬라이스를 추가해도 규칙 수는 늘지 않는다. 정규식 역참조가 이름을 대신 센다.

const SLICE = `^packages/server/apps/(?:${SLICED.join("|")})/src/domain`;
const WEB = "^packages/web/src";
const SLICED_LAYERS = Object.keys(LAYERS);

// 슬라이스 안의 계층 방향. LAYERS의 항목 하나가 규칙 하나가 된다.
const layerRules = Object.entries(LAYERS).map(([layer, allowed]) => {
  const forbidden = SLICED_LAYERS.filter((name) => name !== layer && !allowed.includes(name));
  return {
    name: `layer-${layer}`,
    comment: `${layer}는 ${allowed.join("과 ") || "다른 계층"}만 부른다`,
    severity: "error",
    from: { path: `${SLICE}/[^/]+/${layer}/` },
    to: { path: `${SLICE}/[^/]+/(?:${forbidden.join("|")})/` },
  };
});

// 대시보드의 레이어 방향. 아래를 부르고 위를 부르지 않는다.
const webLayerRules = FSD
  .map((layer, index) => ({ layer, above: FSD.slice(0, index) }))
  .filter(({ above }) => above.length > 0)
  .map(({ layer, above }) => ({
    name: `web-layer-${layer}`,
    comment: `${layer}는 자기보다 위 레이어를 부르지 않는다`,
    severity: "error",
    from: { path: `${WEB}/${layer}/` },
    to: { path: `${WEB}/(?:${above.join("|")})/` },
  }));

// 기술 봉인. SEALS의 항목 하나가 규칙 하나가 된다.
const sealRules = SEALS.map((seal) => {
  const to = { path: `node_modules/${seal.pkg}` };
  if (seal.allowFileSuffix) {
    return {
      name: `seal-${seal.pkg}`,
      comment: `${seal.pkg}는 ${seal.allowFileSuffix} 안에만 있는다`,
      severity: "error",
      from: { path: "^packages/", pathNot: `\\${seal.allowFileSuffix}$` },
      to,
    };
  }
  if (seal.allow) {
    return {
      name: `seal-${seal.pkg}`,
      comment: `${seal.pkg}는 ${seal.allow.join(", ")} 밖으로 새지 않는다`,
      severity: "error",
      from: { path: "^packages/", pathNot: seal.allow.join("|") },
      to,
    };
  }
  return {
    name: `seal-${seal.pkg}`,
    comment: `${seal.pkg}는 ${seal.denyLayers.join("과 ")}에 없다`,
    severity: "error",
    from: { path: `/src/domain/[^/]+/(?:${seal.denyLayers.join("|")})/` },
    to,
  };
});

export default {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-unresolvable",
      comment: "해석할 수 없는 import는 통과한 것이 아니라 검사되지 않은 것이다",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },

    ...layerRules,

    {
      name: "slice-independent",
      comment: "슬라이스는 형제 슬라이스를 부르지 않는다",
      severity: "error",
      from: { path: `${SLICE}/([^/]+)/` },
      to: { path: `${SLICE}/[^/]+/`, pathNot: `${SLICE}/$1/` },
    },
    {
      name: "domain-not-to-config",
      comment: "도메인은 앱 전역 배선을 모른다. 어댑터만 config를 안다",
      severity: "error",
      from: { path: "^packages/(?:runtime|server/apps/[^/]+)/src/domain/[^/]+/(?!adapter/)" },
      to: { path: "^packages/(?:runtime|server/apps/[^/]+)/src/config/" },
    },
    {
      name: "support-knows-nothing",
      comment: "support는 순수 유틸이다. config와 도메인을 모른다",
      severity: "error",
      from: { path: "/src/support/" },
      to: { path: "/src/(?:config|domain)/" },
    },

    {
      name: "usecase-not-to-usecase",
      comment: "유스케이스는 다른 유스케이스를 부르지 않는다",
      severity: "error",
      from: { path: "\\.usecase\\.ts$" },
      to: { path: "\\.usecase\\.ts$" },
    },
    {
      name: "query-not-to-command",
      comment: "조회 진입점은 명령 유스케이스를 부르지 않는다",
      severity: "error",
      from: { path: "\\.query\\.controller\\.ts$" },
      to: { path: "\\.command\\.usecase\\.ts$" },
    },
    {
      name: "workflow-is-deterministic",
      comment: "워크플로는 활동 구현과 어댑터와 배선과 Node API를 모른다",
      severity: "error",
      from: { path: "\\.workflow\\.ts$" },
      to: { path: "\\.activity\\.ts$|/(?:adapter|config)/|^node:" },
    },
    {
      name: "inbound-not-to-projection",
      comment: "투영 단계는 진입점이 아니라 유스케이스가 밟는 단계다",
      severity: "error",
      from: { path: `${SLICE}/[^/]+/inbound/` },
      to: { path: "\\.projection\\.ts$" },
    },

    ...sealRules,

    {
      name: "umbrella-isolated",
      comment: "server와 runtime과 web은 서로를 직접 import하지 않는다. kernel만 공유한다",
      severity: "error",
      from: { path: `^packages/(${UMBRELLAS.join("|")})/` },
      to: { path: `^packages/(?:${UMBRELLAS.join("|")})/`, pathNot: "^packages/$1/" },
    },
    {
      name: "kernel-knows-nobody",
      comment: "kernel은 어느 배포 단위도 알지 않는다",
      severity: "error",
      from: { path: "^packages/kernel/" },
      to: { path: "^packages/(?!kernel/)" },
    },
    {
      name: "bundle-carries-no-schema-value",
      comment: "훅 번들과 웹 번들은 자립한다. 커널의 스키마는 타입으로만 쓴다",
      severity: "error",
      from: { path: "^packages/(?:runtime|web)/src/" },
      to: {
        path: "^packages/kernel/src/.*\\.schema\\.ts$",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "runtime-domain-not-to-agent",
      comment: "수집기 도메인은 런타임 어댑터와 데몬을 모른다",
      severity: "error",
      from: { path: "^packages/runtime/src/domain/" },
      to: { path: "^packages/runtime/src/(?:agent|daemon)/" },
    },

    ...webLayerRules,

    {
      name: "web-slice-independent",
      comment: "같은 레이어의 슬라이스는 서로를 부르지 않는다",
      severity: "error",
      from: { path: `${WEB}/(${FSD.join("|")})/([^/]+)/` },
      to: { path: `${WEB}/$1/[^/]+/`, pathNot: `${WEB}/$1/$2/` },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    exclude: { path: "\\.test\\.tsx?$|/__fakes__/|/dist/|/build/" },
  },
};
