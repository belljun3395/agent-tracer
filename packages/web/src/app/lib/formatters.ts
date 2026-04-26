import type { EvidenceLevel } from "~domain/runtime.js";

export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) {
        return "0ms";
    }
    if (ms < 1000) {
        return `${Math.round(ms)}ms`;
    }
    const totalSeconds = ms / 1000;
    if (totalSeconds < 60) {
        return `${totalSeconds < 10 ? totalSeconds.toFixed(1) : Math.round(totalSeconds)}s`;
    }
    const totalMinutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    if (totalMinutes < 60) {
        return `${totalMinutes}m ${seconds}s`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}

export function formatRate(rate: number): string {
    if (!Number.isFinite(rate)) {
        return "0%";
    }
    const percent = rate <= 1 ? rate * 100 : rate;
    return Number.isInteger(percent) ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`;
}

export function formatCount(value: number): string {
    if (!Number.isFinite(value)) {
        return "0";
    }
    return value.toLocaleString();
}

export function formatPhaseLabel(phase: string): string {
    if (!phase) {
        return "Unknown";
    }
    return phase
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatEvidenceLevel(level: EvidenceLevel): string {
    switch (level) {
        case "proven":
            return "Proven";
        case "self_reported":
            return "Self Reported";
        case "inferred":
            return "Inferred";
        case "unavailable":
            return "Unavailable";
    }
}

export function evidenceTone(level: EvidenceLevel): "success" | "accent" | "warning" | "danger" | "neutral" {
    switch (level) {
        case "proven":
            return "success";
        case "self_reported":
            return "warning";
        case "inferred":
            return "accent";
        case "unavailable":
            return "danger";
    }
}
