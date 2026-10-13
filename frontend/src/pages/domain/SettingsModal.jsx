import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Layers, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import DateField from "@/components/shared/form-modal/DateField.jsx";
import { Field, SelectField, SoftButton, TextInput, ToggleSwitch } from "@/components/shared/form-modal/fields.jsx";
import SharePanel from "./SharePanel.jsx";
import { NO_EXPIRY, PRICE_PERIODS } from "./domainRules";
import { COMPANY_TYPES, buildSettings, expiryOf, periodOf, priceFor, settingsProblem, shareSummary } from "./domainSettingsRules";

// Company Settings / Group Settings: one dialog, only the title, the ID label and the Company type block differ
// (a group has no Company type: the back end defaults it to Games; a company has exactly one). Left card: validity of the company / group;
// right card: the Share split (4 : 6). It fills the content area like the other form modals (the Add / Edit Domain modal
// stays behind it) and only the layout below 700px wide stacks the two cards.

const readOnlyClass = "cursor-default border-modal-off-line bg-modal-off text-[#5b74a3] focus:border-modal-off-line focus:shadow-none";

/**
 * kind: "company" | "group"; code: its ID
 * saved: the starting settings (from the saved tenant, or from an earlier Set in this modal; null = defaults);
 * fallbackDate: the expiry date the row shows now
 * prices: { company, group } amounts per period from the Price dialog; accounts: the account codes that can take a share (STAFF / AGENT)
 * canPermanent: may pick No Expiry
 * onSave(settings, expiryDate) / onClose(). Mount it only while open.
 */
export default function SettingsModal({ kind, code, saved, fallbackDate, prices, accounts, canPermanent, onClose, onSave }) {
  const { t } = useTranslation("domain");
  const isCompany = kind === "company";
  const kindLabel = t(`settings.kind_${kind}`);
  const [initial] = useState(() => saved ?? buildSettings(kind));
  const [s, setS] = useState(initial);

  const set = (patch) => setS((cur) => ({ ...cur, ...patch }));
  const setDepartment = (key, rows) => setS((cur) => ({ ...cur, departments: { ...cur.departments, [key]: rows } }));
  // No Expiry has no price, so it cannot charge: the Share switch goes off with it.
  const setPeriod = (value) => set(value === NO_EXPIRY ? { period: value, shareOn: false } : { period: value });

  const period = periodOf(s.period);
  const price = priceFor(prices, kind, s.period);
  const summary = shareSummary(price, s.departments);
  const expiry = expiryOf(s) || fallbackDate || "-";
  const problem = settingsProblem(kind, s, summary, price);
  // Only Owner / Partnership / Admin may pick No Expiry (the back end checks it too).
  const PERIOD_OPTIONS = PRICE_PERIODS.map((p) => ({ value: p.key, label: t(`period.${p.key}`) }));
  const periodOptions = canPermanent ? [...PERIOD_OPTIONS, { value: NO_EXPIRY, label: t("settings.noExpiryDate") }] : PERIOD_OPTIONS;
  // The eligible accounts, plus any already on a row (so a saved share never loses its account from the list).
  const shareAccounts = [...new Set([...accounts, ...Object.values(s.departments).flat().map((r) => r.account).filter(Boolean)])];

  return (
    <FormModal
      icon={isCompany ? Building2 : Layers}
      title={t(`settings.title_${kind}`)}
      onClose={onClose}
      onSave={() => onSave(s, expiryOf(s) || fallbackDate || "")}
      saveDisabled={Boolean(problem)}
      footerStart={
        problem && (
          <p role="status" className="m-0 mr-auto flex min-w-0 items-center gap-2 fm-count text-[#8a5a00] @max-[599px]/main:basis-full">
            <i className="size-[7px] flex-none rounded-full bg-[#f59e0b] shadow-[0_0_0_3px_rgba(245,158,11,0.22)]" />
            {problem}
          </p>
        )
      }
      footerExtra={
        <SoftButton
          onClick={() => setS(initial)}
          className="h-[38px] min-w-[112px] px-[22px] fm-btn text-[#c0392b] modal-compact:h-8 modal-tiny:h-[30px] @max-[599px]/main:min-w-0 @max-[599px]/main:flex-1"
        >
          <RotateCcw className="size-[14px]" strokeWidth={2.4} />
          {t("settings.reset")}
        </SoftButton>
      }
      bodyClassName={cn(
        "grid grid-cols-[minmax(250px,4fr)_minmax(0,6fr)] grid-rows-[minmax(0,1fr)]",
        "@max-[699px]/main:grid-cols-1 @max-[699px]/main:grid-rows-[max-content_max-content] @max-[699px]/main:content-start @max-[699px]/main:overflow-y-auto",
      )}
    >
      <FormCard title={t(`settings.card_${kind}`)} bodyClassName="flex flex-col gap-2.5 modal-compact:gap-2 modal-tiny:gap-1.5">
        <Field label={t(`settings.id_${kind}`)} plain>
          <TextInput value={code} readOnly tabIndex={-1} className={readOnlyClass} />
        </Field>

        <div className="grid grid-cols-2 gap-2.5 modal-tiny:gap-2">
          <Field label={t("settings.startDate")} as="div">
            <DateField value={s.startDate} onChange={(startDate) => set({ startDate })} />
          </Field>
          <Field label={t("settings.period")} as="div">
            <SelectField value={s.period ?? ""} onChange={setPeriod} options={periodOptions} placeholder={s.currentExpiry ? t("settings.keepExpiry") : t("settings.selectPeriod")} />
          </Field>
        </div>
        <p className="m-0 -mt-1 ml-0.5 fm-help text-[#6b7fa5] modal-tiny:hidden">{t("settings.startHint")}</p>

        <Field label={t("settings.expirationDate")} plain>
          <TextInput value={expiry} readOnly tabIndex={-1} className={cn(readOnlyClass, "text-center font-semibold tracking-[0.3px] tabular-nums")} />
        </Field>

        {isCompany && (
          <Field label={t("settings.companyType")} plain as="div">
            <div className="flex gap-1.5">
              {COMPANY_TYPES.map((type) => {
                const on = s.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ type })}
                    className={cn(
                      "min-w-0 flex-1 cursor-pointer rounded-full border py-1 fm-btn-sm whitespace-nowrap transition-colors",
                      on
                        ? "border-transparent bg-brand-sweep text-white shadow-[0_4px_10px_-4px_rgba(20,90,220,0.6)]"
                        : "border-[#9dbcf5] bg-white/60 text-brand-blue hover:bg-white/90",
                    )}
                  >
                    {t(`settings.type.${type}`)}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
      </FormCard>

      <FormCard
        title={t("settings.share")}
        right={
          <ToggleSwitch
            on={s.shareOn}
            onToggle={() => set({ shareOn: !s.shareOn })}
            disabled={s.period === NO_EXPIRY}
            label={s.shareOn ? t("settings.on") : t("settings.off")}
            className="flex-row-reverse"
          />
        }
        bodyClassName="flex flex-col overflow-hidden"
      >
        <fieldset disabled={!s.shareOn} className={cn("m-0 flex min-h-0 min-w-0 flex-1 flex-col border-0 p-0 transition-opacity", !s.shareOn && "opacity-50")}>
          <SharePanel kindLabel={kindLabel} period={period} price={price} departments={s.departments} summary={summary} accounts={shareAccounts} onChange={setDepartment} />
        </fieldset>
      </FormCard>
    </FormModal>
  );
}
