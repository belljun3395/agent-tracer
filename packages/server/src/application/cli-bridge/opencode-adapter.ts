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
    const explicit = process.env.OPENCODE_CLI_MODEL?.trim()
      || process.env.MONITOR_OPENCODE_MODEL?.trim();
    if (explicit) return explicit;

    if (process.env.OPENAI_API_KEY?.trim()) {
      return "openai/gpt-5.3-codex";
    }

    return undefined;
  }

  async startSession(
    options: Omit<CliSessionOptions, "cli">
  ): Promise<CliProcess> {
    const { workdir, prompt } = options;
    const args = ["run", prompt, "--format", "json", "--dir", workdir];
    const model = this.resolveModel();
    if (model) {
      args.push("--model", model);
    }
    return this.spawnOpenCode(args, workdir);
  }

  async resumeSession(
    options: Omit<CliResumeOptions, "cli">
  ): Promise<CliProcess> {
    const { sessionId, workdir, prompt } = options;
    const args = [
      "run",
      prompt,
      "--format",
      "json",
      "--dir",
      workdir,
      "--session",
      sessionId,
    ];
    const model = this.resolveModel();
    if (model) {
      args.push("--model", model);
    }
    return this.spawnOpenCode(args, workdir, sessionId);
  }

  private spawnOpenCode(
    args: string[],
    workdir: string,
    existingSessionId?: string
  ): CliProcess {
    const processId = globalThis.crypto.randomUUID();

    let childProcess: ChildProcess;
    try {
      childProcess = spawn("opencode", args, {
        cwd: workdir,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          TERM: "dumb",
          CI: "true",
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

    if (!childProcess.stdout || !childProcess.stdin) {
      childProcess.kill();
      throw new Error("Failed to create stdio streams for OpenCode CLI");
    }

    let extractedSessionId = existingSessionId ?? "";
    const outputStream = new PassThrough();

    childProcess.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (!extractedSessionId) {
        const match = text.match(/"sessionId"\s*:\s*"([^"]+)"/);
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

    const stdin = childProcess.stdin;

    return {
      processId,
      get sessionId(): string {
        return extractedSessionId;
      },
      cli: "opencode",
      stdout: outputStream as Readable,

      sendMessage(message: string): void {
        if (!stdin.writable) {
          throw new Error("OpenCode CLI stdin is not writable");
        }
        stdin.write(JSON.stringify({ type: "message", content: message }) + "\n");
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
