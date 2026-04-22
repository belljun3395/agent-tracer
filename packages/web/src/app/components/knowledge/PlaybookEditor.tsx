import type React from "react";
import { cn } from "../../lib/ui/cn.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { Textarea } from "../ui/Textarea.js";
import { editorFieldClass, SectionLabel, tabButtonClass } from "./primitives.js";
import type { EditorDraft, EditorMode } from "./types.js";

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
    const { draft, mode, isSaving, saveError, onChange, onSave, onCancel, onStartCreate } = props;

    return (
        <div className="flex min-h-0 flex-col overflow-y-auto bg-[color-mix(in_srgb,var(--surface-2)_72%,var(--bg))] p-3.5">
            <div className="mb-3 flex flex-col gap-1">
                <span className="text-[0.84rem] font-semibold text-[var(--text-1)]">
                    {mode === "edit" ? "Edit Playbook" : "Create Playbook"}
                </span>
                <span className="text-[0.72rem] leading-relaxed text-[var(--text-3)]">
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
                        <p className="mt-1 text-[0.72rem] text-red-500">{saveError}</p>
                    ) : null}
                    <div className="mt-2 flex justify-end gap-2">
                        <Button size="sm" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button size="sm" variant="accent" disabled={!draft.title.trim() || isSaving} onClick={onSave}>
                            {isSaving ? "Saving…" : mode === "edit" ? "Update" : "Publish"}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex min-h-[10rem] flex-col items-start justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_90%,var(--bg))] px-4 py-5">
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)]">
                        <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
                            <path d="M12 5v14"/>
                            <path d="M5 12h14"/>
                        </svg>
                    </div>
                    <p className="m-0 text-[0.82rem] font-semibold text-[var(--text-1)]">Ready for a reusable workflow</p>
                    <p className="m-0 mt-1 text-[0.74rem] leading-6 text-[var(--text-3)]">
                        Select a snapshot to promote it, or start a clean playbook draft.
                    </p>
                    <Button className="mt-4" size="sm" variant="accent" onClick={onStartCreate}>
                        Create Playbook
                    </Button>
                </div>
            )}
        </div>
    );
}
