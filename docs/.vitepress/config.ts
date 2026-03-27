import { defineConfig } from "vitepress";

const repositoryUrl = "https://github.com/belljun3395/agent-tracer";

function normalizeBasePath(base: string): string {
  if (base === "/") {
    return base;
  }

  const prefixed = base.startsWith("/") ? base : `/${base}`;
  return prefixed.endsWith("/") ? prefixed : `${prefixed}/`;
}

// GitHub Pages can inject a project-site base without changing local dev URLs.
const docsBase = normalizeBasePath(process.env.DOCS_BASE ?? "/");

const guideSidebar = [
  {
    text: "Guide Home",
    items: [
      { text: "Runtime Setup Guides", link: "/guide/" },
      { text: "External Setup Hub", link: "/guide/external-setup" },
      { text: "Runtime Setup Map", link: "/guide/llm-setup" }
    ]
  },
  {
    text: "Runtime Guides",
    items: [
      { text: "Claude Code Setup", link: "/guide/claude-setup" },
      { text: "OpenCode Setup", link: "/guide/opencode-setup" },
      { text: "Codex Setup", link: "/guide/codex-setup" }
    ]
  },
  {
    text: "Reference",
    items: [
      { text: "Runtime Capabilities", link: "/guide/runtime-capabilities" },
      { text: "API Integration Map", link: "/guide/api-integration-map" },
      { text: "Claude Hook Payload Spec", link: "/guide/hook-payload-spec" },
      { text: "Codex CLI Hook Payload Spec", link: "/guide/codex-cli-hook-payload-spec" },
      { text: "OpenCode Plugin Spec", link: "/guide/opencode-plugin-spec" },
      { text: "Web Styling Guide", link: "/guide/web-styling" }
    ]
  }
];

const wikiSidebar = [
  {
    text: "Wiki Home",
    items: [
      { text: "Agent Tracer Wiki", link: "/wiki/" },
      { text: "Agent Tracer Overview", link: "/wiki/agent-tracer-overview" },
      { text: "Getting Started & Installation", link: "/wiki/getting-started-and-installation" },
      { text: "Architecture & Package Map", link: "/wiki/architecture-and-package-map" }
    ]
  },
  {
    text: "Core Domain",
    items: [
      { text: "Core Domain & Event Model", link: "/wiki/core-domain-and-event-model" },
      { text: "Tasks, Sessions & Timeline Events", link: "/wiki/domain-model-tasks-sessions-and-timeline-events" },
      { text: "Event Classification Engine", link: "/wiki/event-classification-engine" },
      { text: "Runtime Capabilities Registry", link: "/wiki/runtime-capabilities-registry" }
    ]
  },
  {
    text: "Server",
    items: [
      { text: "Monitor Server", link: "/wiki/monitor-server" },
      { text: "MonitorService: Application Layer", link: "/wiki/monitorservice-application-layer" },
      { text: "HTTP API Reference", link: "/wiki/http-api-reference" },
      { text: "SQLite Infrastructure & Schema", link: "/wiki/sqlite-infrastructure-and-schema" },
      { text: "WebSocket Real-Time Broadcasting", link: "/wiki/websocket-real-time-broadcasting" }
    ]
  },
  {
    text: "MCP",
    items: [
      { text: "MCP Server", link: "/wiki/mcp-server" },
      { text: "MCP Tool Reference", link: "/wiki/mcp-tool-reference" },
      { text: "MonitorClient & Transport Layer", link: "/wiki/monitorclient-and-transport-layer" }
    ]
  },
  {
    text: "Runtime Adapters",
    items: [
      { text: "Runtime Adapters & Integration", link: "/wiki/runtime-adapters-and-integration" },
      { text: "Claude Code Hooks Adapter", link: "/wiki/claude-code-hooks-adapter" },
      { text: "OpenCode Plugin Adapter", link: "/wiki/opencode-plugin-adapter" },
      { text: "Codex Skill Adapter", link: "/wiki/codex-skill-adapter" },
      { text: "setup:external Automation Script", link: "/wiki/setup-external-automation-script" }
    ]
  },
  {
    text: "Web",
    items: [
      { text: "Web Dashboard", link: "/wiki/web-dashboard" },
      { text: "Task List & Global State", link: "/wiki/task-list-and-global-state" },
      { text: "Timeline Canvas", link: "/wiki/timeline-canvas" },
      { text: "Event Inspector & Insights Engine", link: "/wiki/event-inspector-and-insights-engine" },
      { text: "API Client & UI Utilities", link: "/wiki/api-client-and-ui-utilities" }
    ]
  },
  {
    text: "Workflows",
    items: [
      { text: "Workflow Library & Evaluation", link: "/wiki/workflow-library-and-evaluation" },
      { text: "Saving & Rating Workflows", link: "/wiki/saving-and-rating-workflows" },
      { text: "Searching Similar Workflows", link: "/wiki/searching-similar-workflows" }
    ]
  },
  {
    text: "Testing",
    items: [
      { text: "Testing & Development", link: "/wiki/testing-and-development" },
      { text: "Server-Side Tests", link: "/wiki/server-side-tests" },
      { text: "Web & Core Tests", link: "/wiki/web-and-core-tests" },
      { text: "Glossary", link: "/wiki/glossary" }
    ]
  },
  {
    text: "Maintainer Notes",
    items: [
      { text: "System Overview", link: "/wiki/system-overview" },
      { text: "Backend Server", link: "/wiki/backend-server" },
      { text: "Frontend Dashboard", link: "/wiki/frontend-dashboard" },
      { text: "Runtime Integrations", link: "/wiki/runtime-integrations" },
      { text: "Quality and Testing", link: "/wiki/quality-and-testing" }
    ]
  }
];

export default defineConfig({
  base: docsBase,
  title: "Agent Tracer",
  description: "Codebase wiki, runtime setup guides, and maintainer notes for Agent Tracer.",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#b45309" }]
  ],
  themeConfig: {
    siteTitle: "Agent Tracer Docs",
    appearance: true,
    search: {
      provider: "local"
    },
    nav: [
      { text: "Home", link: "/" },
      { text: "Guides", link: "/guide/" },
      { text: "Wiki", link: "/wiki/" },
      { text: "GitHub", link: repositoryUrl }
    ],
    socialLinks: [
      { icon: "github", link: repositoryUrl }
    ],
    sidebar: {
      "/guide/": guideSidebar,
      "/wiki/": wikiSidebar
    },
    outline: {
      level: [2, 3],
      label: "On This Page"
    },
    editLink: {
      pattern: `${repositoryUrl}/edit/main/docs/:path`,
      text: "Edit this page on GitHub"
    },
    footer: {
      message: "Local-first documentation for Agent Tracer.",
      copyright: "Built from the markdown already living in this repository."
    }
  }
});
