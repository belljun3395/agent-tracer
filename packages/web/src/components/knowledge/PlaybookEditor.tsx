import type React from "react";
import { cn } from "../../lib/ui/cn.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { Textarea } from "../ui/Textarea.js";
import { tabButtonClass, editorFieldClass, SectionLabel } from "./helpers.js";
import type { EditorDraft, EditorMode } from "./helpers.js";

interface PlaybookEditorProps {
    readonly draft: EditorDraft;
    readonly mode: EditorMode | null;
    readonly isSaving: boolean;
    readonly saveError: string | null;
    readonly onChange: (update: Partial<EditorDraft>) => void;
    readonly onSave: () => void;
    readonly onCancel: () => void;
    readonly onStartCreate: () => void;
}

export function PlaybookEditor(props: PlaybookEditorProps): React.JSX.Element {
    const { draft, mode, isSaving, saveError, onChange, onSave, onCancel } = props;

    return (
        <div className="flex min-h-0 flex-col overflow-y-auto bg-[var(--surface-2)] p-4">
            <div className="mb-3 flex flex-col gap-1">
                <span className="text-[0.9rem] font-semibold text-[var(--text-1)]">
                    {mode === "edit" ? "Edit Playbook" : "Create Playbook"}
                </span>
                <span className="text-[0.76rem] leading-relaxed text-[var(--text-3)]">
                    {mode
                        ? "Turn a proven workflow into durable, reusable knowledge."
                        : "Select a snapshot to promote it, or create a playbook from scratch."}
                </span>
            </div>

            {mode ? (
                <div className="flex flex-col gap-3">
                    <div className={editorFieldClass}>
                        <SectionLabel>Title</SectionLabel>
                        <Input value={draft.title} onChange={(event) => { onChange({ title: event.target.value }); }}/>
                    </div>
                    <div className={editorFieldClass}>
                        <SectionLabel>Status</SectionLabel>
                        <div className="flex gap-1">
                            {(["draft", "active", "archived"] as const).map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    className={cn(tabButtonClass, draft.status === status
                                        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                                        : "border-[var(--border)] bg-transparent text-[var(--text-3)] hover:text-[var(--text-2)]")}
                                    onClick={() => { onChange({ status }); }}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className={editorFieldClass}>
                        <SectionLabel>When to Use</SectionLabel>
                        <Textarea rows={3} value={draft.whenToUse} onChange={(event) => { onChange({ whenToUse: event.target.value }); }}/>
                    </div>
                    <div className={editorFieldClass}>
                        <SectionLabel>Approach</SectionLabel>
                        <Textarea rows={4} value={draft.approach} onChange={(event) => { onChange({ approach: event.target.value }); }}/>
                    </div>
                    <div className={editorFieldClass}>
                        <SectionLabel>Prerequisites</SectionLabel>
                        <Textarea rows={4} placeholder="One item per line" value={draft.prerequisites} onChange={(event) => { onChange({ prerequisites: event.target.value }); }}/>
                    </div>
                    <div className={editorFieldClass}>
                        <SectionLabel>Key Steps</SectionLabel>
                        <Textarea rows={5} placeholder="One item per line" value={draft.keySteps} onChange={(event) => { onChange({ keySteps: event.target.value }); }}/>
                    </div>
                    <div className={editorFieldClass}>
                        <SectionLabel>Watchouts</SectionLabel>
                        <Textarea rows={4} placeholder="One item per line" value={draft.watchouts} onChange={(event) => { onChange({ watchouts: event.target.value }); }}/>
                    </div>
                    <div className={editorFieldClass}>
                        <SectionLabel>Anti-patterns</SectionLabel>
                        <Textarea rows={4} placeholder="One item per line" value={draft.antiPatterns} onChange={(event) => { onChange({ antiPatterns: event.target.value }); }}/>
                    </div>
                    <div className={editorFieldClass}>
                        <SectionLabel>Common Failure Modes</SectionLabel>
                        <Textarea rows={4} placeholder="One item per line" value={draft.failureModes} onChange={(event) => { onChange({ failureModes: event.target.value }); }}/>
                    </div>
                    <div className={editorFieldClass}>
                        <SectionLabel>Tags</SectionLabel>
                        <Input placeholder="comma, separated, tags" value={draft.tags} onChange={(event) => { onChange({ tags: event.target.value }); }}/>
                    </div>
                    {draft.sourceSnapshotIds.length > 0 ? (
                        <div className={editorFieldClass}>
                            <SectionLabel>Source Snapshots</SectionLabel>
                            <div className="flex flex-wrap gap-1">
                                {draft.sourceSnapshotIds.map((item) => (
                                    <Badge key={item} tone="accent" size="xs">{item}</Badge>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {saveError ? (
                        <p className="mt-1 text-[0.75rem] text-red-500">{saveError}</p>
                    ) : null}
                    <div className="mt-2 flex justify-end gap-2">
                        <Button size="sm" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button size="sm" disabled={!draft.title.trim() || isSaving} onClick={onSave}>
                            {isSaving ? "Saving…" : mode === "edit" ? "Update Playbook" : "Publish Playbook"}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-[0.8rem] leading-6 text-[var(--text-3)]">
                    Select a snapshot and click <strong>Promote to Playbook</strong>, or open the Playbooks tab and start a new playbook.
                </div>
            )}
        </div>
    );
}
