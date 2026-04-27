// .dependency-cruiser.cjs
/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "server-domain-is-inner-ring",
      severity: "error",
      comment: "server domain must not import application, adapters, or main.",
      from: { path: "^packages/server/src/domain/" },
      to: { path: "^packages/server/src/(application|adapters|main)/" },
    },
    {
      name: "server-application-no-outer-rings",
      severity: "error",
      comment: "server application may depend on domain/application only, not adapters or main.",
      from: { path: "^packages/server/src/application/" },
      to: { path: "^packages/server/src/(adapters|main)/" },
    },
    {
      name: "server-adapters-no-main",
      severity: "error",
      comment: "server adapters must not import main; move shared HTTP/Nest helpers into adapters or application ports.",
      from: { path: "^packages/server/src/adapters/" },
      to: { path: "^packages/server/src/main/" },
    },
    {
      name: "server-no-web-or-runtime",
      severity: "error",
      comment: "server must not import web or runtime packages.",
      from: { path: "^packages/server/src/" },
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
      to: { path: "^packages/(server|web)/src/" },
    },
    {
      name: "web-types-no-io-or-state",
      severity: "error",
      comment: "web types/domain code must not import io or state.",
      from: { path: "^packages/web/src/types(?:/|\\.ts$)" },
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
      to: { path: "^packages/(server|runtime)/src/" },
    },
    {
      name: "no-package-src-or-dist-subpath-imports",
      severity: "error",
      comment: "Import packages through their public exports, not @monitor/*/src or @monitor/*/dist.",
      from: {},
      to: { path: "@monitor/[^/]+/(src|dist)/" },
    },

    // ── session feature module (server/src/session) layered rules ─────
    // Layer order (inner -> outer):
    //   domain -> repository -> service -> application(usecase) -> api(controller)
    //   adapter wraps service to implement public ports.
    //   public exposes contracts for other modules.
    //   application/outbound declares what the module needs from outside.
    {
      name: "session-domain-no-upward",
      severity: "error",
      comment: "session/domain is the innermost ring — no imports from any other session layer.",
      from: { path: "^packages/server/src/session/domain/" },
      to: { path: "^packages/server/src/session/(repository|service|application|adapter|api|subscriber|public)/" },
    },
    {
      name: "session-repository-only-domain",
      severity: "error",
      comment: "session/repository may only depend on session/domain.",
      from: { path: "^packages/server/src/session/repository/" },
      to: { path: "^packages/server/src/session/(service|application|adapter|api|subscriber)/" },
    },
    {
      name: "session-service-no-upper-layers",
      severity: "error",
      comment: "session/service may depend on domain, repository, public, application/outbound — never api/adapter/subscriber/usecase internals.",
      from: { path: "^packages/server/src/session/service/" },
      to: {
        path: "^packages/server/src/session/(application|adapter|api|subscriber)/",
        pathNot: "^packages/server/src/session/application/outbound/",
      },
    },
    {
      name: "session-usecase-no-direct-repository",
      severity: "error",
      comment: "session usecases must go through service — direct repository access bypasses domain policy.",
      from: { path: "^packages/server/src/session/application/" },
      to: { path: "^packages/server/src/session/repository/" },
    },
    {
      name: "session-usecase-no-upper-layers",
      severity: "error",
      comment: "session/application may not depend on adapter/api/subscriber.",
      from: { path: "^packages/server/src/session/application/" },
      to: { path: "^packages/server/src/session/(adapter|api|subscriber)/" },
    },
    {
      name: "session-api-only-application",
      severity: "error",
      comment: "session controllers must call usecases only — no direct service/repository/domain access.",
      from: { path: "^packages/server/src/session/api/" },
      to: { path: "^packages/server/src/session/(service|repository|domain|adapter|subscriber)/" },
    },
    {
      name: "session-adapter-no-application-internals",
      severity: "error",
      comment: "session adapters may import outbound port contracts (application/outbound) but must not reach into usecases/api/subscriber.",
      from: { path: "^packages/server/src/session/adapter/" },
      to: {
        path: "^packages/server/src/session/(application|api|subscriber)/",
        pathNot: "^packages/server/src/session/application/outbound/",
      },
    },
    {
      name: "session-public-only-domain-types",
      severity: "error",
      comment: "session/public exposes contracts; it must not import internals (service/repository/application/adapter/api).",
      from: { path: "^packages/server/src/session/public/" },
      to: { path: "^packages/server/src/session/(service|repository|application|adapter|api|subscriber)/" },
    },
    {
      name: "external-only-via-session-public",
      severity: "error",
      comment: "Code outside session must import session only through ~session/public/* (or via SessionModule wiring in main).",
      from: {
        path: "^packages/server/src/(?!session/)",
        pathNot:
          "^packages/server/src/main/presentation/(app\\.module|database/typeorm\\.database\\.module)\\.ts$",
      },
      to: { path: "^packages/server/src/session/(?!public/)" },
    },

    // ── task feature module (server/src/task) layered rules ─────
    {
      name: "task-domain-no-upward",
      severity: "error",
      comment: "task/domain은 가장 안쪽 — 다른 layer import 금지",
      from: { path: "^packages/server/src/task/domain/" },
      to: { path: "^packages/server/src/task/(repository|service|application|adapter|api|subscriber|public)/" },
    },
    {
      name: "task-repository-only-domain",
      severity: "error",
      from: { path: "^packages/server/src/task/repository/" },
      to: { path: "^packages/server/src/task/(service|application|adapter|api|subscriber)/" },
    },
    {
      name: "task-service-no-upper-layers",
      severity: "error",
      comment: "task/service may depend on domain, repository, public, application/outbound — never api/adapter/subscriber/usecase internals.",
      from: { path: "^packages/server/src/task/service/" },
      to: {
        path: "^packages/server/src/task/(application|adapter|api|subscriber)/",
        pathNot: "^packages/server/src/task/application/outbound/",
      },
    },
    {
      name: "task-usecase-no-direct-repository",
      severity: "error",
      comment: "usecase는 service를 거쳐 repository에 접근",
      from: { path: "^packages/server/src/task/application/" },
      to: { path: "^packages/server/src/task/repository/" },
    },
    {
      name: "task-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/src/task/application/" },
      to: { path: "^packages/server/src/task/(adapter|api|subscriber)/" },
    },
    {
      name: "task-api-only-application",
      severity: "error",
      comment: "controller는 usecase만 호출",
      from: { path: "^packages/server/src/task/api/" },
      to: { path: "^packages/server/src/task/(service|repository|domain|adapter|subscriber)/" },
    },
    {
      name: "task-adapter-no-application-internals",
      severity: "error",
      comment: "adapter는 outbound port contract(application/outbound)만 import 가능",
      from: { path: "^packages/server/src/task/adapter/" },
      to: {
        path: "^packages/server/src/task/(application|api|subscriber)/",
        pathNot: "^packages/server/src/task/application/outbound/",
      },
    },
    {
      name: "task-public-only-domain-types",
      severity: "error",
      from: { path: "^packages/server/src/task/public/" },
      to: { path: "^packages/server/src/task/(service|repository|application|adapter|api|subscriber)/" },
    },
    {
      name: "external-only-via-task-public",
      severity: "error",
      comment: "외부 모듈은 ~task/public 만 접근 가능",
      from: {
        path: "^packages/server/src/(?!task/)",
        pathNot:
          "^packages/server/src/main/presentation/(app\\.module|database/typeorm\\.database\\.module)\\.ts$",
      },
      to: { path: "^packages/server/src/task/(?!public/)" },
    },

    // ── event feature module (server/src/event) layered rules ─────
    {
      name: "event-domain-no-upward",
      severity: "error",
      comment: "event/domain은 가장 안쪽 — 다른 layer import 금지",
      from: { path: "^packages/server/src/event/domain/" },
      to: { path: "^packages/server/src/event/(repository|service|application|adapter|api|subscriber|public|common)/" },
    },
    {
      name: "event-repository-only-domain",
      severity: "error",
      from: { path: "^packages/server/src/event/repository/" },
      to: { path: "^packages/server/src/event/(service|application|adapter|api|subscriber)/" },
    },
    {
      name: "event-service-no-upper-layers",
      severity: "error",
      comment: "event/service may depend on domain, repository, public, application/outbound — never api/adapter/subscriber/usecase internals.",
      from: { path: "^packages/server/src/event/service/" },
      to: {
        path: "^packages/server/src/event/(application|adapter|api|subscriber)/",
        pathNot: "^packages/server/src/event/application/outbound/",
      },
    },
    {
      name: "event-usecase-no-direct-repository",
      severity: "error",
      comment: "usecase는 service를 거쳐 repository에 접근",
      from: { path: "^packages/server/src/event/application/" },
      to: { path: "^packages/server/src/event/repository/" },
    },
    {
      name: "event-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/src/event/application/" },
      to: { path: "^packages/server/src/event/(adapter|api|subscriber)/" },
    },
    {
      name: "event-api-only-application",
      severity: "error",
      comment: "controller는 usecase만 호출",
      from: { path: "^packages/server/src/event/api/" },
      to: { path: "^packages/server/src/event/(service|repository|domain|adapter|subscriber)/" },
    },
    {
      name: "event-adapter-no-application-internals",
      severity: "error",
      comment: "adapter는 outbound port contract(application/outbound)만 import 가능",
      from: { path: "^packages/server/src/event/adapter/" },
      to: {
        path: "^packages/server/src/event/(application|api|subscriber)/",
        pathNot: "^packages/server/src/event/application/outbound/",
      },
    },
    {
      name: "event-public-only-domain-types",
      severity: "error",
      from: { path: "^packages/server/src/event/public/" },
      to: { path: "^packages/server/src/event/(service|repository|application|adapter|api|subscriber)/" },
    },
    {
      name: "external-only-via-event-public",
      severity: "error",
      comment: "외부 모듈은 ~event/public 만 접근 가능",
      from: {
        path: "^packages/server/src/(?!event/)",
        pathNot:
          "^packages/server/src/main/presentation/(app\\.module|database/typeorm\\.database\\.module)\\.ts$",
      },
      to: { path: "^packages/server/src/event/(?!public/)" },
    },
    // ── rule feature module (server/src/rule) layered rules ─────
    {
      name: "rule-domain-no-upward",
      severity: "error",
      from: { path: "^packages/server/src/rule/domain/" },
      to: { path: "^packages/server/src/rule/(repository|service|application|adapter|api|subscriber|public|common)/" },
    },
    {
      name: "rule-repository-only-domain",
      severity: "error",
      from: { path: "^packages/server/src/rule/repository/" },
      to: { path: "^packages/server/src/rule/(service|application|adapter|api|subscriber)/" },
    },
    {
      name: "rule-service-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/src/rule/service/" },
      to: {
        path: "^packages/server/src/rule/(application|adapter|api|subscriber)/",
        pathNot: "^packages/server/src/rule/application/outbound/",
      },
    },
    {
      name: "rule-usecase-no-direct-repository",
      severity: "error",
      from: { path: "^packages/server/src/rule/application/" },
      to: { path: "^packages/server/src/rule/repository/" },
    },
    {
      name: "rule-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/src/rule/application/" },
      to: { path: "^packages/server/src/rule/(adapter|api|subscriber)/" },
    },
    {
      name: "rule-api-only-application",
      severity: "error",
      comment: "api는 application + domain (const/type) 만 — service/repository/adapter는 금지",
      from: { path: "^packages/server/src/rule/api/" },
      to: { path: "^packages/server/src/rule/(service|repository|adapter|subscriber)/" },
    },
    {
      name: "rule-adapter-no-application-internals",
      severity: "error",
      from: { path: "^packages/server/src/rule/adapter/" },
      to: {
        path: "^packages/server/src/rule/(application|api|subscriber)/",
        pathNot: "^packages/server/src/rule/application/outbound/",
      },
    },
    {
      name: "rule-public-only-domain-types",
      severity: "error",
      from: { path: "^packages/server/src/rule/public/" },
      to: { path: "^packages/server/src/rule/(service|repository|application|adapter|api|subscriber)/" },
    },
    {
      name: "external-only-via-rule-public",
      severity: "error",
      comment: "외부 모듈은 ~rule/public 만 접근 가능",
      from: {
        path: "^packages/server/src/(?!rule/)",
        pathNot:
          "^packages/server/src/main/presentation/(app\\.module|database/typeorm\\.database\\.module)\\.ts$",
      },
      to: { path: "^packages/server/src/rule/(?!public/)" },
    },
    // ── verification feature module rules ─────
    {
      name: "verification-domain-no-upward",
      severity: "error",
      from: { path: "^packages/server/src/verification/domain/" },
      to: { path: "^packages/server/src/verification/(repository|service|application|adapter|api|subscriber|public|common)/" },
    },
    {
      name: "verification-service-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/src/verification/service/" },
      to: {
        path: "^packages/server/src/verification/(application|adapter|api|subscriber)/",
        pathNot: "^packages/server/src/verification/application/outbound/",
      },
    },
    {
      name: "verification-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/src/verification/application/" },
      to: { path: "^packages/server/src/verification/(adapter|api|subscriber)/" },
    },
    {
      name: "verification-adapter-no-application-internals",
      severity: "error",
      from: { path: "^packages/server/src/verification/adapter/" },
      to: {
        path: "^packages/server/src/verification/(api|subscriber)/",
      },
    },
    {
      name: "verification-public-only-domain-types",
      severity: "error",
      from: { path: "^packages/server/src/verification/public/" },
      to: { path: "^packages/server/src/verification/(service|repository|application|adapter|api|subscriber)/" },
    },
    {
      name: "external-only-via-verification-public",
      severity: "error",
      comment: "외부 모듈은 ~verification/public 만 접근 가능",
      from: {
        path: "^packages/server/src/(?!verification/)",
        pathNot:
          "^packages/server/src/main/presentation/(app\\.module|database/typeorm\\.database\\.module)\\.ts$",
      },
      to: { path: "^packages/server/src/verification/(?!public/)" },
    },
    // ── turn-partition feature module rules ─────
    {
      name: "turn-partition-domain-no-upward",
      severity: "error",
      from: { path: "^packages/server/src/turn-partition/domain/" },
      to: { path: "^packages/server/src/turn-partition/(repository|service|application|adapter|api|subscriber|public|common)/" },
    },
    {
      name: "turn-partition-repository-only-domain",
      severity: "error",
      from: { path: "^packages/server/src/turn-partition/repository/" },
      to: { path: "^packages/server/src/turn-partition/(service|application|adapter|api|subscriber)/" },
    },
    {
      name: "turn-partition-usecase-no-upper-layers",
      severity: "error",
      from: { path: "^packages/server/src/turn-partition/application/" },
      to: { path: "^packages/server/src/turn-partition/(adapter|api|subscriber)/" },
    },
    {
      name: "turn-partition-api-only-application",
      severity: "error",
      comment: "api는 application + domain (const/type) 만 — service/repository/adapter 는 금지",
      from: { path: "^packages/server/src/turn-partition/api/" },
      to: { path: "^packages/server/src/turn-partition/(service|repository|adapter|subscriber)/" },
    },
    {
      name: "turn-partition-adapter-no-application-internals",
      severity: "error",
      from: { path: "^packages/server/src/turn-partition/adapter/" },
      to: {
        path: "^packages/server/src/turn-partition/(application|api|subscriber)/",
        pathNot: "^packages/server/src/turn-partition/application/outbound/",
      },
    },
    {
      name: "external-only-via-turn-partition-public",
      severity: "error",
      comment: "외부 모듈은 ~turn-partition 의 internal에 접근 불가 (public 없음 — leaf module)",
      from: {
        path: "^packages/server/src/(?!turn-partition/)",
        pathNot:
          "^packages/server/src/main/presentation/(app\\.module|database/typeorm\\.database\\.module)\\.ts$|^packages/server/src/adapters/persistence/sqlite/schema/sqlite\\.schema\\.ts$",
      },
      to: { path: "^packages/server/src/turn-partition/(?!public/)" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
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
