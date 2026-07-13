import type { ActVm } from "~web/widgets/feed/lib/timeline/act-classification.js";

interface ActHeaderProps {
  readonly vm: ActVm;
}

/** act 카드의 상단 행. */
export function ActHeader({ vm }: ActHeaderProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className="inline-flex items-center rounded-xs px-1.5 font-mono text-[9.5px] font-semibold tracking-[0.08em] leading-4"
        style={{
          color: vm.lane.cssColor,
          background: `color-mix(in srgb, ${vm.lane.cssColor} 14%, transparent)`,
        }}
      >
        {vm.lane.label}
      </span>
      <span className="font-mono text-[11.5px] text-ink font-medium tracking-[-0.05px]">
        {vm.toolName}
      </span>
      {vm.hasViolation && (
        <span className="ml-auto rounded-xs px-1.5 font-mono text-[10.5px] text-err bg-err/14 tracking-[0.02em]">
          viol
        </span>
      )}
    </div>
  );
}
