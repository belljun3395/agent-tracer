import {
  useGuidance,
  useGuidanceLocale,
  useSetGuidanceLocale,
} from "~web/shared/store/index.js";
import { Card, Field, Select } from "~web/shared/ui/index.js";

/** 브라우저 안내 문구의 표시 언어를 설정한다. */
export function GuidanceLanguageSection() {
  const guidance = useGuidance();
  const locale = useGuidanceLocale();
  const setLocale = useSetGuidanceLocale();

  return (
    <Card surface="canvas" className="py-5 px-6">
      <h2 className="text-[15px] font-semibold mb-1">Display</h2>
      <Field
        label="Guidance language"
        help={guidance.messages.settings.guidanceLanguage}
        helpLocale={locale}
      >
        <Select
          aria-label="Guidance language"
          value={locale}
          onChange={(event) => setLocale(event.target.value === "ko" ? "ko" : "en")}
        >
          <option value="en">English</option>
          <option value="ko">Korean</option>
        </Select>
      </Field>
    </Card>
  );
}
