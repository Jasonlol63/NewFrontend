import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Inbox, MessageSquare, Plus, RotateCcw, Search, SquarePen } from "lucide-react";
import { Popover } from "radix-ui";
import DataTable, { ROW_HEIGHT, SelectBox } from "@/components/shared/list/DataTable.jsx";
import FilterChip from "@/components/shared/list/FilterChip.jsx";
import { DeleteButton, PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { Badge, IconAction } from "@/components/shared/list/cells.jsx";
import { useListView } from "@/components/shared/list/useListView";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import DateRangePicker from "@/components/shared/DateRangePicker.jsx";
import FilterRow from "@/components/shared/FilterRow.jsx";
import SegmentGroup from "@/components/shared/SegmentGroup.jsx";
import { useOrderedCurrencies } from "@/hooks/useOrderedCurrencies";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import AccountingDueModal from "./AccountingDueModal.jsx";
import BankProcessFormModal from "./BankProcessFormModal.jsx";
import BankRemarkDialog from "./BankRemarkDialog.jsx";
import { dueNowCount } from "./accountingDueRules";
import { contractLabel } from "./bankFormRules";
import {
  BANK_PICKABLE_STATUSES,
  BANK_STATUS_BADGE,
  LOCKED_EDIT_TITLE,
  filterBankProcesses,
  formatMoney,
  isBankLocked,
  isContractExpired,
  sortBankProcesses,
} from "./bankProcessRules";
import { useBankCountries, useBankProcesses } from "./useBankProcesses";

const ALL_CURRENCIES = [{ value: "ALL", label: "All" }];

const CHIPS = [
  ["showAll", "Show All"],
  ["showActive", "Active"],
  ["showInactive", "Inactive"],
  ["showOfficial", "Official"],
  ["showEInvoice", "E-Invoice"],
  ["showBlocked", "Blocked"],
];

// Next to Add Process; the count is how many processes are due for accounting.
function AccountingDueButton({ count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex flex-none cursor-pointer items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3.5 py-2 text-[13px] font-bold whitespace-nowrap text-brand-navy shadow-dash-card transition-colors hover:bg-slate-50"
    >
      <Inbox className="size-4" strokeWidth={2.2} />
      Accounting Due
      <span className="min-w-[18px] rounded-full bg-[#ef4444] px-1.5 text-center text-[11px] leading-[18px] font-bold text-white">{count}</span>
    </button>
  );
}

// The toolbar row, from the width of its card. Each step only happens when the row would not fit otherwise, so
// nothing wraps, scrolls or squeezes the search box until it has to:
//   Delete loses its label -> the search box becomes an icon -> the chips go slim -> (below ~1000px screens) the
//   chips drop to a second row at full size.
// The date box is 330px (its original popup) when everything fits with room to spare, else the 256px box.
const CHIPS_WIDTH = 593; // the six chips side by side
const SLIM_CHIPS_WIDTH = 515; // the same chips, compact
function toolbarLayout(width) {
  const wideDate = width >= 330 + CHIPS_WIDTH + 180 + 120 + 30;
  const date = wideDate ? 330 : 256;
  const fits = (chips, search, del, gaps = 30) => width >= date + chips + search + del + gaps;
  const base = { wideDate, slim: false, wrap: false };
  if (fits(CHIPS_WIDTH, 120, 120)) return { ...base, search: "box", deleteLabel: true };
  if (fits(CHIPS_WIDTH, 120, 44)) return { ...base, search: "box", deleteLabel: false };
  if (fits(CHIPS_WIDTH, 36, 44)) return { ...base, search: "icon", deleteLabel: false };
  if (fits(SLIM_CHIPS_WIDTH, 36, 36, 24)) return { ...base, slim: true, search: "icon", deleteLabel: false };
  return { ...base, search: "box", deleteLabel: false, wrap: true };
}

function useContentWidth(ref, padding) {
  const [width, setWidth] = useState(1400);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth - padding);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, padding]);
  return width;
}

const searchShell =
  "flex h-9 items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3 text-[13px] shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-[#3b82f6]";

