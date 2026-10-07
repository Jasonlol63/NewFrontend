import { useState } from "react";
import { Check, ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";
import { SoftButton, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";
import { ACCOUNT_OPTIONS, clampPct, formatPct, totalAllocation } from "./ownershipRules";

const NOT_BUILT = "Not available yet";

// Same blue as Save in the form modals, for Manage / Link Partner.
const smallPrimary = cn(primaryButtonClass, "own-btn-sm");

// Danger action kept quiet: white glass with a rose outline.
const ungroupClass =
  "own-btn-sm inline-flex flex-none cursor-not-allowed items-center justify-center border border-[#fbc4cf] bg-white/75 font-bold text-[#e11d48] shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-colors hover:bg-[#fff1f4]";

function Section({ children, className }) {
  return (
    <div className={cn("own-sec flex items-center gap-2 font-extrabold tracking-[0.4px] text-brand-navy uppercase", className)}>
      {children}
    </div>
  );
}

const trackFill = (pct) => ({
  "--track": `linear-gradient(100deg,#0a3fc9 0%,#2f8dff ${pct / 2 + 25}%,#3fc4ff ${Math.max(pct, 1)}%,#dbe7fa ${Math.max(pct, 1)}%)`,
});

function AccountRow({ row, onChange, onRemove }) {
  return (
    <div className="own-acc flex items-center border border-dash-line border-l-[3px] border-l-[#2f8dff] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <GripVertical className="size-4 flex-none cursor-grab text-slate-300" />
      <DropdownSelect
        options={ACCOUNT_OPTIONS}
        value={row.account}
        onChange={(account) => onChange({ account })}
        ariaLabel="Account"
        className="own-select flex-none"
      />
      <div className="own-input own-pct flex flex-none items-center justify-center border border-modal-input-line bg-white/80 font-semibold">
        <input
          value={row.pct}
          inputMode="numeric"
          aria-label="Ownership %"
          onChange={(e) => onChange({ pct: clampPct(e.target.value.replace(/\D/g, "")) })}
          className="bg-transparent text-right outline-none"
        />
        %
      </div>
      <div className="relative min-w-0 flex-1 pb-[calc(11px*var(--k))]">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={row.pct}
          aria-label="Ownership slider"
          onChange={(e) => onChange({ pct: Number(e.target.value) })}
          className="own-range"
          style={trackFill(row.pct)}
        />
        <span className="own-ticks pointer-events-none absolute inset-x-0 bottom-0 flex justify-between text-dash-sub">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove account"
        className="own-del flex flex-none cursor-pointer items-center justify-center bg-rose-500/10 text-[#e11d48] transition-colors hover:bg-rose-500/20"
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
    <div className="own-card flex-none bg-[linear-gradient(90deg,#ffffff_0%,#e6f0ff_50%,#cfe2fd_100%)] [filter:drop-shadow(0_2px_3px_rgba(15,23,42,0.1))]">
      <div className="own-head flex items-center max-lg:flex-wrap">
        <div className="own-name flex-none">
          <h3 className="own-code m-0 flex items-center gap-2 font-extrabold text-brand-navy">
            {company.code}
            <span className="own-tag rounded-full border border-[#bcd3fb] bg-[#e8f1ff] font-extrabold text-[#0b4fd0]">{company.group}</span>
          </h3>
          <div className="own-date text-dash-sub">{company.date}</div>
        </div>
        <div className="own-alloc flex min-w-0 flex-1 items-center max-lg:basis-full max-lg:order-last">
          <span className="own-alloc-title font-extrabold tracking-[0.4px] whitespace-nowrap text-brand-navy">TOTAL ALLOCATION</span>
          <span className="own-pc flex-none font-extrabold tabular-nums text-[#0b57e8]">{formatPct(total)}</span>
          <span className="own-rem flex-none whitespace-nowrap text-dash-sub">{formatPct(remaining)} Remaining</span>
          <div className="own-bar min-w-[120px] flex-1 overflow-hidden rounded-full bg-white/75 shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)]">
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
          <div className="own-body border border-white/80 bg-white/55">
            <div className="flex">
              <Section className="own-col-account flex-none">Account</Section>
              <Section>Ownership %</Section>
            </div>
            {draft.map((row) => (
              <AccountRow key={row.id} row={row} onChange={(patch) => update(row.id, patch)} onRemove={() => setDraft((rows) => rows.filter((r) => r.id !== row.id))} />
            ))}
            <button
              type="button"
              onClick={addRow}
              className="own-add flex w-full cursor-pointer items-center justify-center gap-1 border-[1.5px] border-dashed border-[#8db4f5] bg-[#e8f1ff]/70 font-extrabold text-[#0b57e8] transition-colors hover:bg-[#e8f1ff]"
            >
              <Plus className="size-4" strokeWidth={2.6} />
              Add Account
            </button>

            <div className="own-ext flex flex-wrap items-center border border-dashed border-modal-input-line bg-white/40">
              <b>External Partner</b>
              <input
                value={partner}
                onChange={(e) => setPartner(e.target.value.toUpperCase())}
                placeholder="LOGIN ID/GROUP ID"
                className="own-input own-partner-input border border-modal-input-line bg-white/80 font-medium whitespace-nowrap outline-none transition-[border-color,box-shadow] focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
                />
              <button type="button" title={NOT_BUILT} className={smallPrimary}>
                Link Partner
              </button>
              <small className="basis-full text-dash-sub">Share this company's read-only dashboard visibility with another independent owner.</small>
            </div>
          </div>

          <div className="own-foot flex items-center">
            <span className={cn("own-foot-note flex items-center gap-1 font-extrabold", full ? "text-emerald-600" : "text-amber-600")}>
              {full ? (
                <>
                  <Check className="size-4" strokeWidth={2.8} />
                  Fully Allocated
                </>
              ) : (
                `${formatPct(Math.abs(remaining))} ${remaining > 0 ? "left to allocate" : "over-allocated"}`
              )}
            </span>
            <SoftButton onClick={() => close(false)} className="own-btn-big ml-auto">
              Cancel
            </SoftButton>
            <button
              type="button"
              onClick={() => close(true)}
              disabled={remaining < 0}
              className={cn(primaryButtonClass, "own-btn-big disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none")}
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
