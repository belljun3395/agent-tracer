// .dependency-cruiser.cjs
/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      severity: "error",
      comment: "packages/domain must not import any other @monitor/* package.",
      from: { path: "^packages/domain/" },
      to:   { path: "^packages/(?!domain/)" },
    },
    {
      name: "classification-depends-on-domain-only",
      severity: "error",
      comment: "@monitor/classification may only depend on @monitor/domain.",
      from: { path: "^packages/classification/" },
      to:   { path: "^packages/(?!(domain|classification)/)" },
    },
    {
      name: "no-cross-adapter",
      severity: "error",
      comment: "adapter-X must not depend on adapter-Y (intra-adapter imports are fine).",
      from: { path: "^packages/(adapter-[^/]+)/" },
      to:   { path: "^packages/adapter-", pathNot: "^packages/$1/" },
    },
    {
      name: "application-no-adapter",
      severity: "error",
      comment: "application layer must not import adapters. Promoted to error in Phase 9a.",
      from: { path: "^packages/application/" },
      to:   { path: "^packages/adapter-" },
    },
    {
      name: "application-inner-ring",
      severity: "error",
      comment: "@monitor/application may only depend on @monitor/domain and @monitor/classification.",
      from: { path: "^packages/application/" },
      to:   { path: "^packages/(?!(domain|classification|application)/)" },
    },
    {
      name: "hook-plugin-wire-only",
      severity: "error",
      comment: "hook-plugin may only depend on @monitor/domain (wire schemas). Intra-package imports (within packages/hook-plugin) are allowed.",
      from: { path: "^packages/hook-plugin/" },
      to:   { path: "^packages/(?!(domain|hook-plugin)/)" },
    },
    {
      name: "adapter-mcp-inner-ring",
      severity: "error",
      comment: "@monitor/adapter-mcp may only depend on @monitor/domain or @monitor/application. Intra-package imports are allowed.",
      from: { path: "^packages/adapter-mcp/" },
      to:   { path: "^packages/(?!(domain|application|adapter-mcp)/)" },
    },
    {
      name: "web-isolated",
      severity: "error",
      comment: "web-* must not import server, adapters, or application. Promoted to error in Phase 8c.",
      from: { path: "^packages/web-" },
      to:   { path: "^packages/(application|adapter-|server)/" },
    },
    {
      name: "no-subpath-imports",
      severity: "error",
      comment: "Import packages via their public barrel only. Promoted to error in Phase 9a.",
      from: {},
      to:   { path: "@monitor/[^/]+/(src|dist)/" },
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
      dot:  { theme: { graph: { rankdir: "LR" } } },
    },
  },
};
