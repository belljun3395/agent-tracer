import templateConfig from "./.evidence/template/svelte.config.js";
import adapter from "@sveltejs/adapter-static";

export default {
  ...templateConfig,
  kit: {
    ...templateConfig.kit,
    adapter: adapter({
      pages: ".evidence/template/build",
      strict: false,
    }),
    prerender: {
      ...templateConfig.kit.prerender,
      handleHttpError: "warn",
    },
    files: {
      routes: ".evidence/template/src/pages",
      lib: ".evidence/template/src/components",
      assets: ".evidence/template/static",
      appTemplate: ".evidence/template/src/app.html",
      hooks: {
        client: ".evidence/template/src/hooks.client.js",
        server: ".evidence/template/src/hooks.server.js",
      },
    },
  },
};
