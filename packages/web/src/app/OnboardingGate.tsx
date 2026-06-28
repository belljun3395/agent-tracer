import { useState, type ReactNode } from "react";
import { getUserId, onboardUser } from "../io/api.js";

/**
 * 최초 사용 시 이메일을 받아 온보딩한다. userId 가 없으면 이메일 입력 화면을,
 * 있으면 자식(앱)을 렌더한다. 온보딩 결과 userId 는 io 계층이 보관하고 이후
 * 모든 요청에 X-User-Id 로 실린다. 온보딩 직후에는 Claude Code 훅을 같은
 * 신원으로 잇는 MONITOR_USER_EMAIL 설정 안내를 한 번 보여준다.
 */
export function OnboardingGate({ children }: { readonly children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(() => getUserId());
  const [pending, setPending] = useState<{ userId: string; email: string } | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (userId) return <>{children}</>;

  async function submit(): Promise<void> {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onboardUser(trimmed);
      setPending({ userId: result.userId, email: trimmed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "온보딩에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pending) {
    return <HookSetup email={pending.email} onContinue={() => setUserId(pending.userId)} />;
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: "320px",
        }}
      >
        <h1 style={{ fontSize: "1.1rem", margin: 0 }}>Agent Tracer 시작하기</h1>
        <p style={{ fontSize: "0.85rem", opacity: 0.8, margin: 0 }}>
          사용을 구분할 이메일을 입력하세요.
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
        />
        <button type="submit" disabled={submitting} style={{ padding: "0.5rem" }}>
          {submitting ? "처리 중…" : "시작"}
        </button>
        {error ? (
          <p style={{ color: "#c0392b", fontSize: "0.8rem", margin: 0 }}>{error}</p>
        ) : null}
      </form>
    </div>
  );
}

/**
 * 온보딩 직후 화면. Claude Code 훅 이벤트가 이 이메일과 같은 신원으로 집계되도록
 * MONITOR_USER_EMAIL 설정 방법을 안내한다. 미설정 시 훅 이벤트는 local 사용자로 들어간다.
 */
function HookSetup({
  email,
  onContinue,
}: {
  readonly email: string;
  readonly onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const settingsSnippet = [
    "// ~/.claude/settings.json",
    "{",
    '  "env": {',
    `    "MONITOR_USER_EMAIL": "${email}"`,
    "  }",
    "}",
  ].join("\n");

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(settingsSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: "440px",
        }}
      >
        <h1 style={{ fontSize: "1.1rem", margin: 0 }}>거의 다 됐어요 — Claude Code 훅 연결</h1>
        <p style={{ fontSize: "0.85rem", opacity: 0.8, margin: 0 }}>
          Claude Code 활동이 <b>{email}</b> 로 집계되도록, Claude Code 실행 환경에 아래를
          설정하세요. 설정 전 활동은 <code>local</code> 사용자로 들어갑니다.
        </p>
        <pre
          style={{
            background: "#1e1e1e",
            color: "#eee",
            padding: "0.75rem",
            borderRadius: "6px",
            fontSize: "0.78rem",
            overflowX: "auto",
            margin: 0,
          }}
        >
          {settingsSnippet}
        </pre>
        <p style={{ fontSize: "0.78rem", opacity: 0.7, margin: 0 }}>
          또는 셸에서: <code>export MONITOR_USER_EMAIL="{email}"</code>
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" onClick={() => void copy()} style={{ padding: "0.5rem", flex: 1 }}>
            {copied ? "복사됨 ✓" : "설정 복사"}
          </button>
          <button type="button" onClick={onContinue} style={{ padding: "0.5rem", flex: 1 }}>
            계속
          </button>
        </div>
      </div>
    </div>
  );
}
