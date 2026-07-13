import type { VerificationOverlayEntry } from "~web/entities/task/model/timeline/verification-overlay.js";

interface EventVerificationSectionProps {
  readonly entry: VerificationOverlayEntry | undefined;
}

export function EventVerificationSection({
  entry,
}: EventVerificationSectionProps) {
  if (!entry || entry.verifications.length === 0) return null;

  const count = entry.verifications.length;

  return (
    <section
      aria-label="Event verifications"
      className="mt-3 rounded-sm border border-hair bg-s2 px-3 py-2.5"
    >
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ph-veri">
        <span>Verified by</span>
        <span className="text-ink-muted normal-case tracking-normal">
          {count} {count === 1 ? "rule" : "rules"}
        </span>
        {!entry.moveToVeri && (
          <span className="ml-auto rounded-pill border border-hair px-1.5 py-px text-[9px] normal-case tracking-normal text-ink-tertiary">
            Absence check anchor
          </span>
        )}
      </div>
      <ul className="mt-2 m-0 list-none p-0 flex flex-col gap-1">
        {entry.verifications.map((verification) => (
          <li
            key={verification.id}
            className="flex items-start gap-2 text-[11.5px] leading-4 text-ink"
          >
            <span aria-hidden className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-ph-veri" />
            <span>{verification.ruleName}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
