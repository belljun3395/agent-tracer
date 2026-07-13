import { useState } from "react";
import { onboardUser } from "~web/entities/user/api/onboard-user.js";
import {
  clearUserIdentity,
  getUserEmail,
  getUserId,
} from "~web/shared/api/user-identity.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, Card, Field, GuidanceText, Input, Modal } from "~web/shared/ui/index.js";
import { HookSetupNote } from "~web/widgets/settings/identity/HookSetupNote.js";

/** 사용자 신원. */
/** 브라우저 요청과 로컬 훅이 공유할 사용자 신원을 설정한다. */
export function IdentitySection() {
  const guidance = useGuidance();
  const userId = getUserId();
  const email = getUserEmail();
  const isLocal = userId === null;

  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  async function onboard() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await onboardUser(trimmed);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set identity.");
      setSubmitting(false);
    }
  }

  function reset() {
    clearUserIdentity();
    window.location.reload();
  }

  return (
    <Card surface="canvas" className="py-5 px-6">
      <h2 className="text-[15px] font-semibold mb-1">User identity</h2>
      <GuidanceText
        as="p"
        className="text-ink-muted text-[12.5px] mb-5"
        locale={guidance.locale}
        message={guidance.messages.settings.identityIntroduction}
      />

      <Field
        label="Current identity"
        help={guidance.messages.settings.identityStorage}
        helpLocale={guidance.locale}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {isLocal ? (
            <>
              <code className="font-mono text-xs py-1 px-2 bg-s1 rounded-xs">
                local
              </code>
              <span className="text-ink-tertiary text-[11px]">
                default — no email set
              </span>
            </>
          ) : (
            <>
              <code className="font-mono text-xs py-1 px-2 bg-s1 rounded-xs">
                {email ?? userId}
              </code>
              <span className="text-ink-tertiary text-[11px] whitespace-nowrap">
                id {userId}
              </span>
              <Button variant="ghost" onClick={() => setResetOpen(true)} className="text-xs border-0 p-0 underline">
                Reset to local
              </Button>
            </>
          )}
        </div>

        <div className="flex gap-2 mt-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") void onboard();
            }}
            className="flex-1 font-mono"
          />
          <Button
            variant="solid"
            disabled={!draft.trim() || submitting}
            onClick={() => void onboard()}
          >
            {submitting ? "Saving…" : isLocal ? "Set" : "Change"}
          </Button>
        </div>
        {error && <p className="text-err text-xs mt-2">{error}</p>}
      </Field>

      {!isLocal && email && <HookSetupNote email={email} />}

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset to local?"
        description={guidance.messages.settings.identityReset}
        descriptionLocale={guidance.locale}
      >
        <div className="flex justify-end gap-2 p-4">
          <Button onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={reset}>Reset identity</Button>
        </div>
      </Modal>
    </Card>
  );
}
