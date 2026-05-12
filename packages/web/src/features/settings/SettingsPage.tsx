import { useMemo, useState } from "react";
import { useAppSettingsQuery } from "~state/server/queries.js";
import {
  useDeleteAppSettingMutation,
  usePutAppSettingMutation,
} from "~state/server/mutations.js";

const SETTING_KEYS = {
  apiKey: "anthropic.api_key",
  model: "anthropic.model",
  maxRulesPerTask: "ruleGen.maxRulesPerTask",
} as const;

const MODEL_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fast / cheap)" },
  { value: "claude-opus-4-7", label: "Claude Opus 4.7 (most capable)" },
];

/**
 * `/settings` — local monitor configuration. Today: rule auto-generation
 * (Anthropic API key + model + max rules per task). All values live in the
 * `app_settings` table on the monitor server.
 *
 * The API key is stored as plain text in the local SQLite DB. This is an
 * intentional choice for a 1-user local tool — protect the DB file via OS
 * permissions instead of in-DB encryption.
 */
export function SettingsPage() {
  const { data, isLoading } = useAppSettingsQuery();
  const putMutation = usePutAppSettingMutation();
  const deleteMutation = useDeleteAppSettingMutation();

  const settingsMap = useMemo(() => {
    const map = new Map<string, { masked: string; updatedAt: string }>();
    for (const item of data?.settings ?? []) {
      map.set(item.key, { masked: item.maskedValue, updatedAt: item.updatedAt });
    }
    return map;
  }, [data]);

  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [modelDraft, setModelDraft] = useState("");
  const [maxRulesDraft, setMaxRulesDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const apiKey = settingsMap.get(SETTING_KEYS.apiKey);
  const model = settingsMap.get(SETTING_KEYS.model);
  const maxRules = settingsMap.get(SETTING_KEYS.maxRulesPerTask);

  async function save(key: string, value: string, draftSetter: (v: string) => void) {
    if (!value.trim()) {
      setFeedback("Value cannot be empty.");
      return;
    }
    try {
      await putMutation.mutateAsync({ key, value: value.trim() });
      draftSetter("");
      setFeedback(`Saved ${key}.`);
    } catch (err) {
      setFeedback(`Failed to save ${key}: ${(err as Error).message}`);
    }
  }

  async function remove(key: string) {
    try {
      await deleteMutation.mutateAsync(key);
      setFeedback(`Cleared ${key}.`);
    } catch (err) {
      setFeedback(`Failed to clear ${key}: ${(err as Error).message}`);
    }
  }

  return (
    <div
      className="flex flex-col min-h-0"
      style={{ height: "100%", overflow: "auto" }}
    >
      <header
        className="px-9 pt-6 pb-4 flex flex-col gap-2"
        style={{ borderBottom: "1px solid var(--hair)" }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-tertiary)",
          }}
        >
          Settings
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>
          Local monitor configuration
        </h1>
        <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>
          Values are stored in the monitor's SQLite DB on this machine.
          Sensitive values (API keys) are shown masked after save — re-enter to
          replace.
        </p>
      </header>

      <main className="px-9 py-6 flex flex-col gap-6 max-w-3xl">
        <section
          style={{
            border: "1px solid var(--hair)",
            borderRadius: "var(--radius-md)",
            background: "var(--canvas)",
            padding: "20px 24px",
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            Rule auto-generation
          </h2>
          <p style={{ color: "var(--ink-muted)", fontSize: 12.5, marginBottom: 20 }}>
            Required to use the "Generate rules" button in the inspector.
            Without an API key, only the <code>/generate-rules</code> slash command
            (which uses Claude Code's own auth) works.
          </p>

          <Row
            label="Anthropic API key"
            help="Used by the server-side SDK Agent to propose rules for a completed task."
          >
            {isLoading ? (
              <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading…</span>
            ) : apiKey ? (
              <div className="flex items-center gap-2 min-w-0">
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    padding: "4px 8px",
                    background: "var(--s1)",
                    borderRadius: "var(--radius-xs)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 240,
                  }}
                >
                  {apiKey.masked}
                </code>
                <span
                  style={{
                    color: "var(--ink-tertiary)",
                    fontSize: 11,
                    whiteSpace: "nowrap",
                  }}
                >
                  saved {new Date(apiKey.updatedAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => void remove(SETTING_KEYS.apiKey)}
                  className="text-xs"
                  style={{
                    color: "var(--ink-muted)",
                    textDecoration: "underline",
                  }}
                >
                  Clear
                </button>
              </div>
            ) : (
              <span style={{ color: "var(--ink-tertiary)", fontSize: 12.5 }}>
                Not set
              </span>
            )}
            <div className="flex gap-2 mt-2">
              <input
                type="password"
                placeholder="sk-ant-..."
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="flex-1 px-3 py-1.5 text-sm"
                style={{
                  border: "1px solid var(--hair)",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--canvas)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-mono)",
                }}
              />
              <button
                type="button"
                disabled={!apiKeyDraft.trim() || putMutation.isPending}
                onClick={() =>
                  void save(SETTING_KEYS.apiKey, apiKeyDraft, setApiKeyDraft)
                }
                className="px-3 py-1.5 text-sm"
                style={{
                  border: "1px solid var(--hair)",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--ink)",
                  color: "var(--canvas)",
                  cursor:
                    !apiKeyDraft.trim() || putMutation.isPending
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    !apiKeyDraft.trim() || putMutation.isPending ? 0.5 : 1,
                }}
              >
                {apiKey ? "Replace" : "Save"}
              </button>
            </div>
          </Row>

          <Row label="Model" help="Used for rule generation.">
            <div className="flex items-center gap-2">
              <select
                value={modelDraft || model?.masked || ""}
                onChange={(e) => setModelDraft(e.target.value)}
                className="px-2 py-1 text-sm"
                style={{
                  border: "1px solid var(--hair)",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--canvas)",
                  color: "var(--ink)",
                }}
              >
                <option value="">{model ? model.masked : "(default)"}</option>
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!modelDraft.trim() || putMutation.isPending}
                onClick={() =>
                  void save(SETTING_KEYS.model, modelDraft, setModelDraft)
                }
                className="px-3 py-1 text-sm"
                style={{
                  border: "1px solid var(--hair)",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--canvas)",
                  color: "var(--ink)",
                  opacity:
                    !modelDraft.trim() || putMutation.isPending ? 0.5 : 1,
                }}
              >
                Save
              </button>
              {model && (
                <button
                  type="button"
                  onClick={() => void remove(SETTING_KEYS.model)}
                  className="text-xs"
                  style={{ color: "var(--ink-muted)", textDecoration: "underline" }}
                >
                  Clear
                </button>
              )}
            </div>
          </Row>

          <Row
            label="Max rules per task"
            help="Upper bound for /generate-rules output. Default 5."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                placeholder={maxRules?.masked ?? "5"}
                value={maxRulesDraft}
                onChange={(e) => setMaxRulesDraft(e.target.value)}
                className="w-20 px-2 py-1 text-sm"
                style={{
                  border: "1px solid var(--hair)",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--canvas)",
                  color: "var(--ink)",
                }}
              />
              <button
                type="button"
                disabled={!maxRulesDraft.trim() || putMutation.isPending}
                onClick={() =>
                  void save(
                    SETTING_KEYS.maxRulesPerTask,
                    maxRulesDraft,
                    setMaxRulesDraft,
                  )
                }
                className="px-3 py-1 text-sm"
                style={{
                  border: "1px solid var(--hair)",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--canvas)",
                  color: "var(--ink)",
                  opacity:
                    !maxRulesDraft.trim() || putMutation.isPending ? 0.5 : 1,
                }}
              >
                Save
              </button>
              {maxRules && (
                <button
                  type="button"
                  onClick={() => void remove(SETTING_KEYS.maxRulesPerTask)}
                  className="text-xs"
                  style={{ color: "var(--ink-muted)", textDecoration: "underline" }}
                >
                  Clear
                </button>
              )}
            </div>
          </Row>

          {feedback && (
            <p
              style={{
                marginTop: 16,
                fontSize: 12,
                color: feedback.startsWith("Failed")
                  ? "var(--danger, #ff8585)"
                  : "var(--ink-muted)",
              }}
            >
              {feedback}
            </p>
          )}
        </section>

        <section
          style={{
            border: "1px solid var(--hair)",
            borderRadius: "var(--radius-md)",
            padding: "16px 20px",
            background: "var(--s1)",
            fontSize: 12.5,
            color: "var(--ink-muted)",
          }}
        >
          <strong style={{ color: "var(--ink)" }}>Security note</strong>
          <p style={{ marginTop: 6 }}>
            The API key is stored as plain text in the monitor's local SQLite
            database. This is intentional for a 1-user local tool — protect the
            DB file via OS permissions (e.g. <code>chmod 600</code>) rather
            than relying on in-DB encryption. Never commit the DB file or share
            it.
          </p>
        </section>
      </main>
    </div>
  );
}

function Row({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        paddingTop: 16,
        paddingBottom: 16,
        borderTop: "1px solid var(--hair-soft, var(--hair))",
      }}
    >
      <div>
        <label
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </label>
        {help && (
          <p
            style={{
              fontSize: 11.5,
              color: "var(--ink-tertiary)",
              marginTop: 2,
            }}
          >
            {help}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
