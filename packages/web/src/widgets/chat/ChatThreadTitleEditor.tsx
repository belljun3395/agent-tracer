import { useState } from "react";
import type { ChatThreadRecord } from "~web/entities/chat/model/chat.js";
import { chatThreadDisplayTitle } from "~web/entities/chat/model/chat.js";
import { useRenameThreadMutation } from "~web/entities/chat/api/mutations.js";
import { Button, IconButton, Input, PencilSimpleIcon } from "~web/shared/ui/index.js";

export function ChatThreadTitleEditor({ thread }: { readonly thread: ChatThreadRecord }) {
  const rename = useRenameThreadMutation(thread.id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chatThreadDisplayTitle(thread));

  const cancel = () => {
    setTitle(chatThreadDisplayTitle(thread));
    setEditing(false);
  };
  const save = () => {
    const next = title.trim();
    if (next.length === 0) return;
    rename.mutate(next, { onSuccess: () => setEditing(false) });
  };

  if (!editing) {
    return (
      <div className="group/title flex flex-1 min-w-0 items-center gap-1.5">
        <span className="text-[13px] font-medium text-ink min-w-0 truncate">
          {chatThreadDisplayTitle(thread)}
        </span>
        <IconButton
          aria-label="Rename conversation"
          className="shrink-0 opacity-0 group-hover/title:opacity-100 focus-visible:opacity-100"
          onClick={() => {
            setTitle(chatThreadDisplayTitle(thread));
            setEditing(true);
          }}
        >
          <PencilSimpleIcon />
        </IconButton>
      </div>
    );
  }

  return (
    <form
      className="flex flex-1 min-w-0 items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <Input
        autoFocus
        aria-label="Conversation title"
        className="h-7 min-w-0 text-[13px]"
        value={title}
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancel();
        }}
      />
      <Button type="submit" variant="primary" disabled={rename.isPending || title.trim().length === 0}>
        Save
      </Button>
      <Button type="button" variant="ghost" onClick={cancel} disabled={rename.isPending}>
        Cancel
      </Button>
    </form>
  );
}
