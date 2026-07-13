#!/usr/bin/env node
// 배포 단위마다 자기 tsconfig로 돌려야 별칭이 해석되므로 우산 단위로 나눠 검사한다.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { UMBRELLAS, UNITS } from "../architecture.manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPCRUISE = path.join(ROOT, "node_modules/.bin/depcruise");

/** 우산마다 한 번씩 도는 검사 대상이며 server의 앱들은 루트 별칭을 공유한다. */
export function cruiseTargets() {
  return UMBRELLAS.concat("kernel").map((umbrella) => {
    const unit = UNITS.find((candidate) => candidate.name === umbrella);
    return {
      source: unit ? unit.dir : `packages/${umbrella}`,
      tsconfig: unit && fs.existsSync(path.join(ROOT, unit.dir, "tsconfig.json"))
        ? `${unit.dir}/tsconfig.json`
        : "tsconfig.base.json",
    };
  });
}

function main() {
  let failed = false;
  for (const target of cruiseTargets()) {
    if (!fs.existsSync(path.join(ROOT, target.source))) continue;
    const result = spawnSync(
      DEPCRUISE,
      ["--config", ".dependency-cruiser.mjs", "--ts-config", target.tsconfig, target.source],
      { cwd: ROOT, stdio: "inherit", maxBuffer: 32 * 1024 * 1024 },
    );
    if (result.error) throw result.error;
    failed ||= result.status !== 0;
  }
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
