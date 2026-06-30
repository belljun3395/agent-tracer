// .dependency-cruiser.cjs
/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    // ── Cross-context DAG (rules/insight → work → timeline(activity)) ──────
    {
      name: "no-circular",
      severity: "error",
      comment: "No circular dependencies — the context split is a DAG.",
      from: {},
      to: { circular: true },
    },
    {
      name: "timeline-is-leaf",
      severity: "error",
      comment:
        "timeline (timeline-api) is the foundation leaf — must not import work/rules/insight. Cross-context reactions go through the event.recorded subscription (work/rules depend on timeline, never the reverse).",
      from: { path: "^packages/server/timeline-api/src/" },
      to: { path: "^packages/server/(run-api|rules-api|insight-api)/src/" },
    },
    {
      name: "run-below-rules-insight",
      severity: "error",
      comment:
        "run sits below rules/insight in the DAG — it must not import them. Turn-query data that task needs is provided by rules via a task-owned token (TURN_QUERY_REPOSITORY_TOKEN lives in run-api/task/public).",
      from: { path: "^packages/server/run-api/src/" },
      to: { path: "^packages/server/(rules-api|insight-api)/src/" },
    },
    {
      name: "rules-no-insight",
      severity: "error",
      comment: "rules and insight are sibling top contexts — neither imports the other.",
      from: { path: "^packages/server/rules-api/src/" },
      to: { path: "^packages/server/insight-api/src/" },
    },
    {
      name: "insight-no-rules",
      severity: "error",
      comment: "rules and insight are sibling top contexts — neither imports the other.",
      from: { path: "^packages/server/insight-api/src/" },
      to: { path: "^packages/server/rules-api/src/" },
    },
    {
      name: "rules-no-run",
      severity: "error",
      comment:
        "rules and run are independent siblings (both depend only on timeline). Turn data lives in rules; run exposes its own /tasks/:id without turns.",
      from: { path: "^packages/server/rules-api/src/" },
      to: { path: "^packages/server/run-api/src/" },
    },

    // ── Package umbrella boundaries (server / runtime / web) ──────────────
    {
      name: "server-adapters-no-main",
      severity: "error",
      comment: "api-gateway adapters must not import main; move shared HTTP/Nest helpers into adapters or application ports.",
      from: { path: "^packages/server/api-gateway/src/adapters/" },
      to: { path: "^packages/server/api-gateway/src/main/" },
    },
    {
      name: "server-no-web-or-runtime",
      severity: "error",
      comment: "server packages must not import web or runtime packages.",
      from: { path: "^packages/server/" },
      to: { path: "^packages/(web|runtime)/src/" },
    },
    {
      name: "runtime-shared-is-inner-ring",
      severity: "error",
      comment: "runtime shared must not import claude-code or codex.",
      from: { path: "^packages/runtime/src/shared/" },
      to: { path: "^packages/runtime/src/(claude-code|codex)/" },
    },
    {
      name: "runtime-no-cross-adapter-imports",
      severity: "error",
      comment: "runtime claude-code and codex adapters must communicate only through shared code.",
      from: { path: "^packages/runtime/src/(claude-code|codex)/" },
      to: {
        path: "^packages/runtime/src/(claude-code|codex)/",
        pathNot: "^packages/runtime/src/$1/",
      },
    },
    {
      name: "runtime-no-server-or-web",
      severity: "error",
      comment: "runtime must not import server or web packages.",
      from: { path: "^packages/runtime/src/" },
      to: { path: "^packages/server/|^packages/web/src/" },
    },
    {
      name: "web-domain-no-io-or-state",
      severity: "error",
      comment: "web domain code must not import io or state.",
      from: { path: "^packages/web/src/domain(?:/|\\.ts$)" },
      to: { path: "^packages/web/src/(io|state)/" },
    },
    {
      name: "web-io-no-state-or-app",
      severity: "error",
      comment: "web io may depend on types/domain only, not state or app.",
      from: { path: "^packages/web/src/io(?:/|\\.ts$)" },
      to: { path: "^packages/web/src/(state|app)/" },
    },
    {
      name: "web-state-no-app",
      severity: "error",
      comment: "web state must not import app.",
      from: { path: "^packages/web/src/state(?:/|\\.ts$)" },
      to: { path: "^packages/web/src/app/" },
    },
    {
      name: "web-no-server-or-runtime",
      severity: "error",
      comment: "web must not import server or runtime packages.",
      from: { path: "^packages/web/src/" },
      to: { path: "^packages/server/|^packages/runtime/src/" },
    },
    {
      name: "no-package-src-or-dist-subpath-imports",
      severity: "error",
      comment: "Import packages through their public exports, not @monitor/*/src or @monitor/*/dist.",
      from: {},
      to: { path: "@monitor/[^/]+/(src|dist)/" },
    },

    // ── Layer-first ring (timeline-api / run-api / rules-api / insight-api) ──────
    // Inner→outer: domain → repository → service → application(usecase) → api(controller).
    // adapter implements outbound ports + public iservices; public exposes contracts;
    // application/<domain>/outbound declares what the module needs from outside.
    // $1 backreferences the owning package so each rule guards one package's ring.
    // (identity-api keeps its own domain-first rules below; cross-package access is
    //  governed by the DAG rules above. Domain models/consts/ports are shared across
    //  packages directly by design.)
    {
      name: "layer-domain-no-upward",
      severity: "error",
      comment: "domain은 가장 안쪽 — 바깥 레이어 import 금지",
      from: { path: "^packages/server/(timeline-api|run-api|rules-api|insight-api)/src/domain/" },
      to: { path: "^packages/server/$1/src/(repository|service|application|adapter|api|subscriber|scheduling|common|public)/" },
    },
    {
      name: "layer-repository-only-domain",
      severity: "error",
      comment: "repository는 domain + application/<domain>/outbound 계약만",
      from: { path: "^packages/server/(timeline-api|run-api|rules-api|insight-api)/src/repository/" },
      to: {
        path: "^packages/server/$1/src/(service|application|adapter|api|subscriber|scheduling)/",
        pathNot: "^packages/server/$1/src/application/[^/]+/outbound/",
      },
    },
    {
      name: "layer-service-no-upper",
      severity: "error",
      from: { path: "^packages/server/(timeline-api|run-api|rules-api|insight-api)/src/service/" },
      to: {
        path: "^packages/server/$1/src/(application|adapter|api|subscriber|scheduling)/",
        pathNot: "^packages/server/$1/src/application/[^/]+/outbound/",
      },
    },
    {
      name: "layer-usecase-no-upper",
      severity: "error",
      from: { path: "^packages/server/(timeline-api|run-api|rules-api|insight-api)/src/application/" },
      to: { path: "^packages/server/$1/src/(adapter|api|subscriber|scheduling)/" },
    },
    {
      name: "layer-api-only-application",
      severity: "error",
      comment: "controller는 application + domain(const/type)만 — service/repository/adapter 금지",
      from: { path: "^packages/server/(timeline-api|run-api|rules-api|insight-api)/src/api/" },
      to: { path: "^packages/server/$1/src/(service|repository|adapter|subscriber|scheduling)/" },
    },
    {
      name: "layer-adapter-no-app-internals",
      severity: "error",
      from: { path: "^packages/server/(timeline-api|run-api|rules-api|insight-api)/src/adapter/" },
      to: {
        path: "^packages/server/$1/src/(application|api|subscriber|scheduling)/",
        pathNot: "^packages/server/$1/src/application/[^/]+/outbound/",
      },
    },
    {
      name: "layer-public-only-contracts",
      severity: "error",
      comment: "public은 도메인 타입/계약만 — 구현 레이어 import 금지",
      from: { path: "^packages/server/(timeline-api|run-api|rules-api|insight-api)/src/public/" },
      to: { path: "^packages/server/$1/src/(repository|service|application|adapter|api|subscriber|scheduling)/" },
    },

    // ── settings (identity-api/src/settings) — usecase는 service만 경유(full ring) ─────
    {
      name: "settings-domain-no-upward",
      severity: "error",
      from: { path: "^packages/server/identity-api/src/settings/domain/" },
      to: { path: "^packages/server/identity-api/src/settings/(repository|service|application|api|public)/" },
    },
    {
      name: "settings-repository-only-domain",
      severity: "error",
      from: { path: "^packages/server/identity-api/src/settings/repository/" },
      to: { path: "^packages/server/identity-api/src/settings/(service|application|api)/" },
    },
    {
      name: "settings-service-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/identity-api/src/settings/service/" },
      to: { path: "^packages/server/identity-api/src/settings/(application|api)/" },
    },
    {
      name: "settings-usecase-no-direct-repository",
      severity: "error",
      from: { path: "^packages/server/identity-api/src/settings/application/" },
      to: { path: "^packages/server/identity-api/src/settings/repository/" },
    },
    {
      name: "settings-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/identity-api/src/settings/application/" },
      to: { path: "^packages/server/identity-api/src/settings/api/" },
    },
    {
      name: "settings-api-only-application",
      severity: "error",
      from: { path: "^packages/server/identity-api/src/settings/api/" },
      to: { path: "^packages/server/identity-api/src/settings/(service|repository)/" },
    },
    {
      name: "settings-public-only-domain-types",
      severity: "error",
      from: { path: "^packages/server/identity-api/src/settings/public/" },
      to: { path: "^packages/server/identity-api/src/settings/(service|repository|application|api)/" },
    },

    // ── user (identity-api/src/user) — service layer 없음(usecase가 repository 직접 호출) ─────
    {
      name: "user-domain-no-upward",
      severity: "error",
      from: { path: "^packages/server/identity-api/src/user/domain/" },
      to: { path: "^packages/server/identity-api/src/user/(repository|application|api)/" },
    },
    {
      name: "user-repository-only-domain",
      severity: "error",
      from: { path: "^packages/server/identity-api/src/user/repository/" },
      to: { path: "^packages/server/identity-api/src/user/(application|api)/" },
    },
    {
      name: "user-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/identity-api/src/user/application/" },
      to: { path: "^packages/server/identity-api/src/user/api/" },
    },
    {
      name: "user-api-only-application",
      severity: "error",
      from: { path: "^packages/server/identity-api/src/user/api/" },
      to: { path: "^packages/server/identity-api/src/user/repository/" },
    },
  ],
  options: {
    // 빌드 산출물(Vite 번들 등)은 소스 아키텍처가 아니므로 검사에서 제외한다.
    doNotFollow: { path: "node_modules|dist|build|coverage" },
    exclude: { path: "(^|/)(dist|build|coverage)/" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "development"],
    },
    reporterOptions: {
      dot: { theme: { graph: { rankdir: "LR" } } },
    },
  },
};
