import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { CalendarDays, Lock, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SelectField, TextInput } from "@/components/shared/form-modal/fields.jsx";
import { AMOUNT_PATTERN, DEPARTMENTS, PROFIT_ACCOUNT, amountOf, fmt, newRowId, pctOf, round2, splitEqually } from "./domainSettingsRules";

// Share % of a company / group: the price of the picked period is 100%, Sales / CS / IT take part of it and
// Profit (C168, locked) is what is left. Everything is visible at once: the price line, the Profit card (with a
// bar showing who takes how much), one small tab card per department and the accounts of the picked department.
// Profit, the three tabs and the account panel share one look: a 3px line in the department colour at the left
// edge (no left border, clipped by the rounded corners). The tabs grow with the screen height
// (modal-compact / default / modal-roomy / modal-tall); only a long account list scrolls on its own.

const pct2 = (n) => `${round2(n).toFixed(2)}%`;
const PROFIT_COLOR = "#2f6fef";

/**
 * kindLabel: "Company" | "Group"; period: { label } or null; price: the 100% amount (0 = no period yet)
 * departments: { sales: rows, cs: rows, it: rows } with rows = [{ id, account, pct }]
 * summary: shareSummary(price, departments); accounts: the account codes that can take a share; onChange(departmentKey, rows)
 * The panel is disabled while Share is off (wrap it in a disabled fieldset).
 */
