import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import DateField from "@/components/shared/form-modal/DateField.jsx";
import { Field, SelectField, inputClass } from "@/components/shared/form-modal/fields.jsx";
import { FIRST_OF_MONTH, FREQUENCIES } from "./bankFormRules";
import { buildResendRequest, resendSummary, resendUsesDayEnd, validateResend } from "./bankResendRules";

// Same look as Add / Edit Process (everything upper case, the date popups of that form), as a small dialog in the middle.
const UPPERCASE = "uppercase [&_input]:uppercase";
const DATE_POPUP = "uppercase min-[1536px]:max-w-[300px]";
const pair = "grid grid-cols-2 gap-x-3 gap-y-2.5 @max-[479px]/main:grid-cols-1";

function ReadOnlyBox({ children }) {
  return (
    <div className={cn(inputClass, "flex items-center bg-modal-off font-bold text-[#374151]")}>
      <span className="truncate">{children}</span>
    </div>
  );
}

/**
 * Resend one Bank Process to Accounting Due: the user picks Day Start, Day End (1st of Every Month only) and Frequency, and the
 * backend resends for that window. The values apply to this Resend only, they are not saved to the process.
 * row: the process; tenantId: its company; onResend(row, form) posts it and throws on failure (the message stays in the dialog);
 * the dialog closes after a successful Resend.
 */
export default function BankResendModal({ row, tenantId, onClose, onResend }) {
  const [form, setForm] = useState(() => ({
    dayStart: row.date || "",
    dayEnd: row.dayEnd || "",
    frequency: row.frequency || FIRST_OF_MONTH,
  }));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const usesEnd = resendUsesDayEnd(form.frequency);
  const summary = resendSummary(form);
  // Day End only exists for 1st of Every Month; the other frequencies drop whatever was in it.
  const setFrequency = (frequency) => setForm((f) => ({ ...f, frequency, dayEnd: resendUsesDayEnd(frequency) ? f.dayEnd : "" }));

  const save = async () => {
    if (saving) return;
    const problem = validateResend(form);
    if (problem) return setMessage(problem);
    setMessage("");
    setSaving(true);
    try {
      await onResend(buildResendRequest({ row, tenantId, form }));
      onClose();
    } catch (err) {
      setMessage(err.message);
      setSaving(false);
    }
  };

  return (
    <FormModal
      compact
      icon={RotateCcw}
      title="Resend to Accounting Due"
      saveLabel={saving ? "Resending…" : "Resend"}
      saveDisabled={saving}
      onClose={onClose}
      onSave={save}
      className={UPPERCASE}
      footerStart={
        message && (
          <p role="alert" className="m-0 mr-auto min-w-0 text-[12.5px] font-semibold leading-tight text-[#dc2626] normal-case @max-[599px]/main:basis-full @max-[599px]/main:text-[12px]">
            {message}
          </p>
        )
      }
      bodyClassName="flex flex-col overflow-y-auto [scrollbar-width:thin]"
    >
      <FormCard title="Process" className="flex-none">
        <div className={pair}>
          <Field label="Supplier" as="div">
            <ReadOnlyBox>{row.supplier}</ReadOnlyBox>
          </Field>
          <Field label="Bank" as="div">
            <ReadOnlyBox>{[row.bank, row.cardOwner].filter(Boolean).join(" · ")}</ReadOnlyBox>
          </Field>
        </div>
      </FormCard>

      <FormCard title="Schedule" className="mt-(--gap) flex-none">
        <div className={pair}>
          <Field label="Day Start" as="div">
            <DateField value={form.dayStart} onChange={(dayStart) => setForm((f) => ({ ...f, dayStart }))} placeholder="DD/MM/YYYY" popupClassName={DATE_POPUP} />
          </Field>
          <Field label="Day End" optional as="div">
            <DateField
              value={form.dayEnd}
              onChange={(dayEnd) => setForm((f) => ({ ...f, dayEnd }))}
              placeholder={usesEnd ? "DD/MM/YYYY" : "NOT USED"}
              popupClassName={DATE_POPUP}
              disabled={!usesEnd}
            />
          </Field>
        </div>
        <div className="mt-2.5">
          <Field label="Frequency" as="div">
            <SelectField uppercase value={form.frequency} onChange={setFrequency} options={FREQUENCIES} placeholder="Select Frequency" />
          </Field>
        </div>
        <p className={cn("m-0 mt-2.5 px-0.5 text-[12px] leading-snug normal-case", summary.error ? "font-semibold text-[#dc2626]" : "text-[#475569]")}>
          {summary.parts.map((p, i) => (typeof p === "string" ? p : <b key={i} className="text-brand-navy">{p.b}</b>))}
        </p>
      </FormCard>
    </FormModal>
  );
}
