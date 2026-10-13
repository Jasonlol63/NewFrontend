import { useState } from "react";
import { ArrowRight, CircleDollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { localizeBackend } from "@/i18n/backendMessages";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import { Field, TextInput } from "@/components/shared/form-modal/fields.jsx";
import SharePanel from "@/pages/domain/SharePanel.jsx";
import { shareSummary } from "@/pages/domain/domainSettingsRules";
import ChargeSwitch from "./ChargeSwitch.jsx";
import PeriodSelect from "./PeriodSelect.jsx";
import { displayDate, newExpiryOf, periodOf, rowPrice, startOf } from "./autoRenewRules";

/**
 * The Comm button of an Auto Renew row: Period, Price, Charge and the Share split of that one renewal.
 * Period / Price / Charge are the same values as the row in the list, so every change is written to the row at once
 * (`onPatch`) and Cancel / Back / Esc put the row back as it was when the dialog opened. Mount it only while open.
 *  - row: the row being edited; readOnly: look only (read-only login, or already approved / rejected)
 *  - accounts: the account codes that can take a share
 *  - onPatch(changes): merge changes into the row; onSave(row): saves the Share (rejects with a message); onClose()
 * Charge off = nothing is charged, so the Share is greyed out; there is no separate Share switch.
 */
// What a Share holds, without the row ids, to tell whether it was changed.
const shareKey = (departments) => JSON.stringify(Object.values(departments).map((rows) => rows.map((r) => [r.account, r.pct])));

export default function ChargeDialog({ row, readOnly, accounts, onPatch, onSave, onClose, notify }) {
  const { t } = useTranslation(["autorenew", "common", "domain"]);
  const [initial] = useState(row);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const kindLabel = row.kind === "group" ? t("tabs.group") : t("tabs.company");
  const period = periodOf(row.periodKey);
  const price = rowPrice(row) ?? 0;
  const summary = shareSummary(price, row.departments);
  const shareOff = !row.charge;
  const start = startOf(row);
  const problem = row.charge && summary.incomplete ? t("charge.chooseAccount") : row.charge && summary.over ? t("charge.over") : "";

  // Period and Charge only live in the page until Approve; the Share is saved here, and only when it was changed.
  const save = async () => {
    if (!readOnly && row.charge && shareKey(row.departments) !== shareKey(initial.departments)) {
      setSaving(true);
      setError("");
      try {
        await onSave(row);
        notify?.(t("toast.shareSaved"));
      } catch (e) {
        setError(localizeBackend(e.message));
        return;
      } finally {
        setSaving(false);
      }
    }
    onClose();
  };
  // The eligible accounts, plus any already on a row (so a saved share never loses its account from the list).
  const shareAccounts = [...new Set([...accounts, ...Object.values(row.departments).flat().map((r) => r.account).filter(Boolean)])];

  const cancel = () => {
    if (!readOnly) onPatch(initial);
    onClose();
  };
  const changePeriod = (periodKey) => onPatch({ periodKey });
  const setDepartment = (key, rows) => onPatch({ departments: { ...row.departments, [key]: rows } });

  return (
    <FormModal
      icon={CircleDollarSign}
      title={t("charge.title", { company: row.company })}
      onClose={cancel}
      onSave={save}
      saveDisabled={readOnly || saving || Boolean(problem)}
      footerStart={
        (error || problem || readOnly) && (
          <p role="status" className="m-0 mr-auto flex min-w-0 items-center gap-2 fm-count text-[#8a5a00] @max-[599px]/main:basis-full">
            <i className="size-[7px] flex-none rounded-full bg-[#f59e0b] shadow-[0_0_0_3px_rgba(245,158,11,0.22)]" />
            {readOnly ? t("charge.viewOnly") : error || problem}
          </p>
        )
      }
      bodyClassName={cn(
        "grid grid-cols-[minmax(250px,4fr)_minmax(0,6fr)] grid-rows-[minmax(0,1fr)]",
        "@max-[799px]/main:grid-cols-1 @max-[799px]/main:grid-rows-[max-content_max-content] @max-[799px]/main:content-start @max-[799px]/main:overflow-y-auto"
      )}
    >
      <FormCard title={t("charge.renewal")} bodyClassName="flex flex-col gap-2.5 modal-compact:gap-2 modal-tiny:gap-1.5">
        <Field label={t("charge.period")} plain as="div">
          <PeriodSelect row={row} value={row.periodKey} onChange={changePeriod} disabled={readOnly} className="h-9! w-full! rounded-[10px]! fm-input!" />
        </Field>

        <Field label={t("charge.price")} plain>
          <TextInput
            value={row.periodKey ? price.toFixed(2) : ""}
            readOnly
            tabIndex={-1}
            placeholder={t("charge.pickPeriod")}
            className="cursor-default border-modal-off-line bg-modal-off text-right tabular-nums text-[#5b74a3] focus:border-modal-off-line focus:shadow-none"
          />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-modal-line bg-white/50 px-3 py-2">
          <div className="min-w-0">
            <p className="m-0 fm-label text-[#374151]">{t("charge.chargeLabel")}</p>
            <p className="m-0 fm-help text-[#6b7fa5] modal-tiny:hidden">{t("charge.chargeHint")}</p>
          </div>
          <ChargeSwitch on={row.charge} disabled={readOnly} onToggle={() => onPatch({ charge: !row.charge })} />
        </div>

        <div className="mt-auto rounded-[10px] bg-[linear-gradient(90deg,#d6ebff,#f0f8ff)] p-2 tabular-nums">
          {row.status === "pending" && (
            <div className="flex flex-col gap-1 px-1 pb-1">
              <div className="flex items-center justify-between">
                <span className="fm-opt font-semibold! tracking-[0.6px] text-[#94a3b8]">{t("charge.current")}</span>
                <span className={cn("fm-btn-sm text-[#8b97a8]", row.periodKey && "line-through decoration-slate-500/70")}>{displayDate(row.expiry)}</span>
              </div>
              <div className="flex items-center justify-between" title={t("charge.startNote")}>
                <span className="fm-opt font-semibold! tracking-[0.6px] text-[#94a3b8]">{t("charge.start")}</span>
                <span className="fm-btn-sm text-[#41588a]">
                  {displayDate(start.date)} <small className="fm-help text-[#6b7fa5]">({t(`charge.startFrom.${start.from}`)})</small>
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-1 rounded-lg border border-[#7fb8ff] bg-white px-2.5 py-1.5 shadow-[0_3px_8px_-4px_rgba(13,96,255,0.5)]">
            <span className="flex items-center gap-1 fm-opt font-semibold! tracking-[0.6px] text-[#2f8dff]">
              <ArrowRight className="size-3 flex-none" strokeWidth={2.6} />
              {t("charge.new")}
            </span>
            <b className="fm-btn text-[#0b4fd0]">{row.periodKey ? displayDate(newExpiryOf(row, row.periodKey)) : "-"}</b>
          </div>
        </div>
      </FormCard>

      <FormCard title={t("charge.share")} bodyClassName="flex flex-col overflow-hidden">
        <fieldset
          disabled={shareOff || readOnly}
          className={cn("m-0 flex min-h-0 min-w-0 flex-1 flex-col border-0 p-0 transition-opacity", (shareOff || readOnly) && "opacity-50")}
        >
          <SharePanel kindLabel={kindLabel} period={period && { ...period, key: period.domainKey }} price={price} departments={row.departments} summary={summary} accounts={shareAccounts} onChange={setDepartment} />
        </fieldset>
      </FormCard>
    </FormModal>
  );
}
