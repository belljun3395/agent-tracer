import path from "node:path";
import { fileURLToPath } from "node:url";

export { createMonitorRuntime } from "./bootstrap/create-monitor-runtime.js";

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
const modulePath = fileURLToPath(import.meta.url);

if (entryPath === modulePath) {
  // OTel은 서버 코드보다 먼저 초기화해야 메트릭이 정상 등록된다.
  const { startOtel } = await import("./infrastructure/otel/index.js");
  startOtel();

  const { createMonitorRuntime } = await import("./bootstrap/create-monitor-runtime.js");
  const port = Number(process.env.MONITOR_PORT ?? 3847);
  const databasePath = path.resolve(process.cwd(), ".monitor", "monitor.sqlite");

  const runtime = createMonitorRuntime({ databasePath });
  runtime.server.listen(port, () => {
    console.log(`[monitor-server] listening on http://127.0.0.1:${port}`);
    console.log(`[monitor-server] database: ${databasePath}`);
  });
}
