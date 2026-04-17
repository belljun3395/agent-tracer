import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvidenceTab } from "./EvidenceTab.js";

describe("EvidenceTab", () => {
    it("shows exploration first, keeps web lookups and mentioned files, and removes tag explorer", () => {
        const markup = renderToStaticMarkup(
            <EvidenceTab
                sortedFileEvidence={[
                    {
                        path: "/workspace/src/app.ts",
                        readCount: 1,
                        writeCount: 1,
                        explorationCount: 2,
                        firstSeenAt: "2026-04-17T10:00:00.000Z",
                        lastSeenAt: "2026-04-17T10:10:00.000Z",
                        compactRelation: "after-compact"
                    }
                ]}
                workspacePath="/workspace"
                isFileEvidenceExpanded
                fileEvidenceSortKey="recent"
                explorationInsight={{
                    totalExplorations: 3,
                    uniqueFiles: 1,
                    uniqueWebLookups: 1,
                    toolBreakdown: { rg: 2 },
                    preCompactFiles: 0,
                    postCompactFiles: 1,
                    acrossCompactFiles: 0,
                    preCompactWebLookups: 0,
                    postCompactWebLookups: 1,
                    acrossCompactWebLookups: 0,
                    firstExplorationAt: "2026-04-17T10:00:00.000Z",
                    lastExplorationAt: "2026-04-17T10:12:00.000Z"
                }}
                webLookups={[
                    {
                        url: "https://example.com",
                        toolName: "open",
                        count: 1,
                        firstSeenAt: "2026-04-17T10:11:00.000Z",
                        lastSeenAt: "2026-04-17T10:11:00.000Z",
                        compactRelation: "after-compact"
                    }
                ]}
                mentionedVerifications={[]}
                onToggleFileEvidence={() => undefined}
                onFileEvidenceSortChange={() => undefined}
            />
        );

        expect(markup).not.toContain("Tag Explorer");
        expect(markup).toContain("Exploration Overview");
        expect(markup).toContain("Web Lookups");
        expect(markup).toContain("@ Mentioned Files");
        expect(markup).toContain("Files");
        expect(markup.indexOf("Exploration Overview")).toBeLessThan(markup.indexOf("Files"));
        expect(markup.indexOf("Files")).toBeLessThan(markup.indexOf("Web Lookups"));
    });
});