export default function SharePanel({ kindLabel, period, price, departments, summary, accounts, onChange }) {
  const { t } = useTranslation("domain");
  const [active, setActive] = useState(DEPARTMENTS[0].key);
  const activeIndex = DEPARTMENTS.findIndex((d) => d.key === active);
  const department = DEPARTMENTS[activeIndex];
  const rows = departments[active];
  const noPrice = price <= 0;
  const spent = summary.departments[active];
  const unusedAccounts = (list) => accounts.filter((a) => !list.some((r) => r.account === a));

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
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 modal-compact:gap-2 modal-tiny:gap-1.5">
      <div className="flex flex-none items-center gap-2 rounded-[10px] border border-white/60 bg-white/40 px-2.5 py-1.5 fm-help text-[#5b74a3] modal-tiny:py-1">
        <CalendarDays className="size-3.5 flex-none text-brand-blue" strokeWidth={2.2} />
        {period ? (
          <>
            <span className="min-w-0 truncate">
              <Trans t={t} i18nKey="share.priceFor" values={{ kind: kindLabel, period: t(`period.${period.key}`) }} components={{ b: <b className="font-semibold text-brand-navy" /> }} />
            </span>
            <b className="ml-auto flex-none font-semibold tabular-nums text-brand-navy">{noPrice ? t("share.notSet") : `${fmt(price)} · 100%`}</b>
          </>
        ) : (
          <span>{t("share.pickPeriod")}</span>
        )}
      </div>

      <div className="relative flex flex-none flex-wrap items-center gap-x-3 gap-y-1 overflow-hidden rounded-xl border border-l-0 border-white/70 bg-[linear-gradient(100deg,rgba(255,255,255,0.62)_0%,rgba(214,232,255,0.55)_100%)] py-[13px] pr-4 pb-[17px] pl-[19px] modal-compact:py-2.5 modal-compact:pb-3.5 modal-snug:py-2 modal-snug:pb-3">
        <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-blue" />
        <b className="fm-section text-brand-navy">{t("share.profit")}</b>
        <span className="flex min-w-0 items-center gap-1 fm-label text-brand-navy">
          {PROFIT_ACCOUNT}
          <Lock className="size-3.5 flex-none text-dash-faint" strokeWidth={2.4} />
        </span>
        <div className="ml-auto flex flex-none flex-col items-end leading-[1.15]">
          <span className="fm-help font-semibold! tracking-[0.3px] text-[#6b7fa5] modal-snug:hidden">{t("share.totalAmount")}</span>
          <div className="flex items-baseline gap-2.5">
            <b
              className={cn(
                "fm-amount tabular-nums",
                summary.over ? "text-[#dc2626]" : "text-brand-blue",
              )}
            >
              {fmt(summary.profit.amount)}
            </b>
            <em
              className={cn(
                "rounded-full px-2.5 py-px fm-btn not-italic tabular-nums",
                summary.over ? "bg-[#fee2e2] text-[#dc2626]" : "bg-[#e3edff] text-brand-blue",
              )}
            >
              {pct2(summary.profit.pct)}
            </em>
          </div>
        </div>
        <ShareBar summary={summary} />
      </div>

      <div
        role="tablist"
        aria-label={t("share.departments")}
        style={{
          "--c": department.color,
          "--i": activeIndex,
          "--nb": "color-mix(in srgb, var(--c) 14%, #fbfdff)",
          "--bd": "color-mix(in srgb, var(--c) 45%, #fff)",
        }}
        className="relative grid flex-none grid-cols-3 gap-(--g) @max-[479px]/main:grid-cols-1 [--g:10px] modal-compact:[--g:8px] modal-roomy:[--g:12px]"
      >
        {DEPARTMENTS.map((d) => (
          <DepartmentTab key={d.key} department={d} total={summary.departments[d.key]} on={d.key === active} onPick={() => setActive(d.key)} />
        ))}
        {/* The little notch under the picked tab points at the panel below; it slides to the next tab. */}
        <i
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[7px] @max-[479px]/main:hidden left-[calc((100%-2*var(--g))/3*(var(--i)+0.5)+var(--i)*var(--g)-6px)] z-10 size-3 rotate-45 rounded-br-[3px] border-r border-b border-(--bd) bg-(--nb) transition-[left] duration-200 ease-out motion-reduce:transition-none modal-compact:-bottom-[6px] modal-compact:size-2.5 modal-compact:left-[calc((100%-2*var(--g))/3*(var(--i)+0.5)+var(--i)*var(--g)-5px)]"
        />
      </div>

      <div
        style={{ "--c": department.color }}
        className="relative mt-0.5 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-[14px] border border-l-0 border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.62)_0%,rgba(232,242,255,0.42)_100%)] py-2.5 pr-3 pl-[15px] modal-compact:gap-1.5 modal-compact:py-2 modal-compact:pr-2.5 modal-tiny:py-1.5"
      >
        <span className="absolute inset-y-0 left-0 w-[3px] bg-(--c)" />
        <div className="flex flex-none items-center gap-2">
          <b className="fm-label text-brand-navy">{t(`department.${department.key}`)}</b>
          <span className="min-w-0 truncate fm-help text-[#6b7fa5] @max-[599px]/main:hidden">{t("share.commission")}</span>
          <button
            type="button"
            disabled={noPrice || !rows.length || spent.pct <= 0}
            onClick={() => onChange(active, splitEqually(rows))}
            className="ml-auto flex-none cursor-pointer border-none bg-transparent p-0 fm-btn-sm text-brand-blue hover:underline disabled:cursor-not-allowed disabled:text-dash-faint disabled:no-underline"
          >
            {t("share.splitEqually")}
          </button>
        </div>

        {rows.length > 0 && (
          <div className="grid flex-none grid-cols-[minmax(0,1fr)_minmax(72px,0.75fr)_minmax(64px,0.55fr)_22px] gap-2 px-1.5 @max-[479px]/main:hidden fm-help font-semibold! tracking-[0.3px] text-[#6b7fa5]">
            <span>{t("share.account")}</span>
            <span className="text-right">{t("share.amount")}</span>
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
              options={accounts.filter((a) => a === row.account || !rows.some((r) => r.account === a)).map((a) => ({ value: a, label: a }))}
              onChange={(next) => patchRow(row.id, next)}
              onRemove={() => removeRow(row.id)}
            />
          ))}
          {!rows.length && <p className="m-0 flex-none py-1 fm-empty text-[#8a96a8]">{t("share.noAccounts")}</p>}
          <button
            type="button"
            onClick={addRow}
            disabled={!unusedAccounts(rows).length}
            className="flex h-9 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#9dbcf5] bg-white/40 fm-btn text-brand-blue transition-colors hover:bg-white/75 disabled:cursor-not-allowed disabled:opacity-50 modal-compact:h-8 modal-tiny:h-7"
          >
            <Plus className="size-3.5" strokeWidth={2.6} />
            {t("share.addAccount")}
          </button>
        </div>

        <div className="flex flex-none items-center justify-between border-t border-[rgba(130,155,195,0.25)] pt-1.5 fm-help text-[#41588a]">
          <span>{t("share.departmentTotal", { department: t(`department.${department.key}`) })}</span>
          <b className="font-semibold tabular-nums text-brand-navy">
            {fmt(spent.amount)} · {pct2(spent.pct)}
          </b>
        </div>
      </div>
    </div>
  );
}

// Who takes how much of the price, as a thin bar along the bottom of the Profit card: one segment per
// department (its colour) and what is left for Profit (blue).
function ShareBar({ summary }) {
  const width = (pct) => `${Math.min(100, Math.max(0, pct))}%`;
  return (
    <span aria-hidden="true" className="absolute right-4 bottom-1.5 left-[19px] flex h-[5px] overflow-hidden rounded-full bg-[rgba(140,165,205,0.3)]">
      {DEPARTMENTS.map((d) => (
        <i key={d.key} className="block h-full transition-[width] duration-200 motion-reduce:transition-none" style={{ width: width(summary.departments[d.key].pct), background: d.color }} />
      ))}
      <i className="block h-full transition-[width] duration-200 motion-reduce:transition-none" style={{ width: width(summary.profit.pct), background: PROFIT_COLOR }} />
    </span>
  );
}

