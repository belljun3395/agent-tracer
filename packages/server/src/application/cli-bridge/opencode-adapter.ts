/**
 * @module application/cli-bridge/opencode-adapter
 *
 * OpenCode CLI adapter. Uses `opencode run --format json` for headless execution.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { Readable, PassThrough } from "node:stream";
import type {
  CliAdapter,
  CliProcess,
  CliSessionOptions,
  CliResumeOptions,
  CliType,
} from "./types.js";

export class OpenCodeAdapter implements CliAdapter {
  readonly name: CliType = "opencode";

  private resolveModel(): string | undefined {
    return process.env.OPENCODE_CLI_MODEL?.trim()
      || process.env.MONITOR_OPENCODE_MODEL?.trim()
      || undefined;
  }

  async startSession(
    options: Omit<CliSessionOptions, "cli">
  ): Promise<CliProcess> {
    const { workdir, prompt, taskId } = options;
    const args = ["run", prompt, "--format", "json", "--dir", workdir, "--pure"];
    const model = options.model ?? this.resolveModel();
    if (model) {
      args.push("--model", model);
    }
    return this.spawnOpenCode(args, workdir, undefined, taskId);
  }

  async resumeSession(
    options: Omit<CliResumeOptions, "cli">
  ): Promise<CliProcess> {
    const { sessionId, workdir, prompt, taskId } = options;
    const args = [
      "run",
      prompt,
      "--format",
      "json",
      "--dir",
      workdir,
      "--pure",
      "--session",
      sessionId,
    ];
    const model = options.model ?? this.resolveModel();
    if (model) {
      args.push("--model", model);
    }
    return this.spawnOpenCode(args, workdir, sessionId, taskId);
  }

  private spawnOpenCode(
    args: string[],
    workdir: string,
    existingSessionId?: string,
    taskId?: string
  ): CliProcess {
    const processId = globalThis.crypto.randomUUID();

    let childProcess: ChildProcess;
    try {
      childProcess = spawn("opencode", args, {
        cwd: workdir,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          TERM: "dumb",
          CI: "true",
          // Let the monitor plugin associate this session with the right task,
          // even in --format json headless mode where plugin loading is uncertain.
          ...(taskId ? { MONITOR_TASK_ID: taskId } : {}),
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to spawn OpenCode CLI: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (childProcess.pid === undefined) {
      throw new Error("Failed to spawn OpenCode CLI: executable not found or failed to start");
    }

    if (!childProcess.stdout) {
      childProcess.kill();
      throw new Error("Failed to create stdout stream for OpenCode CLI");
    }

    let extractedSessionId = existingSessionId ?? "";
    const outputStream = new PassThrough();

    childProcess.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (!extractedSessionId) {
        const match = text.match(/"sessionI[dD]"\s*:\s*"([^"]+)"/);
        if (match?.[1]) {
          extractedSessionId = match[1];
        }
      }
      outputStream.write(chunk);
    });

    childProcess.stdout.on("end", () => {
      outputStream.end();
    });

    childProcess.stdout.on("error", (err) => {
      console.error(`[opencode stdout error] ${err.message}`);
      outputStream.end();
    });

    childProcess.on("error", (err) => {
      console.error(`[opencode process error] ${err.message}`);
      outputStream.end();
    });

    childProcess.stderr?.on("data", (chunk: Buffer) => {
      console.error(`[opencode stderr] ${chunk.toString()}`);
    });

    return {
      processId,
      get sessionId(): string {
        return extractedSessionId;
      },
      cli: "opencode",
      stdout: outputStream as Readable,

      sendMessage(_message: string): void {
        throw new Error("OpenCode CLI does not support interactive stdin messages");
      },

      kill(): void {
        if (!childProcess.killed) {
          childProcess.kill("SIGTERM");
          const sigkillTimer = setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill("SIGKILL");
            }
          }, 5000);
          // Clear the SIGKILL timer if the process exits on its own within the grace period.
          childProcess.once("exit", () => clearTimeout(sigkillTimer));
        }
      },

      async wait(): Promise<number> {
        return new Promise((resolve, reject) => {
          if (childProcess.exitCode !== null) {
            resolve(childProcess.exitCode);
            return;
          }

          childProcess.on("exit", (code) => {
            resolve(code ?? 0);
          });

          childProcess.on("error", (err) => {
            reject(err);
          });
        });
      },
    };
  }
}
