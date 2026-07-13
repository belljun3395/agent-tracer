import { describe, expect, it } from "vitest";
import { formatBytes } from "~web/shared/lib/formatting/format-bytes.js";

describe("formatBytes", () => {
  it("0 이하 값은 0 B로 표시한다", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
  });

  it("1024 미만은 바이트 그대로 표시한다", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("1024 이상은 KB로 변환한다", () => {
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("메가바이트 단위는 소수점을 정리해 표시한다", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
  });

  it("10 미만 값은 소수 첫째 자리까지 표시한다", () => {
    expect(formatBytes(1.5 * 1024)).toBe("1.5 KB");
  });
});
