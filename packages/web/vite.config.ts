import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
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
        define: {
            "import.meta.env.VITE_MONITOR_BASE_URL": JSON.stringify(webApiBaseUrl),
            "import.meta.env.VITE_MONITOR_WS_BASE_URL": JSON.stringify(webWsBaseUrl),
            "import.meta.env.VITE_MONITOR_DEV_BASE_URL": JSON.stringify(monitorHttpBaseUrl),
            "import.meta.env.VITE_MONITOR_DEV_WS_BASE_URL": JSON.stringify(monitorWsBaseUrl)
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
