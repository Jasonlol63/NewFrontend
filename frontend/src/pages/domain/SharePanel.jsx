import { useState } from "react";
import { CalendarDays, Lock, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SelectField, TextInput } from "@/components/shared/form-modal/fields.jsx";
import { ACCOUNTS, AMOUNT_PATTERN, DEPARTMENTS, PROFIT_ACCOUNT, amountOf, fmt, newRowId, pctOf, round2, splitEqually } from "./domainSettingsRules";

// Share % of a company / group: the price of the picked period is 100%, Sales / CS / IT take part of it and
// Profit (C168, locked) is what is left. Everything is visible at once: the price line, the Profit strip, one
// card per department and the accounts of the picked department. Sizes follow the modal height tiers
// (modal-compact / modal-tiny) so it fits without scrolling; only a long account list scrolls on its own.

const pct2 = (n) => `${round2(n).toFixed(2)}%`;
const unusedAccounts = (rows) => ACCOUNTS.filter((a) => !rows.some((r) => r.account === a));

/**
 * kindLabel: "Company" | "Group"; period: { label } or null; price: the 100% amount (0 = no period yet)
 * departments: { sales: rows, cs: rows, it: rows } with rows = [{ id, account, pct }]
 * summary: shareSummary(price, departments); onChange(departmentKey, rows)
 * The panel is disabled while Share is off (wrap it in a disabled fieldset).
 */
