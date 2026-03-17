import path from "node:path";
import { fileURLToPath } from "node:url";

import { createMonitoringHttpServer } from "./presentation/create-app.js";

export interface ServerRuntimeOptions {
  readonly port?: number;
  readonly databasePath?: string;
  readonly rulesDir?: string;
}

export function startMonitoringServer(options: ServerRuntimeOptions = {}) {
  const port = options.port ?? Number(process.env.MONITOR_PORT ?? 3847);
  const databasePath =
    options.databasePath ??
    path.resolve(process.cwd(), ".monitor", "monitor.sqlite");
  const rulesDir = options.rulesDir ?? path.resolve(process.cwd(), "rules");

  const runtime = createMonitoringHttpServer({
    databasePath,
    rulesDir
  });

  runtime.server.listen(port, () => {
    console.log(`[monitor-server] listening on http://127.0.0.1:${port}`);
    console.log(`[monitor-server] database: ${databasePath}`);
    console.log(`[monitor-server] rules: ${rulesDir}`);
  });

  return runtime;
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
const modulePath = fileURLToPath(import.meta.url);

if (entryPath === modulePath) {
  startMonitoringServer();
}
