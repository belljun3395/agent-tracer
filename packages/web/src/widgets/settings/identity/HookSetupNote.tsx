import { useState } from "react";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, GuidanceText } from "~web/shared/ui/index.js";

/** Claude Code hook 이벤트는 Claude Code 환경에 MONITOR_USER_EMAIL이 설정돼 있지 않으면 기본적으로 `local` 사용자로 기록된다. */
/** 현재 신원을 로컬 훅 환경에 연결하는 명령을 안내한다. */
export function HookSetupNote({ email }: { readonly email: string }) {
  const guidance = useGuidance();
  const [copied, setCopied] = useState(false);
  const snippet = [
    "// ~/.claude/settings.json",
    "{",
    '  "env": {',
    `    "MONITOR_USER_EMAIL": "${email}"`,
    "  }",
    "}",
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-hair">
      <label className="text-[12.5px] font-medium text-ink tracking-[-0.01em]">
        Connect Claude Code hooks
      </label>
      <GuidanceText
        as="p"
        className="text-[11.5px] text-ink-tertiary mt-0.5 mb-2"
        locale={guidance.locale}
        message={guidance.messages.settings.hookSetup(email)}
      />
      <pre className="bg-s1 text-ink py-3 px-3 rounded-xs text-[11.5px] font-mono overflow-x-auto m-0">
        {snippet}
      </pre>
      <div className="flex items-center gap-3 mt-2">
        <Button variant="ghost" onClick={() => void copy()} className="text-xs">
          {copied ? "Copied ✓" : "Copy snippet"}
        </Button>
        <span className="text-[11px] text-ink-tertiary">
          or shell: <code>export MONITOR_USER_EMAIL="{email}"</code>
        </span>
      </div>
    </div>
  );
}
