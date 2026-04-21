import { defineConfig } from "vitepress";
const repositoryUrl = "https://github.com/belljun3395/agent-tracer";
function normalizeBasePath(base: string): string {
    if (base === "/") {
        return base;
    }
    const prefixed = base.startsWith("/") ? base : `/${base}`;
    return prefixed.endsWith("/") ? prefixed : `${prefixed}/`;
}
const docsBase = normalizeBasePath(process.env.DOCS_BASE ?? "/");
const enableLastUpdated = process.env.DOCS_LAST_UPDATED !== "false";
const guideSidebar = [
    {
        text: "Guide Home",
        items: [
            { text: "Setup Guides", link: "/guide/" },
            { text: "Install and Run", link: "/guide/install-and-run" },
            { text: "External Project Setup", link: "/guide/external-setup" },
            { text: "Claude Code Setup", link: "/guide/claude-setup" }
        ]
    },
    {
        text: "Reference",
        items: [
            { text: "Runtime Capabilities", link: "/guide/runtime-capabilities" },
            { text: "API Integration Map", link: "/guide/api-integration-map" },
            { text: "Claude Hook Payload Spec", link: "/guide/hook-payload-spec" },
            { text: "Runtime API Flow", link: "/guide/runtime-api-flow-and-preprocessing" },
            { text: "Task Observability", link: "/guide/task-observability" },
            { text: "SQLite Schema", link: "/guide/sqlite-schema" },
            { text: "Analytics Tier", link: "/guide/analytics-tier" },
            { text: "BI Analysis Design", link: "/guide/bi-analysis-design" },
            { text: "DuckDB Analytics Schema", link: "/guide/duckdb-analytics-schema" },
            { text: "Web Styling Guide", link: "/guide/web-styling" }
        ]
    }
];
export default defineConfig({
    base: docsBase,
    title: "Agent Tracer",
    description: "Runtime setup guides and reference notes for Agent Tracer.",
    cleanUrls: true,
    lastUpdated: enableLastUpdated,
    appearance: true,
    head: [
        ["meta", { name: "theme-color", content: "#b45309" }]
    ],
    themeConfig: {
        siteTitle: "Agent Tracer Docs",
        search: {
            provider: "local"
        },
        nav: [
            { text: "Home", link: "/" },
            { text: "Guides", link: "/guide/" },
            { text: "GitHub", link: repositoryUrl }
        ],
        socialLinks: [
            { icon: "github", link: repositoryUrl }
        ],
        sidebar: {
            "/guide/": guideSidebar
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
