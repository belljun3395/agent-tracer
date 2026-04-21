import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const relativePath of [
  ".svelte-kit",
  ".evidence/template/.svelte-kit",
  ".evidence/template/build",
]) {
  fs.rmSync(path.join(packageRoot, relativePath), { recursive: true, force: true });
}

console.log("Cleaned Evidence generated cache");
