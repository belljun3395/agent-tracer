import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "~web/shared/ui/index.js";
import { DaemonHealthSection } from "~web/widgets/settings/daemon/DaemonHealthSection.js";

const { fetchDaemonHealthMock } = vi.hoisted(() => ({
  fetchDaemonHealthMock: vi.fn(),
}));

vi.mock("~web/entities/daemon/api/api-daemon-health.js", () => ({
  fetchDaemonHealth: fetchDaemonHealthMock,
}));

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DaemonHealthSection />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("데몬 상태 설정", () => {
  afterEach(() => {
    cleanup();
    fetchDaemonHealthMock.mockReset();
  });

  it("보고 이력이 없으면 안내 문구를 보여준다", async () => {
    fetchDaemonHealthMock.mockResolvedValue({ snapshot: null });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("No health report received yet.")).not.toBeNull();
    });
  });

  it("최근 보고를 받으면 스풀 적체·dead-letter·버전을 보여준다", async () => {
    fetchDaemonHealthMock.mockResolvedValue({
      snapshot: {
        spoolBacklogBytes: 2048,
        deadLetterCount: 1,
        lastDeadReasons: ["rejected 4xx"],
        swallowedErrors: 0,
        daemonVersion: "0.4.0",
        retryStatusSince: null,
        reportedAt: new Date().toISOString(),
      },
    });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("2 KB")).not.toBeNull();
      expect(screen.getByText("0.4.0")).not.toBeNull();
      expect(screen.getByText("live")).not.toBeNull();
    });
  });

  it("마지막 보고가 오래됐으면 stale 배지를 보여준다", async () => {
    const staleReportedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    fetchDaemonHealthMock.mockResolvedValue({
      snapshot: {
        spoolBacklogBytes: 0,
        deadLetterCount: 0,
        lastDeadReasons: [],
        swallowedErrors: 0,
        daemonVersion: "0.4.0",
        retryStatusSince: null,
        reportedAt: staleReportedAt,
      },
    });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("stale")).not.toBeNull();
    });
  });

  it("데몬이 보고 중이면 제어 화면 링크를 연다", async () => {
    fetchDaemonHealthMock.mockResolvedValue({
      snapshot: {
        spoolBacklogBytes: 0,
        deadLetterCount: 0,
        lastDeadReasons: [],
        swallowedErrors: 0,
        daemonVersion: "0.4.0",
        retryStatusSince: null,
        reportedAt: new Date().toISOString(),
      },
    });
    renderSection();
    await waitFor(() => {
      const link = screen.getByRole("link", { name: "Open control page" });
      expect(link.getAttribute("href")).toBe("http://127.0.0.1:3848/");
      expect(link.getAttribute("target")).toBe("_blank");
    });
  });

  it("보고가 끊기면 제어 화면 링크를 열지 않는다", async () => {
    fetchDaemonHealthMock.mockResolvedValue({ snapshot: null });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("No health report received yet.")).not.toBeNull();
    });
    expect(screen.queryByRole("link", { name: "Open control page" })).toBeNull();
    expect(screen.getByText("Open control page").getAttribute("aria-disabled")).toBe("true");
  });
});
