import type { Theme } from "vitepress";
import { inBrowser, onContentUpdated } from "vitepress";
import DefaultTheme from "vitepress/theme";
import "./custom.css";
let mermaidApiPromise: Promise<typeof import("mermaid").default> | null = null;
let mermaidRenderSerial = 0;
let mermaidHooksInstalled = false;
function getMermaidTheme(): "default" | "dark" {
    return document.documentElement.classList.contains("dark") ? "dark" : "default";
}
async function getMermaidApi() {
    if (!mermaidApiPromise) {
        mermaidApiPromise = import("mermaid").then((module) => module.default);
    }
    return mermaidApiPromise;
}
async function renderMermaidBlocks(): Promise<void> {
    if (!inBrowser) {
        return;
    }
    const mermaidBlocks = Array.from(document.querySelectorAll<HTMLElement>(".vp-doc div.language-mermaid"));
    if (mermaidBlocks.length === 0) {
        return;
    }
    const mermaid = await getMermaidApi();
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: getMermaidTheme()
    });
    await Promise.all(mermaidBlocks.map(async (block) => {
        const code = block.querySelector("code")?.textContent?.trim();
        if (!code) {
            return;
        }
        block.classList.add("mermaid-block");
        const output = block.querySelector<HTMLElement>(".mermaid-output") ?? document.createElement("div");
        output.className = "mermaid-output";
        const errorNotice = block.querySelector<HTMLElement>(".mermaid-error-message") ?? document.createElement("p");
        errorNotice.className = "mermaid-error-message";
        errorNotice.hidden = true;
        if (!output.parentElement) {
            block.append(output);
        }
        if (!errorNotice.parentElement) {
            block.append(errorNotice);
        }
        try {
            const { svg, bindFunctions } = await mermaid.render(`mermaid-diagram-${mermaidRenderSerial += 1}`, code);
            output.innerHTML = svg;
            output.hidden = false;
            errorNotice.hidden = true;
            errorNotice.textContent = "";
            block.dataset.mermaidRendered = "true";
            bindFunctions?.(output);
        }
        catch (error) {
            output.innerHTML = "";
            output.hidden = true;
            errorNotice.hidden = false;
            errorNotice.textContent =
                error instanceof Error ? error.message : "Unable to render Mermaid diagram.";
            delete block.dataset.mermaidRendered;
        }
    }));
}
function installMermaidHooks(): void {
    if (!inBrowser || mermaidHooksInstalled) {
        return;
    }
    mermaidHooksInstalled = true;
    onContentUpdated(() => {
        void renderMermaidBlocks();
    });
    const themeObserver = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.attributeName === "class")) {
            void renderMermaidBlocks();
        }
    });
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"]
    });
    void renderMermaidBlocks();
}
export default {
    extends: DefaultTheme,
    enhanceApp() {
        installMermaidHooks();
    }
} satisfies Theme;
