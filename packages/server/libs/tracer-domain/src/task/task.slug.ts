/** 제목에서 URL에 쓸 수 있는 슬러그를 만들며, 투영과 개명 양쪽이 같은 규칙을 쓴다. */
export function deriveTaskSlug(title: string): string {
    const base = title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return base.length > 0 ? base : "task";
}
