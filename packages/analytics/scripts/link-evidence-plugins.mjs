import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "../..");
const scopedTarget = path.join(packageRoot, "node_modules", "@evidence-dev");

const packages = [
  "core-components",
  "duckdb",
];

fs.mkdirSync(scopedTarget, { recursive: true });

for (const packageName of packages) {
  const source = path.join(repoRoot, "node_modules", "@evidence-dev", packageName);
  const target = path.join(scopedTarget, packageName);
  if (fs.existsSync(path.join(target, "package.json"))) {
    continue;
  }
  if (!fs.existsSync(source)) {
    throw new Error(`Missing Evidence package ${source}. Run npm install first.`);
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.symlinkSync(source, target, "dir");
}

console.log(`Linked ${packages.length} Evidence plugins into packages/analytics/node_modules`);
