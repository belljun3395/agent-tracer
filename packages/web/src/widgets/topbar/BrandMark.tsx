import { Link } from "react-router-dom";

/** topbar 맨 왼쪽 요소. */
export function BrandMark() {
  return (
    <Link
      to="/tasks"
      aria-label="Go to task list"
      className="flex items-center gap-2.5 shrink-0 no-underline"
      style={{ minWidth: 248 }}
    >
      <div className="flex items-center justify-center w-[22px] h-[22px] rounded-sm bg-primary text-white text-xs font-semibold tracking-[-0.04em]">
        A
      </div>
      <div className="text-[13.5px] font-medium tracking-[-0.2px] text-ink">
        Agent Tracer
      </div>
    </Link>
  );
}
