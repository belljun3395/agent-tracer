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
      severity: "warn",
      comment: "adapter-X must not depend on adapter-Y.",
      from: { path: "^packages/adapter-" },
      to:   { path: "^packages/adapter-" },
    },
    {
      name: "application-no-adapter",
      severity: "warn",
      comment: "application layer must not import adapters.",
      from: { path: "^packages/application/" },
      to:   { path: "^packages/adapter-" },
    },
    {
      name: "hook-plugin-wire-only",
      severity: "warn",
      comment: "hook-plugin may only depend on @monitor/domain (wire schemas).",
      from: { path: "^packages/hook-plugin/" },
      to:   { path: "^packages/(?!domain/)" },
    },
    {
      name: "web-isolated",
      severity: "warn",
      comment: "web-* must not import server, adapters, or application.",
      from: { path: "^packages/web-" },
      to:   { path: "^packages/(application|adapter-|server)/" },
    },
    {
      name: "no-subpath-imports",
      severity: "warn",
      comment: "Import packages via their public barrel only.",
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
