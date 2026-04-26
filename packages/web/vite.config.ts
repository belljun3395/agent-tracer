import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { resolveViteMonitorConfig } from "./src/config/vite-monitor-config";
const PACKAGE_ROOT = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig(async ({ mode }) => {
    const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
    const {
        monitorHttpBaseUrl,
        monitorWsBaseUrl,
        webApiBaseUrl,
        webWsBaseUrl,
    } = resolveViteMonitorConfig(env);
    const plugins: PluginOption[] = [react()];
    const isVitest = process.env["VITEST"] === "true" || mode === "test";
    if (!isVitest) {
        const { default: tailwindcss } = await import("@tailwindcss/vite");
        plugins.push(tailwindcss());
    }
    return {
        plugins,
        resolve: {
            alias: {
                "~domain": resolve(PACKAGE_ROOT, "src/types"),
                "~io": resolve(PACKAGE_ROOT, "src/io"),
                "~state": resolve(PACKAGE_ROOT, "src/state"),
                "~app": resolve(PACKAGE_ROOT, "src/app"),
                "~config": resolve(PACKAGE_ROOT, "src/config")
            }
        },
        define: {
            "import.meta.env.VITE_MONITOR_BASE_URL": JSON.stringify(webApiBaseUrl),
            "import.meta.env.VITE_MONITOR_WS_BASE_URL": JSON.stringify(webWsBaseUrl),
            "import.meta.env.VITE_MONITOR_DEV_BASE_URL": JSON.stringify(monitorHttpBaseUrl),
            "import.meta.env.VITE_MONITOR_DEV_WS_BASE_URL": JSON.stringify(monitorWsBaseUrl)
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id: string) {
                        if (!id.includes("node_modules")) {
                            return undefined;
                        }
                        if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) {
                            return "react-vendor";
                        }
                        if (id.includes("zustand")) {
                            return "state-vendor";
                        }
                        return "vendor";
                    }
                }
            }
        },
        server: {
            proxy: {
                "/api": monitorHttpBaseUrl,
                "/health": monitorHttpBaseUrl,
                "/ws": {
                    target: monitorWsBaseUrl,
                    ws: true
                }
            }
        }
    };
});