export default function SharePanel({ kindLabel, period, price, departments, summary, onChange }) {
  const [active, setActive] = useState(DEPARTMENTS[0].key);
  const department = DEPARTMENTS.find((d) => d.key === active);
  const rows = departments[active];
  const noPrice = price <= 0;
  const spent = summary.departments[active];

  const patchRow = (id, next) =>
    onChange(
      active,
      rows.map((r) => (r.id === id ? next : r)),
    );
  const removeRow = (id) =>
    onChange(
      active,
      rows.filter((r) => r.id !== id),
    );
  const addRow = () => onChange(active, [...rows, { id: newRowId(), account: unusedAccounts(rows)[0] ?? "", pct: 0 }]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 modal-tiny:gap-1.5">
      <div className="flex flex-none items-center gap-2 rounded-[10px] bg-[rgba(238,244,255,0.7)] px-2.5 py-1.5 text-[12px] text-[#5b74a3] modal-tiny:py-1">
        <CalendarDays className="size-3.5 flex-none text-brand-blue" strokeWidth={2.2} />
        {period ? (
          <>
            <span className="min-w-0 truncate">
              {kindLabel} price for <b className="font-bold text-brand-navy">{period.label}</b>
            </span>
            <b className="ml-auto flex-none font-bold tabular-nums text-brand-navy">{noPrice ? "Not set" : `${fmt(price)} · 100%`}</b>
          </>
        ) : (
          <span>Pick a Period to set the share</span>
        )}
      </div>

      <div className="relative flex flex-none items-center gap-3 overflow-hidden rounded-xl border border-white/90 bg-white/80 py-2 pr-3 pl-4 modal-tiny:py-1.5">
        <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-blue" />
        <b className="text-[15px] font-extrabold text-brand-navy modal-tiny:text-[14px]">Profit</b>
        <span className="flex min-w-0 items-center gap-1 text-[12.5px] font-bold text-brand-navy">
          {PROFIT_ACCOUNT}
          <Lock className="size-3 flex-none text-dash-faint" strokeWidth={2.4} />
        </span>
        <div className="ml-auto flex flex-none flex-col items-end leading-tight">
          <span className="text-[10px] font-semibold tracking-[0.3px] text-[#6b7fa5] modal-tiny:hidden">TOTAL AMOUNT</span>
          <div className="flex items-baseline gap-2">
            <b className={cn("text-[clamp(17px,2.6dvh,21px)] font-extrabold tabular-nums", summary.over ? "text-[#dc2626]" : "text-brand-blue")}>
              {fmt(summary.profit.amount)}
            </b>
            <em
              className={cn(
                "rounded-full px-2 text-[12px] font-bold not-italic tabular-nums",
                summary.over ? "bg-[#fee2e2] text-[#dc2626]" : "bg-[#e8f0ff] text-brand-blue",
              )}
            >
              {pct2(summary.profit.pct)}
            </em>
          </div>
        </div>
      </div>

      <div className="grid flex-none grid-cols-3 gap-1.5">
        {DEPARTMENTS.map((d) => {
          const total = summary.departments[d.key];
          const on = d.key === active;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => setActive(d.key)}
              style={{ "--c": d.color }}
              className={cn(
                "relative min-w-0 cursor-pointer overflow-hidden rounded-[11px] border py-1.5 pr-2 pl-3 text-left transition-colors modal-tiny:py-1",
                on ? "border-[#9dbcf5] bg-white shadow-[0_6px_14px_-10px_rgba(20,70,160,0.6)]" : "border-white/80 bg-white/50 hover:bg-white/70",
              )}
            >
              <span className="absolute inset-y-0 left-0 w-[3px] bg-(--c)" />
              <span className="flex items-center justify-between gap-1 text-[12px] font-bold text-brand-navy">
                {d.label}
                <span className="truncate text-[10px] font-medium text-[#6b7fa5]">{total.count ? `${total.count} acc.` : "Not set"}</span>
              </span>
              <span className={cn("mt-px flex flex-wrap items-baseline gap-x-1.5 tabular-nums", total.count ? "text-brand-navy" : "text-[#8a96a8]")}>
                <b className="text-[clamp(14px,2.1dvh,17px)] font-extrabold">{fmt(total.amount)}</b>
                <em className={cn("text-[11.5px] font-bold not-italic", total.count && "text-(--c)")}>{pct2(total.pct)}</em>
              </span>
              <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-[#dbe5f5] modal-tiny:hidden">
                <i className="block h-full bg-(--c)" style={{ width: `${Math.min(100, Math.max(0, total.pct))}%` }} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-xl border border-[#b9d0f7] bg-white/80 py-2.5 pr-3 pl-4 modal-tiny:gap-1.5 modal-tiny:py-2">
        <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: department.color }} />
        <div className="flex flex-none items-center gap-2">
          <b className="text-[13.5px] font-extrabold text-brand-navy">{department.label}</b>
          <span className="min-w-0 truncate text-[11.5px] text-[#6b7fa5] @max-[599px]/main:hidden">Commission · amount per account</span>
          <button
            type="button"
            disabled={noPrice || !rows.length || spent.pct <= 0}
            onClick={() => onChange(active, splitEqually(rows))}
            className="ml-auto flex-none cursor-pointer border-none bg-transparent p-0 text-[12px] font-bold text-brand-blue hover:underline disabled:cursor-not-allowed disabled:text-dash-faint disabled:no-underline"
          >
            Split equally
          </button>
        </div>

        {rows.length > 0 && (
          <div className="grid flex-none grid-cols-[minmax(0,1fr)_minmax(72px,0.75fr)_minmax(64px,0.55fr)_22px] gap-2 text-[10px] font-semibold tracking-[0.3px] text-[#6b7fa5]">
            <span>ACCOUNT</span>
            <span className="text-right">AMOUNT</span>
            <span className="text-right">%</span>
            <span />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] modal-tiny:gap-1 @max-[699px]/main:overflow-visible">
          {rows.map((row) => (
            <AccountRow
              key={row.id}
              row={row}
              price={price}
              noPrice={noPrice}
              options={ACCOUNTS.filter((a) => a === row.account || !rows.some((r) => r.account === a)).map((a) => ({ value: a, label: a }))}
              onChange={(next) => patchRow(row.id, next)}
              onRemove={() => removeRow(row.id)}
            />
          ))}
          {!rows.length && <p className="m-0 flex-none py-1 text-[12px] text-[#8a96a8]">No accounts yet. Add one to share part of the price.</p>}
          <button
            type="button"
            onClick={addRow}
            disabled={!unusedAccounts(rows).length}
            className="flex h-9 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#9dbcf5] bg-white/50 text-[13px] font-bold text-brand-blue transition-colors hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50 modal-compact:h-8 modal-tiny:h-7"
          >
            <Plus className="size-3.5" strokeWidth={2.6} />
            Add Account
          </button>
        </div>

        <div className="flex flex-none items-center justify-between border-t border-[#dbe5f5] pt-1.5 text-[12px] text-[#41588a]">
          <span>{department.label} total</span>
          <b className="font-bold tabular-nums text-brand-navy">
            {fmt(spent.amount)} · {pct2(spent.pct)}
          </b>
        </div>
      </div>
    </div>
  );
}

/**
 * One account: dropdown, amount and percentage. Typing in one box works out the other from the price; the box
 * being typed in keeps exactly what was typed until it loses focus.
 */
function AccountRow({ row, price, noPrice, options, onChange, onRemove }) {
  const [edit, setEdit] = useState(null); // { field: "amount" | "pct", text }

  const shown = (field) => {
    if (edit?.field === field) return edit.text;
    return field === "amount" ? amountOf(price, row.pct).toFixed(2) : round2(row.pct).toFixed(2);
  };
  const type = (field, text) => {
    if (!AMOUNT_PATTERN.test(text)) return;
    setEdit({ field, text });
    const n = parseFloat(text) || 0;
    onChange({ ...row, pct: field === "amount" ? pctOf(price, n) : n });
  };

  return (
    <div className="grid flex-none grid-cols-[minmax(0,1fr)_minmax(72px,0.75fr)_minmax(64px,0.55fr)_22px] items-center gap-2">
      <SelectField value={row.account} onChange={(account) => onChange({ ...row, account })} options={options} placeholder="Select account" />
      <TextInput
        value={shown("amount")}
        onChange={(e) => type("amount", e.target.value)}
        onBlur={() => setEdit(null)}
        inputMode="decimal"
        disabled={noPrice}
        aria-label={`${row.account || "Account"} amount`}
        className="px-2.5 text-right tabular-nums disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="relative">
        <TextInput
          value={shown("pct")}
          onChange={(e) => type("pct", e.target.value)}
          onBlur={() => setEdit(null)}
          inputMode="decimal"
          aria-label={`${row.account || "Account"} percentage`}
          className="pr-6 pl-2 text-right tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-dash-faint">%</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${row.account || "account"}`}
        className="grid size-[22px] flex-none cursor-pointer place-items-center rounded-md border-none bg-transparent p-0 text-[#8a98b0] hover:bg-[#ffe4e8] hover:text-[#d4566a]"
      >
        <X className="size-3.5" strokeWidth={2.6} />
      </button>
    </div>
  );
}