// One department tab: a small card with its line at the left, its name and account count, its amount and share,
// and a thin bar of its share. The picked one gets its colour in the background and a stronger line.
function DepartmentTab({ department, total, on, onPick }) {
  const { t } = useTranslation("domain");
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onPick}
      style={{ "--c": department.color }}
      className={cn(
        "relative flex min-w-0 cursor-pointer flex-wrap items-center gap-x-1.5 gap-y-0 overflow-hidden rounded-xl border border-l-0 py-[9px] pr-3 pb-3 pl-[18px] text-left text-brand-navy transition-colors",
        "modal-compact:py-[5px] modal-compact:pr-2 modal-compact:pb-2 modal-compact:pl-3.5",
        "modal-roomy:rounded-[13px] modal-roomy:pt-3 modal-roomy:pr-3.5 modal-roomy:pb-[15px] modal-roomy:pl-[21px]",
        "modal-tall:pt-3.5 modal-tall:pb-[17px] modal-tall:pl-[23px]",
        on
          ? "border-[color-mix(in_srgb,var(--c)_45%,#fff)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--c)_16%,#fff)_0%,rgba(255,255,255,0.9)_100%)] shadow-[0_8px_16px_-10px_var(--c)]"
          : "border-white/70 bg-white/35 hover:bg-white/60",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-[3px] bg-(--c) transition-opacity", on ? "opacity-100" : "opacity-50")} />
      <span className="flex min-w-0 items-baseline gap-[5px] fm-label whitespace-nowrap">
        {t(`department.${department.key}`)}
        <small className="fm-help font-semibold! text-[#6b7fa5] modal-snug:hidden">{total.count ? t("share.accShort", { count: total.count }) : t("share.notSet")}</small>
      </span>
      <span className={cn("ml-auto flex items-baseline gap-1.5 whitespace-nowrap tabular-nums", total.count ? "text-brand-navy" : "text-[#8a96a8]")}>
        <b className="fm-section">{fmt(total.amount)}</b>
        <em className={cn("fm-count not-italic", total.count && "text-(--c)")}>{pct2(total.pct)}</em>
      </span>
      <span className="absolute right-3 bottom-1 left-[18px] h-[3px] overflow-hidden rounded-full bg-[rgba(140,165,205,0.3)] modal-compact:bottom-[3px] modal-compact:left-3.5 modal-roomy:right-3.5 modal-roomy:bottom-[5px] modal-roomy:left-[21px]">
        <i className="block h-full bg-(--c)" style={{ width: `${Math.min(100, Math.max(0, total.pct))}%` }} />
      </span>
    </button>
  );
}

/**
 * One account: dropdown, amount and percentage. Typing in one box works out the other from the price; the box
 * being typed in keeps exactly what was typed until it loses focus.
 */
function AccountRow({ row, price, noPrice, options, onChange, onRemove }) {
  const { t } = useTranslation("domain");
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
    <div className="grid flex-none grid-cols-[minmax(0,1fr)_minmax(72px,0.75fr)_minmax(64px,0.55fr)_22px] items-center gap-2 @max-[479px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_22px] rounded-[11px] border border-white/70 bg-white/50 px-1.5 py-1 hover:bg-white/70 modal-compact:py-0.5">
      <div className="min-w-0 @max-[479px]/main:col-span-2 @max-[479px]/main:row-start-1">
        <SelectField value={row.account} onChange={(account) => onChange({ ...row, account })} options={options} placeholder={t("share.selectAccount")} />
      </div>
      <TextInput
        value={shown("amount")}
        onChange={(e) => type("amount", e.target.value)}
        onBlur={() => setEdit(null)}
        inputMode="decimal"
        disabled={noPrice}
        aria-label={t("share.amountLabel", { account: row.account || t("share.accountFallback") })}
        className="px-2.5 text-right tabular-nums disabled:cursor-not-allowed disabled:opacity-60 @max-[479px]/main:row-start-2"
      />
      <div className="relative @max-[479px]/main:row-start-2">
        <TextInput
          value={shown("pct")}
          onChange={(e) => type("pct", e.target.value)}
          onBlur={() => setEdit(null)}
          inputMode="decimal"
          aria-label={t("share.percentageLabel", { account: row.account || t("share.accountFallback") })}
          className="pr-6 pl-2 text-right tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 fm-help text-dash-faint">%</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("share.removeAccount", { account: row.account || t("share.accountFallbackLower") })}
        className="grid size-[22px] flex-none cursor-pointer place-items-center @max-[479px]/main:col-start-3 @max-[479px]/main:row-start-1 rounded-md border-none bg-transparent p-0 text-[#8a98b0] hover:bg-[#ffe4e8] hover:text-[#d4566a]"
      >
        <X className="size-3.5" strokeWidth={2.6} />
      </button>
    </div>
  );
}
