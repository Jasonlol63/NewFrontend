import { useMemo, useState } from "react";
import { Info, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { postJson } from "@/lib/api";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import { Field, SelectField, TextInput } from "@/components/shared/form-modal/fields.jsx";
import StatusDialog from "@/components/shared/StatusDialog.jsx";
import {
  FORMULA_UPDATE_URL,
  INPUT_METHOD_OPTIONS,
  buildFormulaUpdateRequest,
  formFromRow,
  formulaAfterTyping,
  isFormChanged,
  isFormFilled,
  sourceAfterTyping,
} from "./formulaMaintenanceRules";

// Process, Product and Currency can't be changed (the API only takes the five fields below them).
const readOnlyClass = "cursor-default border-modal-off-line bg-modal-off text-[#5b74a3] focus:border-modal-off-line focus:shadow-none";
const textareaClass =
  "min-h-[120px] w-full flex-1 resize-none rounded-[10px] border border-modal-input-line bg-modal-input px-3 py-2 font-mono text-[13.5px] leading-relaxed text-[#111827] shadow-[0_1px_3px_rgba(15,23,42,0.05)] outline-none transition-[border-color,box-shadow] focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] modal-compact:text-[13px] modal-tiny:min-h-[90px] modal-tiny:text-[12.5px]";

/**
 * Edit Formula of Formula Maintenance: the five editable fields of one row (Account, Source %, Input Method, Formula,
 * Description) with its Process, Product and Currency shown read-only. Fills the content area (the sidebar stays
 * visible). Mount it only while open.
 * row: the list row (normalizeFormulaRow); accounts: the company's active accounts ([{ id, accountId, name }]).
 * onSaved() runs after the API accepted the change, e.g. to reload the list (copies of a source formula change too).
 */
export default function FormulaEditModal({ row, tenantId, accounts, onClose, onSaved }) {
  const [form, setForm] = useState(() => formFromRow(row));
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const set = (key, value) => setForm((cur) => ({ ...cur, [key]: value }));

  // The row's own account stays pickable even when it is no longer active; an unknown Input Method shows as it is stored.
  const accountOptions = useMemo(() => {
    const options = accounts.map((a) => ({ value: String(a.id), label: `${a.accountId}[${a.name || a.accountId}]` }));
    if (row.accountId != null && !options.some((o) => o.value === String(row.accountId))) {
      options.unshift({ value: String(row.accountId), label: `${row.account}[${row.accountName || row.account}]` });
    }
    return options;
  }, [accounts, row]);
  const methodOptions = useMemo(
    () =>
      row.inputMethod && !INPUT_METHOD_OPTIONS.some((o) => o.value === row.inputMethod)
        ? [{ value: row.inputMethod, label: row.inputMethod }, ...INPUT_METHOD_OPTIONS]
        : INPUT_METHOD_OPTIONS,
    [row.inputMethod]
  );

  const canSave = isFormFilled(form) && isFormChanged(form, row) && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await postJson(FORMULA_UPDATE_URL, buildFormulaUpdateRequest({ tenantId, row, form }));
      await onSaved();
      onClose();
    } catch (err) {
      setFailure(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormModal
        icon={SquarePen}
        title="Edit Formula"
        onClose={onClose}
        onSave={save}
        saveLabel={saving ? "Saving..." : "Save"}
        saveDisabled={!canSave}
        bodyClassName={cn(
          "grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] grid-rows-[minmax(0,1fr)]",
          "@max-[899px]/main:grid-cols-1 @max-[899px]/main:grid-rows-[max-content_max-content] @max-[899px]/main:content-start @max-[899px]/main:overflow-y-auto"
        )}
      >
        <FormCard title="Formula information" bodyClassName="@container @max-[899px]/main:overflow-visible">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 @max-[330px]:grid-cols-1 modal-compact:gap-y-2">
            <Field label="Process" plain>
              <TextInput value={row.process} title={row.process} readOnly tabIndex={-1} className={cn("uppercase", readOnlyClass)} />
            </Field>
            <Field label="Product" plain>
              <TextInput value={row.product} title={row.product} readOnly tabIndex={-1} className={cn("uppercase", readOnlyClass)} />
            </Field>
            <Field label="Currency" plain>
              <TextInput value={row.currency} title={row.currency} readOnly tabIndex={-1} className={cn("uppercase", readOnlyClass)} />
            </Field>
            <Field label="Source %">
              <TextInput
                value={form.source}
                onChange={(e) => set("source", sourceAfterTyping(form.source, e.target.value))}
                inputMode="decimal"
                autoComplete="off"
              />
            </Field>
            <Field label="Account" optional className="col-span-full">
              <SelectField
                value={form.accountId}
                onChange={(v) => set("accountId", v)}
                onClear={() => set("accountId", "")}
                options={accountOptions}
                placeholder="Select account"
              />
            </Field>
            <Field label="Input Method" optional className="col-span-full">
              <SelectField
                value={form.inputMethod}
                onChange={(v) => set("inputMethod", v)}
                onClear={() => set("inputMethod", "")}
                options={methodOptions}
                placeholder="Select input method"
              />
            </Field>
            <Field label="Description" optional className="col-span-full">
              <TextInput
                value={form.description}
                onChange={(e) => set("description", e.target.value.toUpperCase())}
                autoComplete="off"
                className="uppercase"
              />
            </Field>
          </div>
        </FormCard>

        <FormCard title="Formula" bodyClassName="flex flex-col gap-2.5 @max-[899px]/main:overflow-visible modal-compact:gap-2">
          <textarea
            value={form.formula}
            onChange={(e) => set("formula", formulaAfterTyping(form.formula, e.target.value))}
            aria-label="Formula"
            spellCheck={false}
            autoComplete="off"
            className={cn(textareaClass, "@max-[899px]/main:min-h-[160px]")}
          />
          <p className="m-0 flex-none text-xs leading-snug text-[#64748b] modal-tiny:text-[11.5px]">
            Numbers, column letters and + - * / ( ) . $ [ ] , only. Letters can be kept or removed, but new ones can't be added.
          </p>
          <div className="flex flex-none items-start gap-1.5 rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff]/90 px-2.5 py-[7px] text-[12.5px] leading-snug text-[#1e40af] modal-tiny:text-[12px]">
            <Info className="mt-0.5 size-3.5 flex-none" strokeWidth={2.2} />
            <span>If this formula is the source of copied formulas, the same changes are applied to the copies.</span>
          </div>
        </FormCard>
      </FormModal>

      <StatusDialog
        open={Boolean(failure)}
        onOpenChange={(open) => !open && setFailure("")}
        type="error"
        title="Formula not saved"
        description={failure}
        confirmText="OK"
      />
    </>
  );
}
