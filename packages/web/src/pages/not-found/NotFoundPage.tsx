import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center text-center">
      <div>
        <div className="font-mono text-[10.5px] text-ink-tertiary uppercase tracking-[0.1em]">
          404
        </div>
        <h1 className="mt-2 m-0 text-[22px] font-semibold">
          Page not found
        </h1>
        <Link
          to="/tasks"
          className="mt-3 inline-block text-primary-hover text-sm border-b border-dotted border-primary"
        >
          Back to tasks
        </Link>
      </div>
    </div>
  );
}
