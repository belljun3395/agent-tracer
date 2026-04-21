import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const layoutRelativePath = path.join("template", "src", "pages", "+layout.js");

const layoutPaths = [
  path.join(packageRoot, ".evidence", layoutRelativePath),
  path.join(packageRoot, "node_modules", "@evidence-dev", "evidence", layoutRelativePath),
];

const ORIGINAL = "export const ssr = !dev;";
const PATCHED = "export const ssr = false;";

const patchedPaths = [];
for (const layoutPath of layoutPaths) {
  if (!fs.existsSync(layoutPath)) {
    continue;
  }

  const source = fs.readFileSync(layoutPath, "utf-8");
  if (source.includes(PATCHED)) {
    patchedPaths.push(layoutPath);
    continue;
  }
  if (!source.includes(ORIGINAL)) {
    throw new Error(
      `Unexpected Evidence layout source in ${layoutPath}; missing marker "${ORIGINAL}"`,
    );
  }

  fs.writeFileSync(layoutPath, source.replace(ORIGINAL, PATCHED));
  patchedPaths.push(layoutPath);
}

if (patchedPaths.length === 0) {
  throw new Error(`Missing Evidence +layout.js. Checked: ${layoutPaths.join(", ")}`);
}

console.log(
  `Patched Evidence layout SSR flag (${patchedPaths.length} file${
    patchedPaths.length === 1 ? "" : "s"
  })`,
);
