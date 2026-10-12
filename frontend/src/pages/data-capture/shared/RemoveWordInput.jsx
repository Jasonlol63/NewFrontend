import { useTranslation } from "react-i18next";
import { TextInput } from "@/components/shared/form-modal/fields.jsx";
import { normalizeRemoveWords } from "./removeWordRules";

/**
 * Remove Word of Data Capture: words separated by commas. It is tidied when the box loses focus, not while typing, so a
 * comma can be typed.
 */
export default function RemoveWordInput({ value, onChange }) {
  const { t } = useTranslation("capture");
  return (
    <TextInput
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onChange(normalizeRemoveWords(e.target.value))}
      autoComplete="off"
      spellCheck={false}
      placeholder="FREE,=BONUS"
      title={t("form.removeHint")}
      className="uppercase"
    />
  );
}
