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
