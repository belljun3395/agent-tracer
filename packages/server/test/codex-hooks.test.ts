import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

interface RequestCall {
  readonly endpoint: string;
  readonly body: Record<string, unknown>;
}

const tsxCli = fileURLToPath(new URL("../../../node_modules/tsx/dist/cli.mjs", import.meta.url));
const stopHook = fileURLToPath(new URL("../../../.codex/hooks/stop.ts", import.meta.url));

async function startMonitorStub() {
  const calls: RequestCall[] = [];

  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }

    const body = chunks.length > 0
      ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
      : {};
    const endpoint = req.url ?? "";
    calls.push({ endpoint, body });

    res.setHeader("content-type", "application/json");
    if (endpoint === "/api/runtime-session-ensure") {
      res.end(JSON.stringify({
        taskId: "codex-task",
        sessionId: "codex-monitor-session",
        taskCreated: true,
        sessionCreated: true
      }));
      return;
    }

    res.end(JSON.stringify({ ok: true }));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve monitor stub server port");
  }

  return {
    calls,
    close: async () => {
      server.close();
      await once(server, "close");
    },
    port: address.port
  };
}

async function runCodexHook(
  scriptPath: string,
  payload: Record<string, unknown>,
  port: number,
  projectDir: string
) {
  const child = spawn("node", [tsxCli, scriptPath], {
    env: {
      ...process.env,
      MONITOR_PORT: String(port),
      CODEX_PROJECT_DIR: projectDir
    },
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.end(JSON.stringify(payload));

  const [code] = await once(child, "close") as [number | null];
  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(stderr).toBe("");
}

function makeTranscriptLines(repoDir: string, turnId: string): string {
  const filePath = path.join(repoDir, "src", "app.ts");
  return [
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "task_started",
        turn_id: turnId
      }
    }),
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "web_search_end",
        call_id: "ws-search-1",
        query: "OpenJDK JDK 26 release date",
        action: {
          type: "search",
          query: "OpenJDK JDK 26 release date"
        }
      }
    }),
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "web_search_end",
        call_id: "ws-open-1",
        query: "https://jdk.java.net/26/release-notes",
        action: {
          type: "open_page",
          url: "https://jdk.java.net/26/release-notes"
        }
      }
    }),
    JSON.stringify({
      type: "response_item",
      payload: {
        type: "custom_tool_call",
        status: "completed",
        call_id: "patch-1",
        name: "apply_patch",
        input: [
          "*** Begin Patch",
          `*** Update File: ${filePath}`,
          "@@",
          "-old",
          "+new",
          "*** End Patch"
        ].join("\n")
      }
    }),
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "task_complete",
        turn_id: turnId
      }
    })
  ].join("\n");
}

describe("Codex hooks", () => {
  const monitors: Array<{ close: () => Promise<void> }> = [];
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (monitors.length > 0) {
      await monitors.pop()!.close();
    }
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("Stop hook backfills web-search and apply_patch transcript events before runtime-session-end", async () => {
    const monitor = await startMonitorStub();
    monitors.push(monitor);

    const repoDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-codex-hooks-"));
    tempDirs.push(repoDir);

    const turnId = "turn-codex-1";
    const transcriptPath = path.join(repoDir, "transcript.jsonl");
    await writeFile(transcriptPath, makeTranscriptLines(repoDir, turnId), "utf8");

    await runCodexHook(stopHook, {
      session_id: "codex-session",
      turn_id: turnId,
      transcript_path: transcriptPath,
      cwd: repoDir
    }, monitor.port, repoDir);

    expect(monitor.calls).toEqual([
      {
        endpoint: "/api/runtime-session-ensure",
        body: {
          runtimeSource: "codex-hook",
          runtimeSessionId: "codex-session",
          title: `Codex — ${path.basename(repoDir)}`,
          workspacePath: repoDir
        }
      },
      {
        endpoint: "/api/explore",
        body: {
          taskId: "codex-task",
          sessionId: "codex-monitor-session",
          toolName: "web_search",
          title: "Web search: OpenJDK JDK 26 release date",
          body: "query: OpenJDK JDK 26 release date\naction: search",
          lane: "exploration",
          metadata: {
            callId: "ws-search-1",
            query: "OpenJDK JDK 26 release date",
            actionType: "search",
            subtypeKey: "web_search",
            subtypeLabel: "Web search",
            subtypeGroup: "web",
            toolFamily: "explore",
            operation: "search",
            entityType: "query",
            entityName: "OpenJDK JDK 26 release date",
            sourceTool: "websearch"
          }
        }
      },
      {
        endpoint: "/api/explore",
        body: {
          taskId: "codex-task",
          sessionId: "codex-monitor-session",
          toolName: "web_search",
          title: "Open page: https://jdk.java.net/26/release-notes",
          body: "query: https://jdk.java.net/26/release-notes\naction: open_page\nurl: https://jdk.java.net/26/release-notes",
          lane: "exploration",
          metadata: {
            callId: "ws-open-1",
            query: "https://jdk.java.net/26/release-notes",
            actionType: "open_page",
            url: "https://jdk.java.net/26/release-notes",
            subtypeKey: "web_fetch",
            subtypeLabel: "Web fetch",
            subtypeGroup: "web",
            toolFamily: "explore",
            operation: "fetch",
            entityType: "url",
            entityName: "https://jdk.java.net/26/release-notes",
            sourceTool: "webfetch"
          }
        }
      },
      {
        endpoint: "/api/tool-used",
        body: {
          taskId: "codex-task",
          sessionId: "codex-monitor-session",
          toolName: "apply_patch",
          title: "Apply patch (1 file)",
          body: "src/app.ts",
          lane: "implementation",
          filePaths: ["src/app.ts"],
          metadata: {
            callId: "patch-1",
            fileCount: 1,
            patchedFiles: ["src/app.ts"],
            subtypeKey: "apply_patch",
            subtypeLabel: "Apply patch",
            subtypeGroup: "file_ops",
            toolFamily: "file",
            operation: "patch",
            entityType: "file",
            entityName: "src/app.ts",
            sourceTool: "apply_patch"
          }
        }
      },
      {
        endpoint: "/api/runtime-session-end",
        body: {
          runtimeSource: "codex-hook",
          runtimeSessionId: "codex-session",
          completeTask: true,
          completionReason: "assistant_turn_complete"
        }
      }
    ]);
  });

  it("Stop hook backfill dedupes already-processed turns via .codex/.hook-state.json", async () => {
    const monitor = await startMonitorStub();
    monitors.push(monitor);

    const repoDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-codex-hooks-dedupe-"));
    tempDirs.push(repoDir);

    const turnId = "turn-codex-dedupe";
    const transcriptPath = path.join(repoDir, "transcript.jsonl");
    await writeFile(transcriptPath, makeTranscriptLines(repoDir, turnId), "utf8");

    const payload = {
      session_id: "codex-session",
      turn_id: turnId,
      transcript_path: transcriptPath,
      cwd: repoDir
    };

    await runCodexHook(stopHook, payload, monitor.port, repoDir);
    await runCodexHook(stopHook, payload, monitor.port, repoDir);

    expect(monitor.calls.filter((call) => call.endpoint === "/api/explore")).toHaveLength(2);
    expect(monitor.calls.filter((call) => call.endpoint === "/api/tool-used")).toHaveLength(1);
    expect(monitor.calls.filter((call) => call.endpoint === "/api/runtime-session-end")).toHaveLength(2);
  });
});
