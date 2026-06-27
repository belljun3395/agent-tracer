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

    // ── Feature-module layered rules (inner -> outer ring) ────────────────
    // Layer order: domain -> repository -> service -> application(usecase) -> api(controller).
    // adapter wraps service to implement public ports; public exposes contracts;
    // application/outbound declares what the module needs from outside.
    // Cross-package access is governed by the DAG rules above; these guard each
    // feature's internal ring within its owning package. (Cross-package domain
    // models/consts/ports are shared directly by design, so there is no
    // feature-level "external-only-via-public" rule.)

    // ── event (timeline-api/src/event) ─────
    {
      name: "event-domain-no-upward",
      severity: "error",
      comment: "event/domain은 가장 안쪽 — 다른 layer import 금지",
      from: { path: "^packages/server/timeline-api/src/event/domain/" },
      to: { path: "^packages/server/timeline-api/src/event/(repository|service|application|adapter|api|subscriber|public|common)/" },
    },
    {
      name: "event-repository-only-domain",
      severity: "error",
      comment: "repository may also import application/outbound contract.",
      from: { path: "^packages/server/timeline-api/src/event/repository/" },
      to: {
        path: "^packages/server/timeline-api/src/event/(service|application|adapter|api|subscriber)/",
        pathNot: "^packages/server/timeline-api/src/event/application/outbound/",
      },
    },
    {
      name: "event-service-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/timeline-api/src/event/service/" },
      to: {
        path: "^packages/server/timeline-api/src/event/(application|adapter|api|subscriber)/",
        pathNot: "^packages/server/timeline-api/src/event/application/outbound/",
      },
    },
    {
      name: "event-usecase-no-direct-repository",
      severity: "error",
      from: { path: "^packages/server/timeline-api/src/event/application/" },
      to: { path: "^packages/server/timeline-api/src/event/repository/" },
    },
    {
      name: "event-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/timeline-api/src/event/application/" },
      to: { path: "^packages/server/timeline-api/src/event/(adapter|api|subscriber)/" },
    },
    {
      name: "event-api-only-application",
      severity: "error",
      comment: "controller는 usecase만 호출",
      from: { path: "^packages/server/timeline-api/src/event/api/" },
      to: { path: "^packages/server/timeline-api/src/event/(service|repository|domain|adapter|subscriber)/" },
    },
    {
      name: "event-adapter-no-application-internals",
      severity: "error",
      from: { path: "^packages/server/timeline-api/src/event/adapter/" },
      to: {
        path: "^packages/server/timeline-api/src/event/(application|api|subscriber)/",
        pathNot: "^packages/server/timeline-api/src/event/application/outbound/",
      },
    },
    {
      name: "event-public-only-domain-types",
      severity: "error",
      from: { path: "^packages/server/timeline-api/src/event/public/" },
      to: { path: "^packages/server/timeline-api/src/event/(service|repository|application|adapter|api|subscriber)/" },
    },

    // ── session (run-api/src/session) ─────
    {
      name: "session-domain-no-upward",
      severity: "error",
      from: { path: "^packages/server/run-api/src/session/domain/" },
      to: { path: "^packages/server/run-api/src/session/(repository|service|application|adapter|api|subscriber|public)/" },
    },
    {
      name: "session-repository-only-domain",
      severity: "error",
      from: { path: "^packages/server/run-api/src/session/repository/" },
      to: { path: "^packages/server/run-api/src/session/(service|application|adapter|api|subscriber)/" },
    },
    {
      name: "session-service-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/run-api/src/session/service/" },
      to: {
        path: "^packages/server/run-api/src/session/(application|adapter|api|subscriber)/",
        pathNot: "^packages/server/run-api/src/session/application/outbound/",
      },
    },
    {
      name: "session-usecase-no-direct-repository",
      severity: "error",
      from: { path: "^packages/server/run-api/src/session/application/" },
      to: { path: "^packages/server/run-api/src/session/repository/" },
    },
    {
      name: "session-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/run-api/src/session/application/" },
      to: { path: "^packages/server/run-api/src/session/(adapter|api|subscriber)/" },
    },
    {
      name: "session-api-only-application",
      severity: "error",
      from: { path: "^packages/server/run-api/src/session/api/" },
      to: { path: "^packages/server/run-api/src/session/(service|repository|domain|adapter|subscriber)/" },
    },
    {
      name: "session-adapter-no-application-internals",
      severity: "error",
      from: { path: "^packages/server/run-api/src/session/adapter/" },
      to: {
        path: "^packages/server/run-api/src/session/(application|api|subscriber)/",
        pathNot: "^packages/server/run-api/src/session/application/outbound/",
      },
    },
    {
      name: "session-public-only-domain-types",
      severity: "error",
      from: { path: "^packages/server/run-api/src/session/public/" },
      to: { path: "^packages/server/run-api/src/session/(service|repository|application|adapter|api|subscriber)/" },
    },

    // ── task (run-api/src/task) ─────
    {
      name: "task-domain-no-upward",
      severity: "error",
      comment: "task/domain은 가장 안쪽 — 다른 layer import 금지",
      from: { path: "^packages/server/run-api/src/task/domain/" },
      to: { path: "^packages/server/run-api/src/task/(repository|service|application|adapter|api|subscriber|public)/" },
    },
    {
      name: "task-repository-only-domain",
      severity: "error",
      from: { path: "^packages/server/run-api/src/task/repository/" },
      to: { path: "^packages/server/run-api/src/task/(service|application|adapter|api|subscriber)/" },
    },
    {
      name: "task-service-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/run-api/src/task/service/" },
      to: {
        path: "^packages/server/run-api/src/task/(application|adapter|api|subscriber)/",
        pathNot: "^packages/server/run-api/src/task/application/outbound/",
      },
    },
    {
      name: "task-usecase-no-direct-repository",
      severity: "error",
      comment: "usecase는 service를 거쳐 repository에 접근",
      from: { path: "^packages/server/run-api/src/task/application/" },
      to: { path: "^packages/server/run-api/src/task/repository/" },
    },
    {
      name: "task-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/run-api/src/task/application/" },
      to: { path: "^packages/server/run-api/src/task/(adapter|api|subscriber)/" },
    },
    {
      name: "task-api-only-application",
      severity: "error",
      comment: "controller는 usecase만 호출",
      from: { path: "^packages/server/run-api/src/task/api/" },
      to: { path: "^packages/server/run-api/src/task/(service|repository|domain|adapter|subscriber)/" },
    },
    {
      name: "task-adapter-no-application-internals",
      severity: "error",
      from: { path: "^packages/server/run-api/src/task/adapter/" },
      to: {
        path: "^packages/server/run-api/src/task/(application|api|subscriber)/",
        pathNot: "^packages/server/run-api/src/task/application/outbound/",
      },
    },
    {
      name: "task-public-only-domain-types",
      severity: "error",
      from: { path: "^packages/server/run-api/src/task/public/" },
      to: { path: "^packages/server/run-api/src/task/(service|repository|application|adapter|api|subscriber)/" },
    },

    // ── turn-partition (run-api/src/task/turn) ─────
    {
      name: "turn-partition-domain-no-upward",
      severity: "error",
      from: { path: "^packages/server/run-api/src/task/turn/domain/" },
      to: { path: "^packages/server/run-api/src/task/turn/(repository|service|application|adapter|api|subscriber|public|common)/" },
    },
    {
      name: "turn-partition-repository-only-domain",
      severity: "error",
      from: { path: "^packages/server/run-api/src/task/turn/repository/" },
      to: { path: "^packages/server/run-api/src/task/turn/(service|application|adapter|api|subscriber)/" },
    },
    {
      name: "turn-partition-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/run-api/src/task/turn/application/" },
      to: { path: "^packages/server/run-api/src/task/turn/(adapter|api|subscriber)/" },
    },
    {
      name: "turn-partition-api-only-application",
      severity: "error",
      comment: "api는 application + domain (const/type) 만 — service/repository/adapter 는 금지",
      from: { path: "^packages/server/run-api/src/task/turn/api/" },
      to: { path: "^packages/server/run-api/src/task/turn/(service|repository|adapter|subscriber)/" },
    },
    {
      name: "turn-partition-adapter-no-application-internals",
      severity: "error",
      from: { path: "^packages/server/run-api/src/task/turn/adapter/" },
      to: {
        path: "^packages/server/run-api/src/task/turn/(application|api|subscriber)/",
        pathNot: "^packages/server/run-api/src/task/turn/application/outbound/",
      },
    },

    // ── rule (rules-api/src/rule) ─────
    {
      name: "rule-domain-no-upward",
      severity: "error",
      from: { path: "^packages/server/rules-api/src/rule/domain/" },
      to: { path: "^packages/server/rules-api/src/rule/(repository|service|application|adapter|api|subscriber|public|common)/" },
    },
    {
      name: "rule-repository-only-domain",
      severity: "error",
      from: { path: "^packages/server/rules-api/src/rule/repository/" },
      to: { path: "^packages/server/rules-api/src/rule/(service|application|adapter|api|subscriber)/" },
    },
    {
      name: "rule-usecase-no-direct-repository",
      severity: "error",
      from: { path: "^packages/server/rules-api/src/rule/application/" },
      to: { path: "^packages/server/rules-api/src/rule/repository/" },
    },
    {
      name: "rule-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/rules-api/src/rule/application/" },
      to: { path: "^packages/server/rules-api/src/rule/(adapter|api|subscriber)/" },
    },
    {
      name: "rule-api-only-application",
      severity: "error",
      comment: "api는 application + domain (const/type) 만 — service/repository/adapter는 금지",
      from: { path: "^packages/server/rules-api/src/rule/api/" },
      to: { path: "^packages/server/rules-api/src/rule/(service|repository|adapter|subscriber)/" },
    },
    {
      name: "rule-adapter-no-application-internals",
      severity: "error",
      from: { path: "^packages/server/rules-api/src/rule/adapter/" },
      to: {
        path: "^packages/server/rules-api/src/rule/(application|api|subscriber)/",
        pathNot: "^packages/server/rules-api/src/rule/application/outbound/",
      },
    },
    {
      name: "rule-public-only-domain-types",
      severity: "error",
      from: { path: "^packages/server/rules-api/src/rule/public/" },
      to: { path: "^packages/server/rules-api/src/rule/(service|repository|application|adapter|api|subscriber)/" },
    },

    // ── verification (rules-api/src/verification) ─────
    {
      name: "verification-domain-no-upward",
      severity: "error",
      from: { path: "^packages/server/rules-api/src/verification/domain/" },
      to: { path: "^packages/server/rules-api/src/verification/(repository|service|application|adapter|api|subscriber|public|common)/" },
    },
    {
      name: "verification-service-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/rules-api/src/verification/service/" },
      to: {
        path: "^packages/server/rules-api/src/verification/(application|adapter|api|subscriber)/",
        pathNot: "^packages/server/rules-api/src/verification/application/outbound/",
      },
    },
    {
      name: "verification-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/rules-api/src/verification/application/" },
      to: { path: "^packages/server/rules-api/src/verification/(adapter|api|subscriber)/" },
    },
    {
      name: "verification-adapter-no-application-internals",
      severity: "error",
      from: { path: "^packages/server/rules-api/src/verification/adapter/" },
      to: { path: "^packages/server/rules-api/src/verification/(api|subscriber)/" },
    },
    {
      name: "verification-public-only-domain-types",
      severity: "error",
      from: { path: "^packages/server/rules-api/src/verification/public/" },
      to: { path: "^packages/server/rules-api/src/verification/(service|repository|application|adapter|api|subscriber)/" },
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
