import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { resolveViteMonitorConfig } from "./src/config";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig(async ({ mode }) => {
    // vitest configuration (only active during test runs)
    const test = {
        environment: "jsdom",
        globals: true,
        setupFiles: [resolve(__dirname, "src/test/setup.ts")],
    };
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
        },
        test,
    };
});
