import type React from "react";
import type { PlaybookRecordResponse } from "@monitor/web-core";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { SnapshotField, SnapshotList } from "./helpers.js";

interface PlaybookDetailViewProps {
    readonly playbook: PlaybookRecordResponse;
    readonly onEdit: () => void;
}

export function PlaybookDetailView({ playbook, onEdit }: PlaybookDetailViewProps): React.JSX.Element {
    return (
        <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <span className="text-[0.74rem] font-semibold text-[var(--text-1)]">Playbook</span>
                    <span className="text-[0.7rem] leading-relaxed text-[var(--text-3)]">
                        Curated knowledge for repeating this kind of work.
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Badge tone={playbook.status === "active" ? "warning" : playbook.status === "draft" ? "accent" : "neutral"} size="xs">
                        {playbook.status}
                    </Badge>
                    <Badge tone="neutral" size="xs">used {playbook.useCount}</Badge>
                    <Button size="sm" onClick={onEdit}>Edit</Button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <SnapshotField label="When to Use" value={playbook.whenToUse}/>
                <SnapshotField label="Approach" value={playbook.approach}/>
                <SnapshotField label="Search Text" value={playbook.searchText}/>
                <SnapshotList label="Prerequisites" items={playbook.prerequisites}/>
                <SnapshotList label="Key Steps" items={playbook.keySteps}/>
                <SnapshotList label="Watchouts" items={playbook.watchouts}/>
                <SnapshotList label="Anti-patterns" items={playbook.antiPatterns}/>
                <SnapshotList label="Common Failure Modes" items={playbook.failureModes}/>
                <SnapshotList label="Related Playbooks" items={playbook.relatedPlaybookIds}/>
                <SnapshotList label="Source Snapshots" items={playbook.sourceSnapshotIds}/>
            </div>
        </div>
    );
}
