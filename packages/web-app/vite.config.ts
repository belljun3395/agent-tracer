import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { loadApplicationConfig, resolveMonitorHttpBaseUrl, resolveMonitorWsBaseUrl, resolveWebApiBaseUrl, resolveWebWsBaseUrl } from "../../config/load-application-config.js";
export default defineConfig(({ mode }) => {
    const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
    const applicationConfig = loadApplicationConfig({ env });
    const monitorHttpBaseUrl = resolveMonitorHttpBaseUrl(applicationConfig, env);
    const monitorWsBaseUrl = resolveMonitorWsBaseUrl(applicationConfig, env);
    const webApiBaseUrl = resolveWebApiBaseUrl(applicationConfig, env);
    const webWsBaseUrl = resolveWebWsBaseUrl(applicationConfig, env);
    return {
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                "@monitor/web-domain": fileURLToPath(new URL("../web-domain/src/index.ts", import.meta.url)),
                "@monitor/web-io": fileURLToPath(new URL("../web-io/src/index.ts", import.meta.url)),
                "@monitor/web-state": fileURLToPath(new URL("../web-state/src/index.ts", import.meta.url))
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
                    manualChunks(id) {
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
