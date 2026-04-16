import type React from "react";
import type { WorkflowContentRecord } from "@monitor/web-io";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { Eyebrow } from "../ui/Eyebrow.js";
import { SnapshotField, SnapshotList } from "./helpers.js";

interface SnapshotDetailProps {
    readonly content: WorkflowContentRecord;
    readonly onPromote: () => void;
}

export function SnapshotDetail({ content, onPromote }: SnapshotDetailProps): React.JSX.Element {
    const snapshot = content.workflowSnapshot;
    return (
        <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <span className="text-[0.74rem] font-semibold text-[var(--text-1)]">Snapshot</span>
                    <span className="text-[0.7rem] leading-relaxed text-[var(--text-3)]">
                        {content.source === "saved"
                            ? "Saved snapshot/context shown below."
                            : "No explicit override was saved, so this snapshot is generated from the task timeline."}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Badge tone="accent" size="xs">v{content.version}</Badge>
                    <Badge tone="neutral" size="xs">reuse {content.qualitySignals.reuseCount}</Badge>
                    {content.promotedTo ? <Badge tone="warning" size="xs">Promoted</Badge> : null}
                    <Button size="sm" onClick={onPromote}>Promote to Playbook</Button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <SnapshotField label="Objective" value={snapshot.objective}/>
                <SnapshotField label="Original Request" value={snapshot.originalRequest}/>
                <SnapshotField label="Outcome Summary" value={snapshot.outcomeSummary}/>
                <SnapshotField label="Approach Summary" value={snapshot.approachSummary}/>
                <SnapshotField label="Reuse When" value={snapshot.reuseWhen}/>
                <SnapshotField label="Verification Summary" value={snapshot.verificationSummary}/>
                <SnapshotField label="Search Text" value={snapshot.searchText}/>
                <SnapshotList label="Key Decisions" items={snapshot.keyDecisions}/>
                <SnapshotList label="Next Steps" items={snapshot.nextSteps}/>
                <SnapshotList label="Watch Items" items={snapshot.watchItems}/>
                <SnapshotList label="Key Files" items={snapshot.keyFiles}/>
                <SnapshotList label="Modified Files" items={snapshot.modifiedFiles}/>
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
                <Eyebrow>Snapshot Context</Eyebrow>
                <pre className="m-0 max-h-[30rem] overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[0.76rem] leading-6 text-[var(--text-2)]">
                    {content.workflowContext}
                </pre>
            </div>
        </div>
    );
}
