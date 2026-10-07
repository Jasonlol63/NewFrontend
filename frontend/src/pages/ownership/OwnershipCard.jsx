import { useState } from "react";
import { Check, ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import { SoftButton, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import { ACCOUNT_OPTIONS, clampPct, formatPct, totalAllocation } from "./ownershipRules";

const NOT_BUILT = "Not available yet";

// Same blue as Save in the form modals, for Manage / Link Partner.
const smallPrimary = cn(primaryButtonClass, "h-[clamp(23.4px,calc(4.77dvh_-_4.83px),30px)] px-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] text-[length:max(12px,clamp(9.75px,calc(1.99dvh_-_2.01px),12.5px))] rounded-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] xl-screen:h-11 xl-screen:px-6 xl-screen:text-[15px] xl-screen:rounded-xl");

// Danger action kept quiet: white glass with a rose outline.
const ungroupClass =
  "xl-screen:min-w-[104px] h-[clamp(23.4px,calc(4.77dvh_-_4.83px),30px)] px-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] text-[length:max(12px,clamp(9.75px,calc(1.99dvh_-_2.01px),12.5px))] rounded-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] xl-screen:h-11 xl-screen:px-6 xl-screen:text-[15px] xl-screen:rounded-xl inline-flex flex-none cursor-not-allowed items-center justify-center border border-[#fbc4cf] bg-white/75 font-bold text-[#e11d48] shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-colors hover:bg-[#fff1f4]";

function Section({ children, className }) {
  return (
    <div className={cn("text-[length:max(10.5px,clamp(8.97px,calc(1.83dvh_-_1.85px),11.5px))] before:content-[''] before:w-[max(3px,clamp(3.12px,calc(0.64dvh_-_0.64px),4px))] before:h-[max(11px,clamp(10.92px,calc(2.23dvh_-_2.25px),14px))] before:rounded-sm before:bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)] flex items-center gap-2 font-extrabold tracking-[0.4px] text-brand-navy uppercase", className)}>
      {children}
    </div>
  );
}

// The fill ends under the centre of the thumb: half a thumb plus the value's share of the travel.
const THUMB = "max(14px,clamp(13.26px,calc(2.7dvh_-_2.74px),17px))".replaceAll("_", " ");
const trackFill = (pct) => ({
  "--track": `linear-gradient(90deg,#0a3fc9,#2f8dff 55%,#3fc4ff) left / calc(${THUMB} / 2 + (100% - ${THUMB}) * ${pct / 100}) 100% no-repeat, #dbe7fa`,
});

function AccountRow({ row, onChange, onRemove }) {
  return (
    <div className="gap-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] px-[clamp(9.36px,calc(1.91dvh_-_1.93px),12px)] py-[clamp(6.24px,calc(1.27dvh_-_1.29px),8px)] mt-[clamp(6.24px,calc(1.27dvh_-_1.29px),8px)] rounded-[clamp(9.36px,calc(1.91dvh_-_1.93px),12px)] xl-screen:px-5 xl-screen:py-[14px] xl-screen:gap-[22px] xl-screen:mt-[14px] flex items-center border border-dash-line border-l-[3px] border-l-[#2f8dff] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <GripVertical className="size-4 flex-none cursor-grab text-slate-300" />
      <DropdownSelect
        options={ACCOUNT_OPTIONS}
        value={row.account}
        onChange={(account) => onChange({ account })}
        ariaLabel="Account"
        className="w-[clamp(210.6px,calc(42.93dvh_-_43.47px),270px)] h-[clamp(26.52px,calc(5.41dvh_-_5.47px),34px)] text-[length:max(12px,clamp(10.14px,calc(2.07dvh_-_2.09px),13px))] rounded-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] xl-screen:h-10 flex-none"
      />
      <div className="h-[clamp(26.52px,calc(5.41dvh_-_5.47px),34px)] text-[length:max(12px,clamp(10.14px,calc(2.07dvh_-_2.09px),13px))] rounded-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] px-[clamp(9.36px,calc(1.91dvh_-_1.93px),12px)] xl-screen:h-10 w-[clamp(53.04px,calc(10.81dvh_-_10.95px),68px)] flex flex-none items-center justify-center border border-modal-input-line bg-white/80 font-semibold">
        <input
          value={row.pct}
          inputMode="numeric"
          aria-label="Ownership %"
          onChange={(e) => onChange({ pct: clampPct(e.target.value.replace(/\D/g, "")) })}
          className="w-[clamp(28.08px,calc(5.72dvh_-_5.8px),36px)] bg-transparent text-right outline-none"
        />
        %
      </div>
      <div className="relative min-w-0 flex-1 pb-[clamp(8.58px,calc(1.75dvh_-_1.77px),11px)]">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={row.pct}
          aria-label="Ownership slider"
          onChange={(e) => onChange({ pct: Number(e.target.value) })}
          className="h-[clamp(20.28px,calc(4.13dvh_-_4.19px),26px)] w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none [&::-webkit-slider-runnable-track]:h-[max(4px,clamp(3.9px,calc(0.8dvh_-_0.81px),5px))] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:[background:var(--track)] [&::-webkit-slider-thumb]:size-[max(14px,clamp(13.26px,calc(2.7dvh_-_2.74px),17px))] [&::-webkit-slider-thumb]:mt-[calc((max(4px,clamp(3.9px,calc(0.8dvh_-_0.81px),5px))_-_max(14px,clamp(13.26px,calc(2.7dvh_-_2.74px),17px)))/2)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-[#2f8dff] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(13,96,255,0.4)] [&::-moz-range-track]:h-[max(4px,clamp(3.9px,calc(0.8dvh_-_0.81px),5px))] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:[background:var(--track)] [&::-moz-range-thumb]:size-[max(14px,clamp(13.26px,calc(2.7dvh_-_2.74px),17px))] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-[#2f8dff] [&::-moz-range-thumb]:bg-white"
          style={trackFill(row.pct)}
        />
        <span className="text-[9px] pointer-events-none absolute inset-x-0 bottom-0 flex justify-between text-dash-sub">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove account"
        className="w-[clamp(23.4px,calc(4.77dvh_-_4.83px),30px)] h-[clamp(23.4px,calc(4.77dvh_-_4.83px),30px)] rounded-[clamp(7.02px,calc(1.43dvh_-_1.45px),9px)] xl-screen:size-9 flex flex-none cursor-pointer items-center justify-center bg-rose-500/10 text-[#e11d48] transition-colors hover:bg-rose-500/20"
      >
        <Trash2 className="size-4" strokeWidth={2.2} />
      </button>
    </div>
  );
}

/**
 * One company row card of the Ownership page. Collapsed: code, allocation bar and Ungroup / Manage.
 * Expanded (Manage): the account rows with their ownership %, Add Account, External Partner and Cancel / Confirm.
 * Design preview: edits live in this card's own state; Confirm just closes it.
 * historicalLabel ("Sep 2026") marks the card as a past month: amber bar on the left, HISTORICAL tag and "Save Sep 2026".
 */
// Header buttons run their own action only: the whole header row also toggles the card, so the click must not bubble up.
const stop = (fn) => (e) => {
  e.stopPropagation();
  fn?.();
};

export default function OwnershipCard({ company, open, onToggle, historicalLabel }) {
  const [draft, setDraft] = useState(company.accounts);
  const [partner, setPartner] = useState("");
  const saved = totalAllocation(company.accounts);
  const total = open ? totalAllocation(draft) : saved;
  const remaining = 100 - total;
  const full = remaining === 0;

  // A row can never take more than what the other rows leave, so the total stays within 100%.
  const update = (id, patch) =>
    setDraft((rows) => {
      const others = rows.reduce((sum, r) => (r.id === id ? sum : sum + r.pct), 0);
      const next = "pct" in patch ? { ...patch, pct: Math.min(patch.pct, 100 - others) } : patch;
      return rows.map((r) => (r.id === id ? { ...r, ...next } : r));
    });
  const addRow = () => setDraft((rows) => [...rows, { id: `n${Date.now()}`, account: ACCOUNT_OPTIONS[0].value, pct: Math.max(0, remaining) }]);
  const close = (keep) => {
    if (!keep) setDraft(company.accounts);
    onToggle();
  };

  return (
    <div
      className={cn(
        "rounded-[clamp(12.48px,calc(2.54dvh_-_2.58px),16px)] flex-none bg-[linear-gradient(90deg,#ffffff_0%,#e6f0ff_50%,#cfe2fd_100%)] [filter:drop-shadow(0_2px_3px_rgba(15,23,42,0.1))]",
        historicalLabel && "shadow-[inset_5px_0_0_#f5a524]"
      )}
    >
      <div
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-colors hover:bg-brand-blue/[0.09]",
          open ? "rounded-t-[inherit]" : "rounded-[inherit]",
          "min-h-[clamp(60.84px,calc(12.4dvh_-_12.56px),78px)] px-[clamp(14.04px,calc(2.86dvh_-_2.9px),18px)] gap-[clamp(15.6px,calc(3.18dvh_-_3.22px),20px)] xl-screen:min-h-[100px] xl-screen:px-7 xl-screen:gap-8 flex items-center max-lg:flex-wrap"
        )}>
        <div className="w-[clamp(110px,17vw,clamp(202.8px,calc(41.34dvh_-_41.86px),260px))] xl-screen:w-[300px] flex-none">
          <h3 className="text-[length:max(15px,clamp(13.26px,calc(2.7dvh_-_2.74px),17px))] m-0 flex items-center gap-2 font-extrabold text-brand-navy">
            {company.code}
            <span className="text-[length:max(10px,clamp(8.19px,calc(1.67dvh_-_1.69px),10.5px))] px-[clamp(6.24px,calc(1.27dvh_-_1.29px),8px)] py-px rounded-full border border-[#bcd3fb] bg-[#e8f1ff] font-extrabold text-[#0b4fd0]">{company.group}</span>
            {historicalLabel && <span className="rounded-full border border-[#f2c869] bg-[#fff0d0] px-2 py-px text-[10px] font-extrabold tracking-[0.4px] text-[#a45a04]">HISTORICAL</span>}
          </h3>
          <div className="text-[length:max(10.5px,clamp(8.58px,calc(1.75dvh_-_1.77px),11px))] mt-[3px] text-dash-sub">{company.date}</div>
        </div>
        <div className="gap-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] xl-screen:gap-[22px] flex min-w-0 flex-1 items-center max-lg:basis-full max-lg:order-last">
          <span className="text-[length:max(10px,clamp(8.19px,calc(1.67dvh_-_1.69px),10.5px))] font-extrabold tracking-[0.4px] whitespace-nowrap text-brand-navy">TOTAL ALLOCATION</span>
          <span className="w-[clamp(87.36px,calc(17.81dvh_-_18.03px),112px)] text-[length:max(19px,clamp(17.94px,calc(3.66dvh_-_3.7px),23px))] flex-none font-extrabold tabular-nums text-[#0b57e8]">{formatPct(total)}</span>
          <span className="w-[max(104px,clamp(92.04px,calc(18.76dvh_-_19px),118px))] text-[length:max(10px,clamp(8.19px,calc(1.67dvh_-_1.69px),10.5px))] flex-none whitespace-nowrap text-dash-sub">{formatPct(remaining)} Remaining</span>
          <div className="h-[max(6px,clamp(5.46px,calc(1.11dvh_-_1.13px),7px))] min-w-[120px] flex-1 overflow-hidden rounded-full bg-white/75 shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)]">
            <div className="h-full rounded-full bg-brand-sweep transition-[width] duration-300" style={{ width: `${Math.min(100, total)}%` }} />
          </div>
        </div>
        <button type="button" title={NOT_BUILT} onClick={stop()} className={ungroupClass}>
          Ungroup
        </button>
        <button type="button" onClick={stop(onToggle)} className={cn(smallPrimary, "xl-screen:min-w-[104px]")}>
          Manage
        </button>
        <button type="button" onClick={stop(onToggle)} aria-label={open ? "Collapse" : "Expand"} className="cursor-pointer text-brand-navy">
          <ChevronDown className={cn("size-5 transition-transform xl-screen:size-6", open && "rotate-180")} strokeWidth={2.6} />
        </button>
      </div>

      {open && (
        <>
          <div className="mx-[clamp(9.36px,calc(1.91dvh_-_1.93px),12px)] mb-[clamp(9.36px,calc(1.91dvh_-_1.93px),12px)] px-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] py-[clamp(9.36px,calc(1.91dvh_-_1.93px),12px)] rounded-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] xl-screen:mx-5 xl-screen:mb-[18px] xl-screen:px-6 xl-screen:py-5 xl-screen:rounded-2xl border border-white/80 bg-white/55">
            <div className="flex">
              <Section className="w-[clamp(234px,calc(47.7dvh_-_48.3px),300px)] flex-none">Account</Section>
              <Section>Ownership %</Section>
            </div>
            {draft.map((row) => (
              <AccountRow key={row.id} row={row} onChange={(patch) => update(row.id, patch)} onRemove={() => setDraft((rows) => rows.filter((r) => r.id !== row.id))} />
            ))}
            <button
              type="button"
              onClick={addRow}
              className="h-[clamp(29.64px,calc(6.04dvh_-_6.12px),38px)] mt-[clamp(6.24px,calc(1.27dvh_-_1.29px),8px)] rounded-[clamp(9.36px,calc(1.91dvh_-_1.93px),12px)] text-[length:max(12px,clamp(10.14px,calc(2.07dvh_-_2.09px),13px))] xl-screen:h-[46px] xl-screen:mt-[14px] flex w-full cursor-pointer items-center justify-center gap-1 border-[1.5px] border-dashed border-[#8db4f5] bg-[#e8f1ff]/70 font-extrabold text-[#0b57e8] transition-colors hover:bg-[#e8f1ff]"
            >
              <Plus className="size-4" strokeWidth={2.6} />
              Add Account
            </button>

            <div className="mt-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] px-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] py-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] gap-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] rounded-[clamp(9.36px,calc(1.91dvh_-_1.93px),12px)] text-[length:max(12px,clamp(10.14px,calc(2.07dvh_-_2.09px),13px))] xl-screen:mt-4 xl-screen:px-[22px] xl-screen:py-4 xl-screen:gap-[14px] flex flex-wrap items-center border border-dashed border-modal-input-line bg-white/40">
              <b>External Partner</b>
              <input
                value={partner}
                onChange={(e) => setPartner(e.target.value.toUpperCase())}
                placeholder="LOGIN ID/GROUP ID"
                className="h-[clamp(26.52px,calc(5.41dvh_-_5.47px),34px)] text-[length:max(12px,clamp(10.14px,calc(2.07dvh_-_2.09px),13px))] rounded-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] px-[clamp(9.36px,calc(1.91dvh_-_1.93px),12px)] xl-screen:h-10 w-[clamp(156px,calc(31.8dvh_-_32.2px),200px)] min-w-[160px] border border-modal-input-line bg-white/80 font-medium whitespace-nowrap outline-none transition-[border-color,box-shadow] focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
                />
              <button type="button" title={NOT_BUILT} className={smallPrimary}>
                Link Partner
              </button>
              <small className="text-[length:max(10.5px,clamp(8.58px,calc(1.75dvh_-_1.77px),11px))] xl-screen:basis-auto xl-screen:ml-2 basis-full text-dash-sub">Share this company's read-only dashboard visibility with another independent owner.</small>
            </div>
          </div>

          <div className="px-[clamp(10.92px,calc(2.23dvh_-_2.25px),14px)] pb-[clamp(9.36px,calc(1.91dvh_-_1.93px),12px)] gap-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] xl-screen:px-6 xl-screen:pt-0.5 xl-screen:pb-5 flex items-center">
            <span className={cn("text-[length:max(12px,clamp(10.14px,calc(2.07dvh_-_2.09px),13px))] flex items-center gap-1 font-extrabold", full ? "text-emerald-600" : "text-amber-600")}>
              {full ? (
                <>
                  <Check className="size-4" strokeWidth={2.8} />
                  Fully Allocated
                </>
              ) : (
                `${formatPct(Math.abs(remaining))} ${remaining > 0 ? "left to allocate" : "over-allocated"}`
              )}
            </span>
            <SoftButton onClick={() => close(false)} className="h-[clamp(29.64px,calc(6.04dvh_-_6.12px),38px)] min-w-[clamp(87.36px,calc(17.81dvh_-_18.03px),112px)] px-[clamp(17.16px,calc(3.5dvh_-_3.54px),22px)] text-[length:max(12.5px,clamp(10.53px,calc(2.15dvh_-_2.17px),13.5px))] rounded-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] xl-screen:h-[42px] ml-auto">
              Cancel
            </SoftButton>
            <button
              type="button"
              onClick={() => close(true)}
              disabled={remaining < 0}
              className={cn(primaryButtonClass, "h-[clamp(29.64px,calc(6.04dvh_-_6.12px),38px)] min-w-[clamp(87.36px,calc(17.81dvh_-_18.03px),112px)] px-[clamp(17.16px,calc(3.5dvh_-_3.54px),22px)] text-[length:max(12.5px,clamp(10.53px,calc(2.15dvh_-_2.17px),13.5px))] rounded-[clamp(7.8px,calc(1.59dvh_-_1.61px),10px)] xl-screen:h-[42px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none")}
            >
              <Check className="size-[15px]" strokeWidth={2.5} />
              {historicalLabel ? `Save ${historicalLabel}` : "Confirm"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
