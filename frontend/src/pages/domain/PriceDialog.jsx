import { Fragment, useState } from "react";
import { Dialog } from "radix-ui";
import { Building2, Check, CircleDollarSign, Info, Users, X } from "lucide-react";
import { SoftButton, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import { PRICE_PERIODS } from "./domainRules";

// Small centered dialog (not the full-area form modal): width follows vw, vertical rhythm follows dvh, and
// every value is capped at the design size. Only the middle part scrolls when the screen is too short.
const FLUID = {
  width: "clamp(300px, 92vw, 520px)",
  "--pad-x": "clamp(14px, 1.6vw, 20px)",
  "--pad-y": "clamp(10px, 2dvh, 16px)",
  "--row-h": "clamp(28px, 4dvh, 32px)",
  "--btn-h": "clamp(34px, 4.8dvh, 38px)",
};

// Up to 2 decimals; anything else the user types or pastes is ignored.
const AMOUNT = /^\d*(\.\d{0,2})?$/;

const SECTIONS = [
  {
    key: "company",
    label: "Company Price",
    icon: Building2,
    iconClass: "text-brand-blue",
  },
  {
    key: "group",
    label: "Group Price",
    icon: Users,
    iconClass: "text-dash-up",
  },
];

/**
 * Default prices of a company and of a group, one amount per period.
 *  - prices: { company: { [periodKey]: string }, group: { [periodKey]: string } }
 *  - onSave(prices) / onClose()
 * Mount it only while open so every opening starts from the saved values.
 */
export default function PriceDialog({ prices, onSave, onClose }) {
  const [values, setValues] = useState(prices);

  const change = (section, period, text) => {
    if (!AMOUNT.test(text)) return;
    setValues((v) => ({ ...v, [section]: { ...v[section], [period]: text } }));
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-dialog-overlay bg-[rgba(20,51,107,0.22)] backdrop-blur-[6px] motion-reduce:animate-none" />
        <Dialog.Content
          style={FLUID}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 animate-dialog-in flex-col overflow-hidden rounded-[20px] bg-white text-left shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)] outline-none motion-reduce:animate-none"
        >
          <header className="flex flex-none items-center gap-3 px-(--pad-x) pb-2.5 pt-(--pad-y)">
            <div className="flex size-9 flex-none items-center justify-center rounded-[11px] bg-brand-sweep text-white shadow-[0_10px_20px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] short:size-8">
              <CircleDollarSign className="size-5 short:size-[18px]" strokeWidth={2.2} />
            </div>
            <Dialog.Title className="m-0 flex-1 text-[clamp(17px,2.4dvh,19px)] font-extrabold tracking-[-0.3px] text-brand-navy">Price</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="grid size-8 flex-none cursor-pointer place-items-center rounded-[9px] border-none bg-transparent text-[#7d8fb0] outline-none transition-colors hover:bg-[#eef3fb] focus-visible:ring-2 focus-visible:ring-brand-blue/40"
            >
              <X className="size-[18px]" strokeWidth={2.2} />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-(--pad-x) pb-3 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            <Dialog.Description className="m-0 mb-1.5 flex gap-2 rounded-xl bg-[#eef4ff] px-3 py-2 text-[clamp(11.5px,1.7dvh,12px)] leading-[1.45] text-[#41588a]">
              <Info className="mt-px size-[15px] flex-none text-brand-blue" strokeWidth={2.2} />
              Set default amounts for the company and group respectively. Company prices apply to company settings; group prices apply to group settings.
            </Dialog.Description>
            <p className="m-0 mb-2 ml-0.5 text-[11px] text-[#8a96a8] max-[479px]:hidden">Enter amounts for each period (up to 2 decimal places).</p>

            {/* The divider is its own 1px track so both columns, and so all ten inputs, are exactly the same width. */}
            <div className="grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-x-3.5 max-[479px]:grid-cols-1 max-[479px]:gap-y-2.5">
              {SECTIONS.map(({ key, label, icon: Icon, iconClass }, i) => (
                <Fragment key={key}>
                  {i === 1 && <div aria-hidden="true" className="bg-[#e6edf8] max-[479px]:h-px" />}
                  <section className="min-w-0">
                    <h2 className="m-0 mb-2 flex items-center gap-[7px] text-[13px] font-bold text-brand-navy">
                      <Icon className={`size-4 ${iconClass}`} strokeWidth={2.2} />
                      {label}
                    </h2>
                    {PRICE_PERIODS.map(({ key: period, label: periodLabel }) => (
                      <label key={period} className="mb-1.5 grid grid-cols-[clamp(58px,17vw,68px)_minmax(0,1fr)] items-center gap-2 last:mb-0">
                        <span className="whitespace-nowrap text-xs text-[#5b74a3]">{periodLabel}</span>
                        <input
                          value={values[key][period]}
                          onChange={(e) => change(key, period, e.target.value)}
                          inputMode="decimal"
                          className="h-(--row-h) w-full min-w-0 rounded-[9px] border border-modal-input-line bg-white px-2.5 text-[13px] text-dash-ink shadow-[0_1px_3px_rgba(15,23,42,0.05)] outline-none transition-[border-color,box-shadow] focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
                        />
                      </label>
                    ))}
                  </section>
                </Fragment>
              ))}
            </div>
          </div>

          <footer className="flex flex-none justify-end gap-2 border-t border-modal-divider px-(--pad-x) pb-[calc(var(--pad-y)*0.9)] pt-2.5">
            <SoftButton
              onClick={onClose}
              className="h-(--btn-h) min-w-[104px] border-[#dbe5f3] bg-white px-[22px] text-[13.5px] hover:bg-[#f5f8fd] max-[479px]:min-w-0 max-[479px]:flex-1"
            >
              Cancel
            </SoftButton>
            <button
              type="button"
              onClick={() => onSave(values)}
              className={`${primaryButtonClass} h-(--btn-h) min-w-[104px] px-[22px] text-[13.5px] max-[479px]:min-w-0 max-[479px]:flex-1`}
            >
              <Check className="size-[15px]" strokeWidth={2.5} />
              Save
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
