import { describe, expect, it } from "vitest";

import {
  isCliCancelMessage,
  isCliClientMessage,
  isCliMessageMessage,
  isCliResumeMessage,
  isCliStartMessage
} from "./cli-ws-types.js";

describe("cli-ws-types guards", () => {
  it("accepts cli:start messages", () => {
    const message: unknown = {
      type: "cli:start",
      cli: "claude",
      workdir: "/tmp",
      prompt: "hello"
    };

    expect(isCliClientMessage(message)).toBe(true);
    if (isCliClientMessage(message)) {
      expect(isCliStartMessage(message)).toBe(true);
    }
  });

  it("accepts cli:resume messages", () => {
    const message: unknown = {
      type: "cli:resume",
      cli: "opencode",
      sessionId: "ses_1",
      workdir: "/tmp",
      prompt: "continue"
    };

    expect(isCliClientMessage(message)).toBe(true);
    if (isCliClientMessage(message)) {
      expect(isCliResumeMessage(message)).toBe(true);
    }
  });

  it("accepts cli:message and cli:cancel messages", () => {
    const messageEvent: unknown = {
      type: "cli:message",
      processId: "proc_1",
      message: "hello"
    };
    const cancelEvent: unknown = {
      type: "cli:cancel",
      processId: "proc_1"
    };

    expect(isCliClientMessage(messageEvent)).toBe(true);
    expect(isCliClientMessage(cancelEvent)).toBe(true);

    if (isCliClientMessage(messageEvent)) {
      expect(isCliMessageMessage(messageEvent)).toBe(true);
    }
    if (isCliClientMessage(cancelEvent)) {
      expect(isCliCancelMessage(cancelEvent)).toBe(true);
    }
  });

  it("rejects unknown messages", () => {
    expect(isCliClientMessage({ type: "unknown" })).toBe(false);
    expect(isCliClientMessage(null)).toBe(false);
    expect(isCliClientMessage("cli:start")).toBe(false);
  });
});
