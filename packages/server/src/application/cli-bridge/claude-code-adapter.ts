/**
 * @module application/cli-bridge/claude-code-adapter
 *
 * Claude Code CLI adapter. Uses `claude -p` for headless execution.
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

export class ClaudeCodeAdapter implements CliAdapter {
  readonly name: CliType = "claude";

  async startSession(
    options: Omit<CliSessionOptions, "cli">
  ): Promise<CliProcess> {
    const { workdir, prompt, taskId } = options;
    const args = ["-p", prompt, "--output-format", "stream-json", "--verbose"];
    return this.spawnClaude(args, workdir, undefined, taskId);
  }

  async resumeSession(
    options: Omit<CliResumeOptions, "cli">
  ): Promise<CliProcess> {
    const { sessionId, workdir, prompt, taskId } = options;
    const args = [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--resume",
      sessionId,
    ];
    return this.spawnClaude(args, workdir, sessionId, taskId);
  }

  private spawnClaude(
    args: string[],
    workdir: string,
    existingSessionId?: string,
    taskId?: string
  ): CliProcess {
    const processId = globalThis.crypto.randomUUID();

    let childProcess: ChildProcess;
    try {
      childProcess = spawn("claude", args, {
        cwd: workdir,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          TERM: "dumb",
          CI: "true",
          ...(taskId ? { MONITOR_TASK_ID: taskId } : {}),
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to spawn Claude CLI: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (childProcess.pid === undefined) {
      throw new Error("Failed to spawn Claude CLI: executable not found or failed to start");
    }

    if (!childProcess.stdout || !childProcess.stdin) {
      childProcess.kill();
      throw new Error("Failed to create stdio streams for Claude CLI");
    }

    let extractedSessionId = existingSessionId ?? "";
    const outputStream = new PassThrough();

    childProcess.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (!extractedSessionId) {
        const match = text.match(/"session_id"\s*:\s*"([^"]+)"/);
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
      console.error(`[claude stdout error] ${err.message}`);
      outputStream.end();
    });

    childProcess.on("error", (err) => {
      console.error(`[claude process error] ${err.message}`);
      outputStream.end();
    });

    childProcess.stderr?.on("data", (chunk: Buffer) => {
      console.error(`[claude stderr] ${chunk.toString()}`);
    });

    const stdin = childProcess.stdin;

    return {
      processId,
      get sessionId(): string {
        return extractedSessionId;
      },
      cli: "claude",
      stdout: outputStream as Readable,

      sendMessage(message: string): void {
        if (!stdin.writable) {
          throw new Error("Claude CLI stdin is not writable");
        }
        stdin.write(
          JSON.stringify({ type: "user_message", content: message }) + "\n"
        );
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
