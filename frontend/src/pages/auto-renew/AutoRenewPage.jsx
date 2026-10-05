import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { currentMonthRange } from "@/lib/date";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { Badge, IconAction } from "@/components/shared/list/cells.jsx";
import { useListView } from "@/components/shared/list/useListView";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import AutoRenewFilterCard from "./AutoRenewFilterCard.jsx";
import ChargeSwitch from "./ChargeSwitch.jsx";
import PeriodSelect from "./PeriodSelect.jsx";
import {
  REMAINING_BADGE,
  STATUS_BADGE,
  buildMockRows,
  displayDate,
  filterAutoRenewRows,
  periodOf,
  priceOf,
  remainingDays,
  remainingLabel,
  remainingTier,
  sortAutoRenewRows,
  statusCounts,
} from "./autoRenewRules";

const NOT_BUILT = "Not available yet";
const READ_ONLY = "Read-only login";

// Nothing in this list is bulk-selectable (no delete), so the select column never shows.
const canSelect = () => false;

const actionButton =
  "rounded-lg px-0 py-1 text-center text-[12px] font-bold text-white transition-[filter] enabled:cursor-pointer enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none";

function Dot({ className }) {
  return <i className={cn("size-[7px] flex-none rounded-full", className)} />;
}

/**
 * Auto Renew: companies / groups close to expiry, waiting for a renew period to be chosen and approved.
 * Design preview only: the rows are placeholders and every change lives in this page's state (no API yet).
 */
export default function AutoRenewPage() {
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  const [rows, setRows] = useState(buildMockRows);
  const [tab, setTab] = useState("company");
  const [status, setStatus] = useState("pending");
  // Kept for the Date Range picker; it filters nothing until the API says what the range applies to.
  const [range, setRange] = useState(() => currentMonthRange());

  const tabRows = useMemo(() => rows.filter((r) => r.kind === tab), [rows, tab]);
  const counts = useMemo(() => statusCounts(tabRows), [tabRows]);
  const tabCounts = useMemo(
    () => ({
      company: rows.filter((r) => r.kind === "company" && r.status === "pending").length,
      group: rows.filter((r) => r.kind === "group" && r.status === "pending").length,
    }),
    [rows]
  );
  const listed = useMemo(() => (status === "all" ? tabRows : tabRows.filter((r) => r.status === status)), [tabRows, status]);
  const view = useListView(listed, { filter: filterAutoRenewRows, sort: sortAutoRenewRows, canSelect });

  const patch = (id, changes) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)));

  const columns = [
    { key: "no", label: "No", sortable: false, className: "w-[36px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
    { key: "company", label: tab === "group" ? "Group" : "Company", cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.company },
    { key: "name", label: "Name", cellClassName: "whitespace-nowrap text-[#374151]", render: (r) => r.name },
    { key: "expiry", label: "Expiration", cellClassName: "whitespace-nowrap tabular-nums", render: (r) => displayDate(r.expiry) },
    {
      key: "remaining",
      label: "Remaining",
      render: (r, n) => {
        const days = remainingDays(r.expiry);
        const tone = r.status === "pending" ? REMAINING_BADGE[remainingTier(days)] : REMAINING_BADGE.settled;
        return (
          // The pulse of neighbouring rows is staggered so they never flash together.
          <Badge className={cn("items-center gap-1.5", tone.badge)} style={{ animationDelay: `${(n * 0.7) % 4}s` }}>
            <Dot className={tone.dot} />
            {remainingLabel(days)}
          </Badge>
        );
      },
    },
    {
      key: "period",
      label: "Period",
      sortable: false,
      cellClassName: "whitespace-nowrap",
      render: (r) =>
        r.status === "pending" ? (
          <PeriodSelect row={r} value={r.periodKey} onChange={(key) => patch(r.id, { periodKey: key })} disabled={readOnly} />
        ) : (
          <span className="text-[#374151]">{periodOf(r.periodKey)?.label ?? "-"}</span>
        ),
    },
    {
      key: "price",
      label: "Price",
      cellClassName: "whitespace-nowrap tabular-nums",
      // Fixed minimum width: a price like 900.00 -> 1800.00 would otherwise widen the column and make
      // every other column (and the whole table) shift while a Period is being picked.
      render: (r) => (
        <span className={cn("inline-block min-w-[54px]", !r.periodKey && "text-slate-300")}>
          {r.periodKey ? priceOf(r, r.periodKey) : "—"}
        </span>
      ),
    },
    {
      key: "charge",
      label: "Charge",
      sortable: false,
      render: (r) => <ChargeSwitch on={r.charge} disabled={readOnly} onToggle={() => patch(r.id, { charge: !r.charge })} />,
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (r) => {
        const s = STATUS_BADGE[r.status];
        return (
          <Badge className={cn("items-center gap-1.5", s.badge)}>
            <Dot className={s.dot} />
            {s.label}
          </Badge>
        );
      },
    },
    {
      key: "action",
      label: "Action",
      sortable: false,
      className: "text-center",
      cellClassName: "whitespace-nowrap",
      render: (r) => (
        // Three fixed slots (Approve / Reject / Comm) so the buttons line up in every row, whether or not
        // the row has a Comm icon or is already settled.
        <div className="mx-auto grid w-fit grid-cols-[58px_50px_24px] items-center gap-1">
          {r.status === "pending" ? (
            <>
              <button
                type="button"
                disabled={readOnly || !r.periodKey}
                title={readOnly ? READ_ONLY : r.periodKey ? undefined : "Select a period first"}
                onClick={() => patch(r.id, { status: "approved" })}
                className={cn(actionButton, "bg-brand-sweep shadow-[0_6px_14px_-6px_rgba(13,96,255,0.6)]")}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={readOnly}
                title={readOnly ? READ_ONLY : undefined}
                onClick={() => patch(r.id, { status: "rejected" })}
                className={cn(actionButton, "bg-[linear-gradient(180deg,#94a3b8_0%,#64748b_100%)] shadow-[0_6px_14px_-6px_rgba(71,85,105,0.6)]")}
              >
                Reject
              </button>
            </>
          ) : (
            <span className="col-span-2" />
          )}
          {r.comm ? <IconAction icon={MessageSquare} disabled title={NOT_BUILT} aria-label="Comm" className="size-6" /> : <span />}
        </div>
      ),
    },
  ];

  const changeTab = (next) => {
    setTab(next);
    view.reset();
  };
  const changeStatus = (next) => {
    setStatus(next);
    view.reset();
  };

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <AutoRenewFilterCard
        tab={tab}
        onTabChange={changeTab}
        tabCounts={tabCounts}
        range={range}
        onRangeChange={setRange}
        search={view.search}
        onSearchChange={view.setSearch}
        status={status}
        onStatusChange={changeStatus}
        statusCounts={counts}
      />

      <DataTable columns={columns} noun="records" minWidth="min-w-0" fitWidth emptyMessage="Nothing to renew here" {...view.table} />
    </div>
  );
}
