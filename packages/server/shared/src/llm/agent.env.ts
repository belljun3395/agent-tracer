const SAFE_ENV_KEYS = [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TZ",
    "TMPDIR",
    "TMP",
    "TEMP",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "no_proxy",
] as const;

/**
 * Builds the env passed to the Claude Agent SDK subprocess from a fixed
 * bootstrap allowlist plus explicit overrides, instead of forwarding the
 * whole process env (which would leak DB/Redis credentials etc. into any
 * tool the SDK ends up running).
 */
export function buildAgentEnv(
    overrides: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
    const base: Record<string, string | undefined> = {};
    for (const key of SAFE_ENV_KEYS) {
        const value = process.env[key];
        if (value !== undefined) base[key] = value;
    }
    return { ...base, ...overrides };
}
