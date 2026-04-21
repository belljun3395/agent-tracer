import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const endpointRelativePath = path.join(
  "template",
  "src",
  "pages",
  "api",
  "pagesManifest.json",
  "+server.js",
);

const endpointPaths = [
  path.join(packageRoot, ".evidence", endpointRelativePath),
  path.join(packageRoot, "node_modules", "@evidence-dev", "evidence", endpointRelativePath),
];

const manifest = {
  label: "Home",
  href: "/",
  children: {
    "report-library": {
      label: "Report Library",
      href: undefined,
      children: {
        "runtime-outcomes": {
          label: "runtime outcomes",
          href: "/",
          children: {},
          frontMatter: { title: "Runtime Outcomes", sidebar_position: 1 },
          isTemplated: false,
          isPage: true,
        },
        tasks: {
          label: "task explorer",
          href: "/tasks",
          children: {},
          frontMatter: { title: "Task Explorer", sidebar_position: 2 },
          isTemplated: false,
          isPage: true,
        },
        "task-efficiency": {
          label: "task efficiency",
          href: "/task-efficiency",
          children: {},
          frontMatter: { title: "Task Efficiency", sidebar_position: 3 },
          isTemplated: false,
          isPage: true,
        },
        "task-retry": {
          label: "task retry & failure",
          href: "/task-retry",
          children: {},
          frontMatter: { title: "Task Retry & Failure", sidebar_position: 4 },
          isTemplated: false,
          isPage: true,
        },
        "task-subagent": {
          label: "subagent usage",
          href: "/task-subagent",
          children: {},
          frontMatter: { title: "Subagent Usage", sidebar_position: 5 },
          isTemplated: false,
          isPage: true,
        },
        "context-window": {
          label: "context window",
          href: "/context-window",
          children: {},
          frontMatter: { title: "Context Window", sidebar_position: 6 },
          isTemplated: false,
          isPage: true,
        },
        "tool-activity": {
          label: "tool activity",
          href: "/tool-activity",
          children: {},
          frontMatter: { title: "Tool Activity", sidebar_position: 7 },
          isTemplated: false,
          isPage: true,
        },
        "token-economy": {
          label: "token economy",
          href: "/token-economy",
          children: {},
          frontMatter: { title: "Token Economy", sidebar_position: 8 },
          isTemplated: false,
          isPage: true,
        },
      },
      frontMatter: { title: "Report Library", sidebar_position: 1 },
      isTemplated: false,
      isPage: false,
    },
  },
  frontMatter: { title: "Runtime Outcomes" },
  isTemplated: false,
  isPage: true,
};

const source = `import { json } from '@sveltejs/kit';

export const prerender = true;

export async function GET() {
  return json(${JSON.stringify(manifest, null, 2)});
}
`;

const patchedPaths = [];
for (const endpointPath of endpointPaths) {
  if (!fs.existsSync(endpointPath)) {
    continue;
  }

  fs.writeFileSync(endpointPath, source);
  patchedPaths.push(endpointPath);
}

if (patchedPaths.length === 0) {
  throw new Error(`Missing Evidence pages manifest endpoint. Checked: ${endpointPaths.join(", ")}`);
}

console.log(`Patched Evidence sidebar pages manifest (${patchedPaths.length} file${patchedPaths.length === 1 ? "" : "s"})`);