function SearchBox({ value, onChange }) {
  return (
    <label className={cn(searchShell, "order-2 min-w-[120px] max-w-[180px] flex-[1_1_120px]")}>
      <Search className="size-4 flex-none text-dash-faint" strokeWidth={2.2} />
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 bg-transparent outline-none placeholder:text-dash-faint" placeholder="Search" />
    </label>
  );
}

// When the row is short of room: just the magnifier; a click opens a short search box over the chips.
function SearchIcon({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const input = useRef(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  return (
    <div className="relative order-2 flex-none">
      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-dash-line bg-white text-dash-faint shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-colors hover:text-[#2563eb]"
      >
        <Search className="size-4" strokeWidth={2.2} />
        {value && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#2563eb]" />}
      </button>
      {open && (
        <label className={cn(searchShell, "absolute top-0 left-0 z-20 w-[170px] border-[#3b82f6] shadow-[0_8px_20px_-6px_rgba(20,70,160,0.35)]")}>
          <Search className="size-4 flex-none text-dash-faint" strokeWidth={2.2} />
          <input
            ref={input}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => (e.key === "Escape" || e.key === "Enter") && setOpen(false)}
            className="w-full min-w-0 bg-transparent outline-none placeholder:text-dash-faint"
            placeholder="Search"
          />
        </label>
      )}
    </div>
  );
}

// Two lines of text per cell need a taller row than the single-line list.
const TWO_LINE_ROW_HEIGHT = 52;

// The badges drop their letter spacing: the picker chevron and the contract dot add width, so the text gives some back.
const TIGHT = { letterSpacing: 0 };
// Every status badge is the same width, and so is each option in the picker (the popup is that plus its padding and border),
// so badge and popup line up. The width is the narrowest that fits E-INVOICE on small screens and grows on big ones, where
// the table has room to spare: 74px, 84px from 1366px, 96px from 1536px. No arrow: the pointer and a hover shade say it is clickable.
const STATUS_WIDTH = "w-[74px] min-[1366px]:w-[84px] min-[1536px]:w-[96px] justify-center";
const STATUS_POPUP_WIDTH = "w-[88px] min-[1366px]:w-[98px] min-[1536px]:w-[110px]";

// The status badge is also the control: a click opens a small popup with the statuses to choose from. The popup is
// portalled, so the table never clips or covers it.
function StatusPicker({ status, readOnly, onChange }) {
  const [open, setOpen] = useState(false);
  const current = BANK_STATUS_BADGE[status];
  if (readOnly) return <Badge className={cn("px-1.5", STATUS_WIDTH, current.className)} style={TIGHT}>{current.label}</Badge>;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`Status: ${current.label}. Change status`} className="cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40">
          <Badge className={cn("px-1.5 transition-[filter] hover:brightness-95", STATUS_WIDTH, current.className)} style={TIGHT}>
            {current.label}
          </Badge>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="center"
          sideOffset={6}
          collisionPadding={8}
          className={cn("z-50 flex flex-col gap-0.5 rounded-xl border border-dash-line bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)]", STATUS_POPUP_WIDTH)}
        >
          {BANK_PICKABLE_STATUSES.map((s) => {
            const option = BANK_STATUS_BADGE[s];
            const picked = s === status;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer justify-center rounded-lg py-0.5 outline-none hover:bg-[#f1f6fd] focus-visible:bg-[#f1f6fd]"
              >
                <Badge className={cn("w-full justify-center px-1.5", picked ? option.className : cn("border-transparent bg-transparent", option.text))}>{option.label}</Badge>
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// A white outlined badge with a dot: green while the contract runs, grey (and greyed text) once it has expired.
function ContractBadge({ row }) {
  const expired = isContractExpired(row);
  return (
    <Badge className={cn("items-center gap-1 bg-white px-1.5", expired ? "border-[#e2e8f0] text-[#94a3b8]" : "border-[#bcd9fb] text-brand-navy")} style={TIGHT}>
      <span className={cn("size-1.5 flex-none rounded-full", expired ? "bg-[#9ca3af]" : "bg-[#22c55e]")} />
      {contractLabel(row.contract)}
    </Badge>
  );
}

const thisYear = () => {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
};

// Bank Process list (shown for Bank companies). Same card look as the Games list; the table folds its least
// important columns into two-line cells instead of scrolling sideways (see DataTable `altColumns`).
export default function BankProcessView({ scope, readOnly }) {
  const { rows: allRows, error: listError, loading, changeStatus, saveRemark, deleteRows, reload } = useBankProcesses(scope.tenantId);
  const [statusPending, setStatusPending] = useState(() => new Set()); // process ids whose status is being changed
  const [actionError, setActionError] = useState("");
  const [remarkRow, setRemarkRow] = useState(null);
  const closeRemark = useCallback(() => setRemarkRow(null), []);
  const [addOpen, setAddOpen] = useState(false);
  const closeAdd = useCallback(() => setAddOpen(false), []);
  const [editRow, setEditRow] = useState(null);
  const closeEdit = useCallback(() => setEditRow(null), []);
  const [dueOpen, setDueOpen] = useState(false);
  const closeDue = useCallback(() => setDueOpen(false), []);
  const [dateRange, setDateRange] = useState(thisYear);
  const [currency, setCurrency] = useState("ALL");
  const [currencyOptions, setCurrencyOrder] = useOrderedCurrencies(useBankCountries(scope.tenantId));
  // True while the table shows its two-line cells (taller rows).
  const [twoLine, setTwoLine] = useState(false);
  const toolbarRef = useRef(null);
  const layout = toolbarLayout(useContentWidth(toolbarRef, 32));

  // Companies Add Account offers inside the modal: the picked Group's companies, or just the Group when its own view is picked.
  const accountCompanyOptions =
    scope.company === null && scope.group ? [{ value: scope.group, label: scope.group, tenantId: scope.tenantId }] : scope.companyOptions;

  // Posts what the modal built ({ url, body }); on success the modal closes and the list is fetched again. A failure goes
  // back to the modal, which shows the message.
  const submitBank = useCallback(
    async ({ url, body }) => {
      await postJson(url, body);
      closeAdd();
      closeEdit();
      reload();
    },
    [closeAdd, closeEdit, reload]
  );

  const scoped = useMemo(
    () => allRows.filter((p) => (currency === "ALL" || p.currency === currency) && p.date >= dateRange.from && p.date <= dateRange.to),
    [allRows, currency, dateRange]
  );
  const canSelect = useCallback((p) => !readOnly && p.status === "INACTIVE", [readOnly]);
  const view = useListView(scoped, { filter: filterBankProcesses, sort: sortBankProcesses, canSelect, rowMin: twoLine ? TWO_LINE_ROW_HEIGHT : ROW_HEIGHT });
  const actions = useRowActions({
    toggleStatus: async () => {}, // the status badge below picks the status itself
    deleteRows,
    noun: "process",
    label: (p) => `${p.supplier} (${p.bank})`,
    onDeleted: view.clearSelection,
  });

  const money = (key) => (p) => formatMoney(p[key]);
  const contract = (p) => <ContractBadge row={p} />;
  // The backend also opens or closes the process's accounting dues for the new status; a refusal shows in the banner.
  const pickStatus = async (p, next) => {
    if (next === p.status) return;
    setActionError("");
    setStatusPending((s) => new Set(s).add(p.id));
    try {
      await changeStatus(p, next);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setStatusPending((s) => {
        const rest = new Set(s);
        rest.delete(p.id);
        return rest;
      });
    }
  };
  const status = (p) => <StatusPicker status={p.status} readOnly={readOnly || statusPending.has(p.id)} onChange={(next) => pickStatus(p, next)} />;

  // The Action column: edit, remark, then either Renew or (inactive rows, which can be deleted) the delete checkbox.
  const { selected, onSelectedChange } = view.table;
  const pageSelectable = view.table.rows.filter(canSelect);
  const pickedCount = pageSelectable.filter((p) => selected.has(p.id)).length;
  const headChecked = pickedCount === 0 ? false : pickedCount === pageSelectable.length ? true : "mixed";
  const toggleMany = (list, checked) => {
    const next = new Set(selected);
    list.forEach((p) => (checked ? next.add(p.id) : next.delete(p.id)));
    onSelectedChange(next);
  };
  const actionColumn = {
    key: "action",
    label: (
      <span className="inline-flex w-[84px] items-center justify-between">
        Action
        {pageSelectable.length > 0 && (
          <SelectBox onHeader label="Select all inactive rows on this page" checked={headChecked} onChange={(checked) => toggleMany(pageSelectable, checked)} />
        )}
      </span>
    ),
    sortable: false,
    className: "text-center",
    cellClassName: "whitespace-nowrap",
    render: (p) => (
      <span className="inline-flex">
        <IconAction
          icon={SquarePen}
          onClick={() => setEditRow(p)}
          disabled={readOnly}
          title={readOnly ? "Read-only login" : isBankLocked(p) ? LOCKED_EDIT_TITLE : "Edit process"}
          aria-label="Edit process"
        />
        <IconAction
          icon={MessageSquare}
          onClick={() => setRemarkRow(p)}
          disabled={readOnly}
          title={readOnly ? "Read-only login" : p.remark ? `Remark: ${p.remark}` : "Remark"}
          aria-label="Remark"
        />
        {p.status === "INACTIVE" ? (
          <SelectBox label="Select row" checked={selected.has(p.id)} disabled={!canSelect(p)} onChange={(checked) => toggleMany([p], checked)} />
        ) : (
          <IconAction icon={RotateCcw} disabled title="Resend (not available yet)" aria-label="Resend" />
        )}
      </span>
    ),
  };
  const noColumn = { key: "no", label: "No", sortable: false, className: "w-[40px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n };

  // One line per row while it fits ...
  const columns = [
    noColumn,
    { key: "supplier", label: "Supplier", cellClassName: "whitespace-nowrap font-semibold", render: (p) => p.supplier },
    { key: "country", label: "Country", render: (p) => p.country },
    { key: "bank", label: "Bank", fit: true, fitMin: 76, render: (p) => p.bank },
    { key: "cardOwner", label: "Card Owner", fit: true, fitMin: 88, render: (p) => p.cardOwner },
    { key: "contract", label: "Contract", render: contract },
    { key: "insurance", label: "Ins.", cellClassName: "tabular-nums", render: (p) => p.insurance ?? "-" },
    { key: "customer", label: "Cust.", render: (p) => p.customer },
    { key: "cost", label: "Cost", cellClassName: "tabular-nums", render: money("cost") },
    { key: "price", label: "Price", cellClassName: "tabular-nums", render: money("price") },
    { key: "profit", label: "Profit", cellClassName: "tabular-nums", render: money("profit") },
    { key: "status", label: "Status", render: status },
    { key: "date", label: "Date", cellClassName: "tabular-nums whitespace-nowrap", render: (p) => p.date },
    actionColumn,
  ];

  // ... then related columns share a cell, one above the other (Cost, Price and Profit stay separate: they are three prices).
  const stacked = (top, bottom) => (
    <>
      <div className="truncate">{top}</div>
      <div className="truncate text-[11.5px] text-[#33507f]">{bottom}</div>
    </>
  );
  const head2 = (first, second) => (
    <span className="flex flex-col leading-tight">
      {first}
      <span className="text-[11px] font-semibold opacity-85">{second}</span>
    </span>
  );
  // No "No" column here: on a narrow card the row number is the least useful thing to spend 40px on.
  const twoLineColumns = [
    { key: "supplier", label: head2("Supplier", "Customer"), render: (p) => stacked(<span className="font-semibold">{p.supplier}</span>, p.customer) },
    { key: "bank", label: head2("Bank", "Card Owner"), fit: true, fitMin: 76, render: (p) => stacked(p.bank, p.cardOwner) },
    { key: "country", label: head2("Country", "Contract"), render: (p) => stacked(p.country, contract(p)) },
    { key: "insurance", label: "Ins.", cellClassName: "tabular-nums", render: (p) => p.insurance ?? "-" },
    { key: "cost", label: "Cost", cellClassName: "tabular-nums", render: money("cost") },
    { key: "price", label: "Price", cellClassName: "tabular-nums", render: money("price") },
    { key: "profit", label: "Profit", cellClassName: "tabular-nums", render: money("profit") },
    { key: "status", label: head2("Status", "Date"), render: (p) => stacked(status(p), p.date) },
    actionColumn,
  ];

  const pageError = scope.error || listError || actionError;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <div className="flex flex-none flex-wrap items-center gap-2.5">
        <PrimaryButton icon={Plus} onClick={() => setAddOpen(true)} disabled={readOnly} title={readOnly ? "Read-only login" : undefined}>
          Add Process
        </PrimaryButton>
        <AccountingDueButton count={dueNowCount()} onClick={() => setDueOpen(true)} />
      </div>

      <section ref={toolbarRef} className={cn("flex-none rounded-xl border border-dash-line bg-white shadow-dash-filter transition-opacity", scope.loading && "opacity-60")}>
        <div className={cn("flex items-center px-4 pt-2.5 pb-2.5 short:pt-2", layout.wrap ? "flex-wrap" : "flex-nowrap", layout.slim ? "gap-2" : "gap-2.5")}>
          <div className="order-1 flex-none">
            <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange} compact={!layout.wideDate} />
          </div>
          {layout.search === "icon" ? (
            <SearchIcon value={view.search} onChange={view.setSearch} />
          ) : (
            <SearchBox value={view.search} onChange={view.setSearch} />
          )}
          <div className={cn("flex items-center", layout.slim ? "gap-1.5" : "gap-2", layout.wrap ? "order-4 basis-full flex-wrap" : "order-3 flex-none")}>
            {CHIPS.map(([key, label]) => (
              <FilterChip key={key} label={label} compact={layout.slim} checked={Boolean(view.chips[key])} onChange={(v) => view.setChip(key, v)} />
            ))}
          </div>
          <div className={cn("ml-auto flex-none", layout.wrap ? "order-3" : "order-4")}>
            <DeleteButton count={view.selectedRows.length} iconOnly={!layout.deleteLabel} onClick={() => actions.requestDelete(view.selectedRows)} />
          </div>
        </div>

        <div className="flex flex-col gap-2 px-4 pb-2.5 short:gap-1.5 short:pb-2">
          {scope.showGroups && (
            <FilterRow label="Group ID:">
              <SegmentGroup options={scope.groupOptions} value={scope.group} onChange={scope.onGroupChange} allowDeselect={scope.allowNoGroup} />
            </FilterRow>
          )}
          {scope.companyOptions.length > 0 && (
            <FilterRow label="Company:">
              <SegmentGroup options={scope.companyOptions} value={scope.company} onChange={scope.onCompanyChange} allowDeselect={scope.allowNoCompany} />
            </FilterRow>
          )}
          <FilterRow label="Currency:">
            <SegmentGroup leading={ALL_CURRENCIES} options={currencyOptions} value={currency} onChange={setCurrency} wrap onReorder={setCurrencyOrder} />
          </FilterRow>
        </div>
      </section>

      {pageError && (
        <div className="flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-dash-down">{pageError}</div>
      )}

      <DataTable columns={columns} altColumns={twoLineColumns} onAltChange={setTwoLine} selectColumn={false} noun="processes" loading={loading} boxedPager fitWidth dense minWidth="min-w-0" {...view.table} />
      {actions.dialogs}
      <BankRemarkDialog row={remarkRow} onClose={closeRemark} onSave={saveRemark} />

      {addOpen && (
        <BankProcessFormModal tenantId={scope.tenantId} accountCompanyOptions={accountCompanyOptions} onClose={closeAdd} onSave={submitBank} />
      )}
      {editRow && (
        <BankProcessFormModal
          mode="edit"
          process={editRow}
          tenantId={scope.tenantId}
          accountCompanyOptions={accountCompanyOptions}
          onClose={closeEdit}
          onSave={submitBank}
          onBalanceDeleted={reload}
        />
      )}
      {dueOpen && <AccountingDueModal readOnly={readOnly} onClose={closeDue} />}
    </div>
  );
}
