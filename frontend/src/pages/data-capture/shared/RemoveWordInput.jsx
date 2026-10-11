import { TextInput } from "@/components/shared/form-modal/fields.jsx";
import { normalizeRemoveWords } from "./removeWordRules";

/**
 * Remove Word of Data Capture: words separated by commas. It is tidied when the box loses focus, not while typing, so a
 * comma can be typed.
 */
export default function RemoveWordInput({ value, onChange }) {
  return (
    <TextInput
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onChange(normalizeRemoveWords(e.target.value))}
      autoComplete="off"
      spellCheck={false}
      placeholder="FREE,=BONUS"
      title="For multiple words, use commas (,). To match only one exact word, put = before it."
      className="uppercase"
    />
  );
}
