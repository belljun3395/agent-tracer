export async function copyToClipboard(value: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    }
    catch {
        return copyTextFallback(value);
    }
}
function copyTextFallback(value: string): boolean {
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.setAttribute("readonly", "true");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    try {
        return document.execCommand("copy");
    }
    finally {
        document.body.removeChild(textArea);
    }
}
