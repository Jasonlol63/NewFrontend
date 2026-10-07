import { useState } from "react";
import { Check, ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import { SoftButton, TextInput, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import { ACCOUNT_OPTIONS, clampPct, formatPct, totalAllocation } from "./ownershipRules";

const NOT_BUILT = "Not available yet";

// Same blue as Save in the form modals, for Manage / Link Partner.
const smallPrimary = cn(primaryButtonClass, "h-[30px] px-3.5 text-[12.5px]");

// Danger action kept quiet: white glass with a rose outline.
const ungroupClass =
  "inline-flex h-[30px] flex-none cursor-not-allowed items-center justify-center rounded-[10px] border border-[#fbc4cf] bg-white/75 px-3.5 text-[12.5px] font-bold text-[#e11d48] shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-colors hover:bg-[#fff1f4]";

function Section({ children, className }) {
  return (
    <div className={cn("flex items-center gap-2 text-[11.5px] font-extrabold tracking-[0.4px] text-brand-navy uppercase", className)}>
      <span className="h-3.5 w-1 flex-none rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
      {children}
    </div>
  );
}

// Blue-filled range: the track is painted up to the value, the thumb is a white ring.
const sliderClass =
  "h-5 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none " +
  "[&::-webkit-slider-runnable-track]:h-[5px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:[background:var(--track)] " +
  "[&::-webkit-slider-thumb]:-mt-[6px] [&::-webkit-slider-thumb]:size-[17px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-[#2f8dff] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(13,96,255,0.4)] " +
  "[&::-moz-range-track]:h-[5px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:[background:var(--track)] " +
  "[&::-moz-range-thumb]:size-[13px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-[#2f8dff] [&::-moz-range-thumb]:bg-white";

const trackFill = (pct) => ({
  "--track": `linear-gradient(100deg,#0a3fc9 0%,#2f8dff ${pct / 2 + 25}%,#3fc4ff ${Math.max(pct, 1)}%,#dbe7fa ${Math.max(pct, 1)}%)`,
});

function AccountRow({ row, onChange, onRemove }) {
  return (
    <div className="mt-2 flex items-center gap-3.5 rounded-xl border border-dash-line border-l-[3px] border-l-[#2f8dff] bg-white px-3 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <GripVertical className="size-4 flex-none cursor-grab text-slate-300" />
      <DropdownSelect
        options={ACCOUNT_OPTIONS}
        value={row.account}
        onChange={(account) => onChange({ account })}
        ariaLabel="Account"
        className="h-[34px] w-[clamp(180px,22vw,270px)] flex-none"
      />
      <div className="flex h-[34px] w-[68px] flex-none items-center justify-center rounded-[10px] border border-modal-input-line bg-white/80 text-[13px] font-semibold">
        <input
          value={row.pct}
          inputMode="numeric"
          aria-label="Ownership %"
          onChange={(e) => onChange({ pct: clampPct(e.target.value.replace(/\D/g, "")) })}
          className="w-9 bg-transparent text-right outline-none"
        />
        %
      </div>
      <div className="relative min-w-0 flex-1 pb-3">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={row.pct}
          aria-label="Ownership slider"
          onChange={(e) => onChange({ pct: Number(e.target.value) })}
          className={sliderClass}
          style={trackFill(row.pct)}
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between text-[9px] text-dash-sub">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove account"
        className="flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-[9px] bg-rose-500/10 text-[#e11d48] transition-colors hover:bg-rose-500/20"
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
 */
export default function OwnershipCard({ company, open, onToggle }) {
  const [draft, setDraft] = useState(company.accounts);
  const [partner, setPartner] = useState("");
  const saved = totalAllocation(company.accounts);
  const total = open ? totalAllocation(draft) : saved;
  const remaining = 100 - total;
  const full = remaining === 0;

  const update = (id, patch) => setDraft((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setDraft((rows) => [...rows, { id: `n${Date.now()}`, account: ACCOUNT_OPTIONS[0].value, pct: Math.max(0, remaining) }]);
  const close = (keep) => {
    if (!keep) setDraft(company.accounts);
    onToggle();
  };

  return (
    <div className="flex-none rounded-2xl bg-[linear-gradient(90deg,#ffffff_0%,#e6f0ff_50%,#cfe2fd_100%)] [filter:drop-shadow(0_2px_3px_rgba(15,23,42,0.1))]">
      <div className="flex min-h-[72px] items-center gap-5 px-[18px] py-3 max-lg:flex-wrap">
        <div className="w-[clamp(120px,17vw,260px)] flex-none">
          <h3 className="m-0 flex items-center gap-2 text-[17px] font-extrabold text-brand-navy">
            {company.code}
            <span className="rounded-full border border-[#bcd3fb] bg-[#e8f1ff] px-2 py-px text-[10.5px] font-extrabold text-[#0b4fd0]">{company.group}</span>
          </h3>
          <div className="mt-1 text-[11px] text-dash-sub">{company.date}</div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3.5 max-lg:basis-full max-lg:order-last">
          <span className="text-[10.5px] font-extrabold tracking-[0.4px] whitespace-nowrap text-brand-navy">TOTAL ALLOCATION</span>
          <span className="w-[104px] flex-none text-[23px] font-extrabold tabular-nums text-[#0b57e8]">{formatPct(total)}</span>
          <span className="w-[104px] flex-none text-[10.5px] whitespace-nowrap text-dash-sub">{formatPct(remaining)} Remaining</span>
          <div className="h-[7px] min-w-[120px] flex-1 overflow-hidden rounded-full bg-white/75 shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)]">
            <div className="h-full rounded-full bg-brand-sweep transition-[width] duration-300" style={{ width: `${Math.min(100, total)}%` }} />
          </div>
        </div>
        <button type="button" title={NOT_BUILT} className={ungroupClass}>
          Ungroup
        </button>
        <button type="button" onClick={onToggle} className={smallPrimary}>
          Manage
        </button>
        <button type="button" onClick={onToggle} aria-label={open ? "Collapse" : "Expand"} className="cursor-pointer text-brand-navy">
          <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} strokeWidth={2.6} />
        </button>
      </div>

      {open && (
        <>
          <div className="mx-3 rounded-[14px] border border-white/80 bg-white/55 px-3.5 py-3">
            <div className="flex">
              <Section className="w-[clamp(180px,22vw,270px)] flex-none">Account</Section>
              <Section className="ml-[88px]">Ownership %</Section>
            </div>
            {draft.map((row) => (
              <AccountRow key={row.id} row={row} onChange={(patch) => update(row.id, patch)} onRemove={() => setDraft((rows) => rows.filter((r) => r.id !== row.id))} />
            ))}
            <button
              type="button"
              onClick={addRow}
              className="mt-2 flex h-[38px] w-full cursor-pointer items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-[#8db4f5] bg-[#e8f1ff]/70 text-[13px] font-extrabold text-[#0b57e8] transition-colors hover:bg-[#e8f1ff]"
            >
              <Plus className="size-4" strokeWidth={2.6} />
              Add Account
            </button>

            <div className="mt-2.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-modal-input-line bg-white/40 px-3.5 py-2.5">
              <b className="text-[13px]">External Partner</b>
              <TextInput
                value={partner}
                onChange={(e) => setPartner(e.target.value.toUpperCase())}
                placeholder="LOGIN ID/GROUP ID"
                className="h-[34px] w-[170px]"
              />
              <button type="button" title={NOT_BUILT} className={smallPrimary}>
                Link Partner
              </button>
              <small className="basis-full text-[11px] text-dash-sub">Share this company's read-only dashboard visibility with another independent owner.</small>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3.5 pb-3 pt-2.5">
            <span className={cn("flex items-center gap-1 text-[13px] font-extrabold", full ? "text-emerald-600" : "text-amber-600")}>
              {full ? (
                <>
                  <Check className="size-4" strokeWidth={2.8} />
                  Fully Allocated
                </>
              ) : (
                `${formatPct(Math.abs(remaining))} ${remaining > 0 ? "left to allocate" : "over-allocated"}`
              )}
            </span>
            <SoftButton onClick={() => close(false)} className="ml-auto h-[38px] min-w-[112px] px-[22px] text-[13.5px]">
              Cancel
            </SoftButton>
            <button
              type="button"
              onClick={() => close(true)}
              disabled={remaining < 0}
              className={cn(primaryButtonClass, "h-[38px] min-w-[112px] px-[22px] text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none")}
            >
              <Check className="size-[15px]" strokeWidth={2.5} />
              Confirm
            </button>
          </div>
        </>
      )}
    </div>
  );
}
