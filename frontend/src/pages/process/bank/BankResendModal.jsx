import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import Toast from "@/components/shared/Toast.jsx";
import { useNotice } from "@/hooks/useNotice";
import DateField from "@/components/shared/form-modal/DateField.jsx";
import { Field, SelectField, inputClass } from "@/components/shared/form-modal/fields.jsx";
import { FIRST_OF_MONTH, FREQUENCIES } from "./bankFormRules";
import { buildResendRequest, resendSummary, resendUsesDayEnd, validateResend } from "./bankResendRules";

// Same look as Add / Edit Process (the date popups of that form), as a small dialog in the middle.
const DATE_POPUP = "min-[1536px]:max-w-[300px]";
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
  const { t } = useTranslation(["process", "common"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const [form, setForm] = useState(() => ({
    dayStart: row.date || "",
    dayEnd: row.dayEnd || "",
    frequency: row.frequency || FIRST_OF_MONTH,
  }));
  const [saving, setSaving] = useState(false);

  const usesEnd = resendUsesDayEnd(form.frequency);
  const summary = resendSummary(form);
  // Day End only exists for 1st of Every Month; the other frequencies drop whatever was in it.
  const setFrequency = (frequency) => setForm((f) => ({ ...f, frequency, dayEnd: resendUsesDayEnd(frequency) ? f.dayEnd : "" }));

  const save = async () => {
    if (saving) return;
    const problem = validateResend(form);
    if (problem) return push(problem, "error");
    setSaving(true);
    try {
      await onResend(buildResendRequest({ row, tenantId, form }));
      onClose();
    } catch (err) {
      push(t("bank.errors.resend"), "error", err.message);
      setSaving(false);
    }
  };

  return (
    <FormModal
      compact
      icon={RotateCcw}
      title={t("bank.resend.title")}
      saveLabel={saving ? t("bank.resend.resending") : t("bank.resend.button")}
      saveDisabled={saving}
      onClose={onClose}
      onSave={save}
      bodyClassName="flex flex-col overflow-y-auto [scrollbar-width:thin]"
    >
      <FormCard title={t("bank.resend.processCard")} className="flex-none">
        <div className={pair}>
          <Field label={t("bank.resend.supplier")} as="div">
            <ReadOnlyBox>{row.supplier}</ReadOnlyBox>
          </Field>
          <Field label={t("bank.resend.bank")} as="div">
            <ReadOnlyBox>{[row.bank, row.cardOwner].filter(Boolean).join(" · ")}</ReadOnlyBox>
          </Field>
        </div>
      </FormCard>

      <FormCard title={t("bank.resend.scheduleCard")} className="mt-(--gap) flex-none">
        <div className={pair}>
          <Field label={t("bank.resend.dayStart")} as="div">
            <DateField value={form.dayStart} onChange={(dayStart) => setForm((f) => ({ ...f, dayStart }))} placeholder="DD/MM/YYYY" popupClassName={DATE_POPUP} />
          </Field>
          <Field label={t("bank.resend.dayEnd")} optional as="div">
            <DateField
              value={form.dayEnd}
              onChange={(dayEnd) => setForm((f) => ({ ...f, dayEnd }))}
              placeholder={usesEnd ? "DD/MM/YYYY" : t("bank.resend.notUsed")}
              popupClassName={DATE_POPUP}
              disabled={!usesEnd}
            />
          </Field>
        </div>
        <div className="mt-2.5">
          <Field label={t("bank.resend.frequency")} as="div">
            <SelectField value={form.frequency} onChange={setFrequency} options={FREQUENCIES.map((o) => ({ ...o, label: t(`bank.frequency.${o.value}`, { defaultValue: o.label }) }))} placeholder={t("bank.resend.selectFrequency")} />
          </Field>
        </div>
        <p className={cn("m-0 mt-2.5 px-0.5 text-[12px] leading-snug normal-case", summary.error ? "font-semibold text-[#dc2626]" : "text-[#475569]")}>
          <Trans t={t} i18nKey={`bank.resend.${summary.key}`} values={summary.values} components={{ b: <b className="text-brand-navy" /> }} />
        </p>
      </FormCard>
      <Toast toasts={toasts} onClose={dismiss} />
    </FormModal>
  );
}
