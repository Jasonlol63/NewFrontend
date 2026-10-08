import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import FormCard, { CardCount } from "@/components/shared/form-modal/FormCard.jsx";
import { AddButton, SelectField, TextInput, inputClass } from "@/components/shared/form-modal/fields.jsx";

// Profit Sharing of the Bank Process modal, filled in right inside the card (no pop-up):
//   "+ Select" opens a panel at the top with one row per account (Account, "+" / Edit, Amount, "%"); "+ Add Account" adds
//   a row, so several accounts go in with one Add. The "%" button opens a small percent box (joined to a "%" cell):
//   typing a percentage fills Amount with that share of the profit (and greys it); typing an amount by hand clears it.
//   The list below always shows amounts.
// Class names are written out in full so Tailwind can see them.

const blankRow = () => ({ account: "", amount: "", pct: "", pctOpen: false });
const numeric = (v) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// As tall as an input at every modal height tier.
const square = "size-9 @min-[900px]/main:@max-[1099px]/main:size-8 modal-compact:size-[30px] modal-tiny:size-7";
const pill = "inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border text-[12px] font-bold";

function ColumnLabel({ children }) {
  return (
    <span className="mb-1 ml-0.5 block truncate text-[12.5px] font-semibold text-[#374151] modal-compact:mb-0.5 modal-compact:text-[12px]">
      {children} <i className="not-italic text-[#ef4444]">*</i>
    </span>
  );
}

/**
 * entries: [{ account, amount }] (amount as text, 2 decimals); onChange(next entries).
 * accounts: [{ value, label }] to choose from; profit: sell - buy, the base of a percentage; currency: shown before amounts.
 * onAccount({ mode: "add" | "edit", value, apply(newValue) }): the "+" / edit button of a row asks the page to open Add / Edit Account.
 */
