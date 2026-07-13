import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText } from "~web/shared/ui/index.js";
import { DaemonHealthSection } from "~web/widgets/settings/daemon/DaemonHealthSection.js";
import { GuidanceLanguageSection } from "~web/widgets/settings/display/GuidanceLanguageSection.js";
import { IdentitySection } from "~web/widgets/settings/identity/IdentitySection.js";
import { RuleGenerationSection } from "~web/widgets/settings/rule-generation/RuleGenerationSection.js";

/**
 * 서버 설정과 브라우저 전용 표시 설정을 한 화면에서 구분해 제공한다.
 */
export function SettingsPage() {
  const guidance = useGuidance();

  return (
    <div className="flex flex-col min-h-0 h-full overflow-auto">
      <header className="px-9 pt-6 pb-4 flex flex-col gap-2 border-b border-hair">
        <p className="text-[11px] tracking-[0.08em] uppercase text-ink-tertiary">
          Settings
        </p>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">
          Local monitor configuration
        </h1>
        <GuidanceText
          as="p"
          className="text-ink-muted text-sm"
          locale={guidance.locale}
          message={guidance.messages.settings.introduction}
        />
      </header>

      <main className="px-9 py-6 flex flex-col gap-6 max-w-3xl">
        <IdentitySection />
        <GuidanceLanguageSection />
        <RuleGenerationSection />
        <DaemonHealthSection />

        <section className="border border-hair rounded-md py-4 px-5 bg-s1 text-[12.5px] text-ink-muted">
          <strong className="text-ink">Security note</strong>
          <GuidanceText
            as="p"
            className="mt-1.5"
            locale={guidance.locale}
            message={guidance.messages.settings.securityNote}
          />
        </section>
      </main>
    </div>
  );
}
