import type React from "react";
import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KnowledgeBaseContent } from "../components/knowledge/KnowledgeBaseContent.js";

export function KnowledgeBasePage(): React.JSX.Element {
    const navigate = useNavigate();

    const handleSelectTask = useCallback((taskId: string): void => {
        void navigate(`/?task=${encodeURIComponent(taskId)}`);
    }, [navigate]);

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">
            <div className="flex h-10 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4">
                <Link
                    to="/"
                    className="flex items-center gap-1.5 text-[0.78rem] text-[var(--text-3)] transition-colors hover:text-[var(--text-2)]"
                >
                    <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="13">
                        <path d="M15 18l-6-6 6-6"/>
                    </svg>
                    <span>Dashboard</span>
                </Link>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <KnowledgeBaseContent onSelectTask={handleSelectTask} />
            </div>
        </div>
    );
}