export default function BankProfitSharing({ entries, onChange, accounts, profit, currency, onAccount }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => [blankRow()]);

  const ready = rows.filter((r) => r.account && Number(r.amount) > 0);
  const takenBy = (index) => new Set([...entries.map((e) => e.account), ...rows.filter((r, i) => i !== index && r.account).map((r) => r.account)]);
  const patch = (index, next) => setRows((list) => list.map((r, i) => (i === index ? { ...r, ...next } : r)));
  const close = () => {
    setOpen(false);
    setRows([blankRow()]);
  };
  const addAll = () => {
    if (!ready.length) return;
    onChange([...entries, ...ready.map((r) => ({ account: r.account, amount: Number(r.amount).toFixed(2) }))]);
    close();
  };
  const onEnter = (e) => e.key === "Enter" && addAll();

  const headerRight = (
    <>
      <CardCount>{entries.length} selected</CardCount>
      {open ? (
        <>
          <button type="button" onClick={close} className={cn(pill, "border-[#7fb2ff] bg-white/70 px-2.5 text-[#1d4ed8] hover:bg-white")}>
            Cancel
          </button>
          <button
            type="button"
            onClick={addAll}
            disabled={!ready.length}
            className={cn(
              pill,
              "pr-2.5 pl-1.5 transition-colors",
              ready.length ? "border-transparent bg-brand-sweep text-white shadow-[0_6px_12px_-6px_rgba(20,90,220,0.6)] hover:brightness-105" : "cursor-not-allowed border-[#d5deea] bg-white/60 text-[#94a3b8]"
            )}
          >
            <Check className="size-3.5" strokeWidth={2.8} />
            Add{ready.length > 1 ? ` (${ready.length})` : ""}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={cn(pill, "border-[#7fb2ff] bg-white/70 pr-2.5 pl-1.5 text-[#1d4ed8] hover:bg-white")}>
          <Plus className="size-3.5" strokeWidth={2.8} />
          Select
        </button>
      )}
    </>
  );

  return (
    <FormCard
      title="Profit Sharing"
      className="flex-1 @max-[899px]/main:flex-none @max-[899px]/main:overflow-visible"
      bodyClassName="flex flex-col gap-2 @max-[899px]/main:overflow-visible"
      right={headerRight}
    >
      {open && (
        <div className="flex flex-none flex-col gap-2 rounded-xl border border-[#bfd8ff] bg-[linear-gradient(180deg,rgba(240,248,255,0.9),rgba(226,239,255,0.7))] p-2.5 modal-compact:gap-1.5 modal-compact:p-2">
          {rows.map((row, i) => {
            const taken = takenBy(i);
            const options = accounts.filter((a) => a.value === row.account || !taken.has(a.value));
            return (
              <div key={i} className="flex flex-wrap items-end gap-1.5">
                <div className="min-w-[110px] flex-[1_1_140px]">
                  {i === 0 && <ColumnLabel>Account</ColumnLabel>}
                  <SelectField
                    value={row.account}
                    onChange={(account) => patch(i, { account })}
                    onClear={() => patch(i, { account: "" })}
                    options={options}
                    placeholder="Select Account"
                  />
                </div>
                <AddButton
                  edit={Boolean(row.account)}
                  label={row.account ? "Edit account" : "Add account"}
                  onClick={() => onAccount?.({ mode: row.account ? "edit" : "add", value: row.account, apply: (account) => patch(i, { account }) })}
                />
                <div className="w-[110px] flex-none @min-[1500px]/main:w-[150px]">
                  {i === 0 && <ColumnLabel>Amount</ColumnLabel>}
                  <TextInput
                    value={row.amount}
                    onChange={(e) => patch(i, { amount: numeric(e.target.value), pct: "" })}
                    onKeyDown={onEnter}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    className={cn("text-right font-bold tabular-nums", row.pct && "bg-modal-off text-[#6b7280]")}
                  />
                </div>
                {row.pctOpen ? (
                  <div className={cn(inputClass, "flex w-[78px] flex-none items-stretch overflow-hidden p-0 @min-[1500px]/main:w-[96px]", row.pct && "border-[#7fb2ff]")}>
                    <input
                      autoFocus
                      value={row.pct}
                      onChange={(e) => {
                        const pct = numeric(e.target.value);
                        patch(i, { pct, amount: pct ? ((profit * Number(pct)) / 100).toFixed(2) : "" });
                      }}
                      onKeyDown={onEnter}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      aria-label="Percent of the profit"
                      className="min-w-0 flex-1 border-none bg-transparent px-1.5 text-right font-bold tabular-nums outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => patch(i, { pctOpen: false, pct: "" })}
                      title="Back to typing the amount"
                      className="flex w-7 flex-none cursor-pointer items-center justify-center border-l border-[#c5dcfb] bg-[#e8f1ff] text-[13px] font-bold text-[#1d4ed8] hover:bg-[#d6e8ff]"
                    >
                      %
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={profit <= 0}
                    onClick={() => patch(i, { pctOpen: true })}
                    title={profit > 0 ? "Work out the amount as a percentage of the profit" : "Enter Buy and Sell price first"}
                    className={cn(square, "flex-none cursor-pointer rounded-[10px] border border-[#c5dcfb] bg-[#e8f1ff] text-[13px] font-bold text-[#1d4ed8] transition-colors hover:bg-[#d6e8ff] disabled:cursor-not-allowed disabled:opacity-45")}
                  >
                    %
                  </button>
                )}
                {rows.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove row"
                    title="Remove"
                    onClick={() => setRows((list) => list.filter((_, j) => j !== i))}
                    className="mb-0.5 flex size-7 flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-[#94a3b8] hover:bg-[#fee2e2] hover:text-[#ef4444]"
                  >
                    <X className="size-4" strokeWidth={2.2} />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setRows((list) => [...list, blankRow()])}
            className="flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#7fb2ff] bg-[rgba(232,242,255,0.55)] text-[13px] font-bold text-[#1d4ed8] hover:bg-[#dbeaff] modal-compact:h-7"
          >
            <Plus className="size-3.5" strokeWidth={2.6} />
            Add Account
          </button>
        </div>
      )}

      {entries.length === 0 && !open && <p className="m-0 px-0.5 py-1.5 text-[12.5px] italic text-[#8a96a8]">No profit sharing selected</p>}
      {entries.map((entry) => (
        <div key={entry.account} className="flex flex-none items-center gap-2.5 overflow-hidden rounded-[10px] border border-[#bfd8ff] bg-row-stripe py-1.5 pr-2 pl-0">
          <span className="w-1 flex-none self-stretch rounded-sm bg-[#3b82f6]" />
          <b className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-brand-navy">{entry.account}</b>
          <span className="flex-none rounded-lg border border-[#bcd9fb] bg-white px-2.5 py-0.5 text-[13px] font-extrabold text-[#1d4ed8] tabular-nums">
            {currency} {money(Number(entry.amount) || 0)}
          </span>
          <button
            type="button"
            aria-label={`Remove ${entry.account}`}
            onClick={() => onChange(entries.filter((e) => e.account !== entry.account))}
            className="flex size-7 flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-[#fee2e2] text-[#ef4444] hover:bg-[#fecaca]"
          >
            <Trash2 className="size-3.5" strokeWidth={2.4} />
          </button>
        </div>
      ))}
    </FormCard>
  );
}
