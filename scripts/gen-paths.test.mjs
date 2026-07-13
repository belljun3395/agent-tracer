import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { UNITS } from "../architecture.manifest.mjs";
import { buildPaths } from "./gen-paths.mjs";

describe("buildPaths", () => {
  it("배포 단위마다 자기 별칭을 만든다", () => {
    const paths = buildPaths(UNITS);
    for (const unit of UNITS) {
      assert.deepEqual(paths[`${unit.alias}/*`], [`${unit.dir}/src/*`]);
    }
  });

  it("공개 표면을 가진 배포 단위만 패키지 이름으로 부를 수 있다", () => {
    const paths = buildPaths(UNITS);
    assert.deepEqual(paths["@monitor/kernel"], ["packages/kernel/src/index.ts"]);
    assert.equal(paths["@monitor/runtime-api"], undefined);
  });

  it("배포 단위가 늘면 별칭도 함께 는다", () => {
    const extra = { name: "extra", dir: "packages/extra", alias: "~extra", importable: false };
    const paths = buildPaths([...UNITS, extra]);
    assert.deepEqual(paths["~extra/*"], ["packages/extra/src/*"]);
  });
});
