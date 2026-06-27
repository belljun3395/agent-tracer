import { useState, type ReactNode } from "react";
import { getUserId, onboardUser } from "../io/api.js";

/**
 * 최초 사용 시 이메일을 받아 온보딩한다. userId 가 없으면 이메일 입력 화면을,
 * 있으면 자식(앱)을 렌더한다. 온보딩 결과 userId 는 io 계층이 보관하고 이후
 * 모든 요청에 X-User-Id 로 실린다.
 */
export function OnboardingGate({ children }: { readonly children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(() => getUserId());
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
      setUserId(result.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "온보딩에 실패했습니다.");
    } finally {
      setSubmitting(false);
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
