import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolveViteMonitorConfig } from "./src/shared/config/vite-monitor-config.js";

const PACKAGE_ROOT = fileURLToPath(new URL(".", import.meta.url));

// exports 필드만 있고 main이 없는 패키지라 리터럴 스펙 대신 조립한 문자열로 런타임에만 불러온다.
const TAILWIND_VITE_PLUGIN_SPECIFIER = ["@tailwindcss", "vite"].join("/");

interface TailwindVitePluginModule {
  readonly default: () => PluginOption;
}

// packages/runtime의 ~/.agent-tracer/resume.token(0600)과 같은 경로 규약을 읽는다.
function readLocalResumeToken(): string {
  try {
    return readFileSync(join(homedir(), ".agent-tracer", "resume.token"), "utf8").trim();
  } catch {
    return "";
  }
}

export default defineConfig(async ({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  const {
    monitorHttpBaseUrl,
    monitorWsBaseUrl,
    webApiBaseUrl,
    webWsBaseUrl,
    resumeHelperBaseUrl,
  } = resolveViteMonitorConfig(env);
  const isVitest = process.env["VITEST"] === "true" || mode === "test";
  const plugins: PluginOption[] = [react(), tsconfigPaths({ root: "../.." })];
  if (!isVitest) {
    const { default: tailwindcss } = (await import(
      TAILWIND_VITE_PLUGIN_SPECIFIER
    )) as TailwindVitePluginModule;
    plugins.push(tailwindcss());
  }
  return {
    plugins,
    define: {
      "import.meta.env.VITE_MONITOR_BASE_URL": JSON.stringify(webApiBaseUrl),
      "import.meta.env.VITE_MONITOR_WS_BASE_URL": JSON.stringify(webWsBaseUrl),
      "import.meta.env.VITE_MONITOR_DEV_BASE_URL": JSON.stringify(monitorHttpBaseUrl),
      "import.meta.env.VITE_MONITOR_DEV_WS_BASE_URL": JSON.stringify(monitorWsBaseUrl),
      "import.meta.env.VITE_AGENT_TRACER_RESUME_BASE_URL": JSON.stringify(resumeHelperBaseUrl),
      "import.meta.env.VITE_AGENT_TRACER_RESUME_TOKEN": JSON.stringify(readLocalResumeToken()),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) {
              return undefined;
            }
            if (
              id.includes("/react/") ||
              id.includes("/react-dom") ||
              id.includes("/react-router") ||
              id.includes("/scheduler") ||
              id.includes("@radix-ui/") ||
              id.includes("@tanstack/react-query")
            ) {
              return "react-vendor";
            }
            if (id.includes("zustand")) {
              return "state-vendor";
            }
            return "vendor";
          },
        },
      },
    },
    server: {
      proxy: {
        "/api": monitorHttpBaseUrl,
        "/health": monitorHttpBaseUrl,
        "/ws": {
          target: monitorWsBaseUrl,
          ws: true,
        },
      },
    },
    test: {
      name: "web",
      environment: "jsdom",
      setupFiles: [join(PACKAGE_ROOT, "vitest-setup.config.ts")],
      css: false,
      restoreMocks: true,
      testTimeout: 20_000,
    },
  };
});
