import { useState } from "react";
import { Building2, Layers, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import FormModal from "@/components/shared/form-modal/FormModal.jsx";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import DateField from "@/components/shared/form-modal/DateField.jsx";
import { Field, SelectField, SoftButton, TextInput, ToggleSwitch } from "@/components/shared/form-modal/fields.jsx";
import SharePanel from "./SharePanel.jsx";
import { PRICE_PERIODS } from "./domainRules";
import { COMPANY_TYPES, buildSettings, expiryOf, periodOf, priceFor, settingsProblem, shareSummary } from "./domainSettingsRules";

// Company Settings / Group Settings: one dialog, only the title, the ID label and the Company type block differ
// (a group has no Company type: the back end defaults it to Games). Left card: validity of the company / group;
// right card: the Share split. It fills the content area like the other form modals (the Add / Edit Domain modal
// stays behind it) and only the layout below 700px wide stacks the two cards.

const readOnlyClass = "cursor-default border-modal-off-line bg-modal-off text-[#5b74a3] focus:border-modal-off-line focus:shadow-none";
const PERIOD_OPTIONS = PRICE_PERIODS.map((p) => ({ value: p.key, label: p.label }));

/**
 * kind: "company" | "group"; code: its ID
 * saved: the settings saved earlier in this session (or null = defaults); fallbackDate: the expiry date the row shows now
 * prices: { company, group } amounts per period from the Price dialog
 * onSave(settings, expiryDate) / onClose(). Mount it only while open.
 */
export default function SettingsModal({ kind, code, saved, fallbackDate, prices, onClose, onSave }) {
  const isCompany = kind === "company";
  const kindLabel = isCompany ? "Company" : "Group";
  const [initial] = useState(() => saved ?? buildSettings(kind));
  const [s, setS] = useState(initial);

  const set = (patch) => setS((cur) => ({ ...cur, ...patch }));
  const setDepartment = (key, rows) => setS((cur) => ({ ...cur, departments: { ...cur.departments, [key]: rows } }));
  const toggleType = (type) => set({ types: s.types.includes(type) ? s.types.filter((t) => t !== type) : [...s.types, type] });

  const period = periodOf(s.period);
  const price = priceFor(prices, kind, s.period);
  const summary = shareSummary(price, s.departments);
  const expiry = expiryOf(s.startDate, s.period) || fallbackDate || "-";
  const problem = settingsProblem(kind, s, summary);

  return (
    <FormModal
      icon={isCompany ? Building2 : Layers}
      title={`${kindLabel} Settings`}
      onClose={onClose}
      onSave={() => onSave(s, expiryOf(s.startDate, s.period) || fallbackDate || "")}
      saveDisabled={Boolean(problem)}
      footerStart={
        problem && (
          <p role="status" className="m-0 mr-auto flex min-w-0 items-center gap-2 text-[12.5px] font-bold text-[#8a5a00] @max-[599px]/main:basis-full">
            <i className="size-[7px] flex-none rounded-full bg-[#f59e0b] shadow-[0_0_0_3px_rgba(245,158,11,0.22)]" />
            {problem}
          </p>
        )
      }
      footerExtra={
        <SoftButton
          onClick={() => setS(initial)}
          className="h-[38px] min-w-[112px] px-[22px] text-[13.5px] text-[#c0392b] modal-compact:h-8 modal-tiny:h-[30px] @max-[599px]/main:min-w-0 @max-[599px]/main:flex-1"
        >
          <RotateCcw className="size-[14px]" strokeWidth={2.4} />
          Reset
        </SoftButton>
      }
      bodyClassName={cn(
        "grid grid-cols-[clamp(250px,32%,340px)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)]",
        "@max-[699px]/main:grid-cols-1 @max-[699px]/main:grid-rows-[max-content_max-content] @max-[699px]/main:content-start @max-[699px]/main:overflow-y-auto",
      )}
    >
      <FormCard title={`${kindLabel} settings`} bodyClassName="flex flex-col gap-2.5 modal-compact:gap-2 modal-tiny:gap-1.5">
        <Field label={`${kindLabel} ID`} plain>
          <TextInput value={code} readOnly tabIndex={-1} className={readOnlyClass} />
        </Field>

        <div className="grid grid-cols-2 gap-2.5 modal-tiny:gap-2">
          <Field label="Start Date" as="div">
            <DateField value={s.startDate} onChange={(startDate) => set({ startDate })} />
          </Field>
          <Field label="Period" as="div">
            <SelectField value={s.period ?? ""} onChange={(p) => set({ period: p })} options={PERIOD_OPTIONS} placeholder="Select Period" />
          </Field>
        </div>
        <p className="m-0 -mt-1 ml-0.5 text-[11px] leading-snug text-[#6b7fa5] modal-tiny:hidden">Select the start date for calculating the expiration date.</p>

        <Field label="Expiration Date" plain>
          <TextInput value={expiry} readOnly tabIndex={-1} className={cn(readOnlyClass, "text-center font-semibold tracking-[0.3px] tabular-nums")} />
        </Field>

        {isCompany && (
          <Field label="Company type (Process List and Data Capture)" plain as="div">
            <div className="flex gap-1.5">
              {COMPANY_TYPES.map((type) => {
                const on = s.types.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleType(type)}
                    className={cn(
                      "min-w-0 flex-1 cursor-pointer rounded-full border py-1 text-[clamp(11px,1.6dvh,12.5px)] font-semibold whitespace-nowrap transition-colors",
                      on
                        ? "border-transparent bg-brand-sweep text-white shadow-[0_4px_10px_-4px_rgba(20,90,220,0.6)]"
                        : "border-[#9dbcf5] bg-white/60 text-brand-blue hover:bg-white/90",
                    )}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
            <p className="m-0 mt-1 ml-0.5 text-[11px] leading-snug text-[#6b7fa5] modal-tiny:hidden">
              Select which options this company can access in Process List and Data Capture.
            </p>
          </Field>
        )}
      </FormCard>

      <FormCard
        title="Share"
        right={<ToggleSwitch on={s.shareOn} onToggle={() => set({ shareOn: !s.shareOn })} label={s.shareOn ? "On" : "Off"} className="flex-row-reverse" />}
        bodyClassName="flex flex-col overflow-hidden"
      >
        <fieldset disabled={!s.shareOn} className={cn("m-0 flex min-h-0 min-w-0 flex-1 flex-col border-0 p-0 transition-opacity", !s.shareOn && "opacity-50")}>
          <SharePanel kindLabel={kindLabel} period={period} price={price} departments={s.departments} summary={summary} onChange={setDepartment} />
        </fieldset>
      </FormCard>
    </FormModal>
  );
}
