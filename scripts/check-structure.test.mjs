import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { BUDGETS } from "../architecture.manifest.mjs";
import { findOversized, findUntestedUsecases } from "./check-structure.mjs";

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "structure-"));
  const written = [];
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    written.push(full);
  }
  return written;
}

describe("findOversized", () => {
  it("상한을 넘는 소스 파일을 잡아낸다", () => {
    const files = fixture({ "big.ts": "x\n".repeat(301), "small.ts": "x\n" });
    const found = findOversized(files, BUDGETS.maxFileLines);
    assert.equal(found.length, 1);
    assert.ok(found[0].file.endsWith("big.ts"));
  });

  it("테스트 파일은 세지 않는다", () => {
    const files = fixture({ "big.test.ts": "x\n".repeat(500) });
    assert.deepEqual(findOversized(files, BUDGETS.maxFileLines), []);
  });

  it("파이썬 소스도 함께 센다", () => {
    const files = fixture({ "big.py": "x\n".repeat(400) });
    assert.equal(findOversized(files, BUDGETS.maxFileLines).length, 1);
  });
});

describe("findUntestedUsecases", () => {
  it("인접 테스트가 없는 유스케이스를 잡아낸다", () => {
    const files = fixture({ "scan.usecase.ts": "" });
    assert.equal(findUntestedUsecases(files).length, 1);
  });

  it("인접 테스트가 있는 유스케이스를 통과시킨다", () => {
    const files = fixture({ "scan.usecase.ts": "", "scan.usecase.test.ts": "" });
    assert.deepEqual(findUntestedUsecases(files.filter((file) => !file.endsWith(".test.ts"))), []);
  });
});

describe("BUDGETS", () => {
  it("구조 상한을 0으로 유지한다", () => {
    assert.equal(BUDGETS.oversizedFiles, 0);
    assert.equal(BUDGETS.untestedUsecases, 0);
  });
});
