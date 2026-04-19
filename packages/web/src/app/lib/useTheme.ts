import { useEffect, useState } from "react";
type Theme = "light" | "dark";
const STORAGE_KEY = "agent-tracer.theme";
function getInitialTheme(): Theme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark")
            return stored;
    }
    catch {
        void 0;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function useTheme(): {
    theme: Theme;
    toggle: () => void;
} {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        }
        catch {
            void 0;
        }
    }, [theme]);
    return {
        theme,
        toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark"))
    };
}
