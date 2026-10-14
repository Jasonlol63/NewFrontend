import { roundMoney } from "@/lib/money";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { currentMonthRange } from "@/lib/date";
import DataTable from "@/components/shared/list/DataTable.jsx";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import { Badge, IconAction } from "@/components/shared/list/cells.jsx";
import { useListView } from "@/components/shared/list/useListView";
import { useSession } from "@/context/session";
import { REALTIME_DOMAINS, useRealtime } from "@/lib/realtime/realtimeEvents";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotice } from "@/hooks/useNotice";
import Toast from "@/components/shared/Toast.jsx";
import AutoRenewFilterCard from "./AutoRenewFilterCard.jsx";
import { approveRequest, fetchAutoRenew, rejectRequest, saveShare, undoRequest } from "./autoRenewApi";
import ChargeDialog from "./ChargeDialog.jsx";
import ChargeSwitch from "./ChargeSwitch.jsx";
import PeriodSelect from "./PeriodSelect.jsx";
import {
  REMAINING_BADGE,
  STATUS_BADGE,
  displayDate,
  filterAutoRenewRows,
  periodCodeOf,
  remainingDays,
  rowPrice,
  remainingLabel,
  remainingTier,
  sortAutoRenewRows,
  statusCounts,
} from "./autoRenewRules";

// Nothing in this list is bulk-selectable (no delete), so the select column never shows.
const canSelect = () => false;

const actionButton =
  "rounded-lg px-0 py-1 text-center font-semibold! text-white transition-[filter] enabled:cursor-pointer enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none";

function Dot({ className }) {
  return <i className={cn("size-[7px] flex-none rounded-full", className)} />;
}

const EMPTY_COUNTS = { all: 0, pending: 0, approved: 0, rejected: 0 };

/**
 * Auto Renew: companies / groups close to expiry, waiting for a renew period to be chosen and approved.
 * The list comes from POST /api/auto-renew/list (one tab at a time). Period and Charge of a pending row are only kept
 * in this page until Approve; the price is always the list price of the period.
 * Approve / Reject / Undo call the API and read the list again. The Share is the one saved for the company / group (shared with the Domain page).
 */
export default function AutoRenewPage() {
  const { t } = useTranslation(["autorenew", "common"]);
  const user = useCurrentUser();
  const { user: session } = useSession();
  const ledgerTenantId = session?.tenant_id;
  const readOnly = Boolean(user?.readOnly);
  const [rows, setRows] = useState([]);
  const [serverCounts, setServerCounts] = useState(EMPTY_COUNTS);
  const [serverTabCounts, setServerTabCounts] = useState({ company: 0, group: 0 });
  const [loadedKey, setLoadedKey] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const { toasts, push, dismiss } = useNotice(5000);
  const [confirm, setConfirm] = useState(null); // { row, action: "reject" | "undo" }
  const [ledger, setLedger] = useState({ accounts: [], shareAccounts: [] });
  const [tab, setTab] = useState("company");
  const [status, setStatus] = useState("pending");
  // Limits the approved / rejected rows by the day they were processed; pending ones are always listed.
  const [range, setRange] = useState(() => currentMonthRange());

  const loadKey = `${tab}|${range.from}|${range.to}|${reloadKey}|${ledgerTenantId}`;
  const loading = loadedKey !== loadKey;

  // Read the tab again when the tab or the date range changes (the range only limits the approved / rejected rows).
  useEffect(() => {
    if (!ledgerTenantId) return undefined;
    const controller = new AbortController();
    fetchAutoRenew(tab, range, ledgerTenantId, { signal: controller.signal })
      .then((data) => {
        // A reload keeps what was picked (Period, Charge) on the rows that are still pending.
        setRows((old) =>
          data.rows.map((r) => {
            const prev = r.status === "pending" ? old.find((o) => o.id === r.id) : null;
            return prev ? { ...r, periodKey: prev.periodKey, charge: prev.charge } : r;
          })
        );
        setLedger({ accounts: data.accounts, shareAccounts: data.shareAccounts });
        setServerCounts(data.counts);
        setServerTabCounts(data.tabCounts);
        setLoadedKey(loadKey);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        push(t("toast.loadFailed"), "error", e.message, { label: t("common:retry"), onClick: () => setReloadKey((k) => k + 1) });
        setLoadedKey(loadKey);
      });
    return () => controller.abort();
  }, [loadKey, tab, range, ledgerTenantId, push, t]);

  const tabRows = useMemo(() => rows.filter((r) => r.kind === tab), [rows, tab]);
  // Status counts of the rows loaded, but a local Approve / Reject moves a row between them, so count what is on screen.
  const counts = useMemo(() => (tabRows.length ? statusCounts(tabRows) : serverCounts), [tabRows, serverCounts]);
  const tabCounts = useMemo(
    () => ({ ...serverTabCounts, [tab]: tabRows.filter((r) => r.status === "pending").length }),
    [serverTabCounts, tab, tabRows]
  );
  const listed = useMemo(() => (status === "all" ? tabRows : tabRows.filter((r) => r.status === status)), [tabRows, status]);
  const view = useListView(listed, { filter: filterAutoRenewRows, sort: sortAutoRenewRows, canSelect });

  const patch = (id, changes) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  // Approve / Reject / Undo one row: shows the back end's message when it refuses, and reads the list again on success.
  const decide = async (row, action) => {
    if (busyId != null) return;
    setBusyId(row.id);
    try {
      if (action === "approve") await approveRequest(row.id, periodCodeOf(row.periodKey), row.charge);
      else if (action === "reject") await rejectRequest(row.id);
      else await undoRequest(row.id);
      setReloadKey((k) => k + 1);
      push(t(action === "approve" ? "toast.approved" : action === "reject" ? "toast.rejected" : "toast.undone"), "success", row.company);
    } catch (e) {
      push(t("toast.updateFailed"), "error", e.message);
    } finally {
      setBusyId(null);
    }
  };
  const [chargeId, setChargeId] = useState(null);
  const chargeRow = rows.find((r) => r.id === chargeId);

  // Someone else decided a request: read the list again. While the Charge dialog is open the list waits, so an unsaved Share is not
  // replaced under the user; it is read when the dialog closes.
  const staleWhileOpen = useRef(false);
  useRealtime([REALTIME_DOMAINS.AUTO_RENEW], () => {
    if (chargeId != null) staleWhileOpen.current = true;
    else setReloadKey((k) => k + 1);
  });
  const closeCharge = () => {
    setChargeId(null);
    if (staleWhileOpen.current) {
      staleWhileOpen.current = false;
      setReloadKey((k) => k + 1);
    }
  };

  const columns = [
    { key: "no", label: t("cols.no"), sortable: false, className: "w-[36px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
    { key: "company", label: tab === "group" ? t("cols.group") : t("cols.company"), cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.company },
    { key: "name", label: t("cols.name"), cellClassName: "whitespace-nowrap text-[#374151]", render: (r) => r.name },
    { key: "expiry", label: t("cols.expiry"), cellClassName: "whitespace-nowrap tabular-nums", render: (r) => displayDate(r.expiry) },
    {
      key: "remaining",
      label: t("cols.remaining"),
      render: (r, n) => {
        const days = remainingDays(r.expiry);
        const tone = r.status === "pending" ? REMAINING_BADGE[remainingTier(days)] : REMAINING_BADGE.settled;
        return (
          // The pulse of neighbouring rows is staggered so they never flash together.
          <Badge className={cn("items-center gap-1.5", tone.badge)} style={{ animationDelay: `${(n * 0.7) % 4}s` }}>
            <Dot className={tone.dot} />
            {remainingLabel(days, t)}
          </Badge>
        );
      },
    },
    {
      key: "period",
      label: t("cols.period"),
      sortable: false,
      cellClassName: "whitespace-nowrap",
      render: (r) =>
        r.status === "pending" ? (
          <PeriodSelect row={r} value={r.periodKey} onChange={(key) => patch(r.id, { periodKey: key })} disabled={readOnly} />
        ) : (
          <span className="text-[#374151]">{r.periodKey ? t(`periods.${r.periodKey}`) : "-"}</span>
        ),
    },
    {
      key: "price",
      label: t("cols.price"),
      cellClassName: "whitespace-nowrap tabular-nums",
      // Fixed minimum width: a price like 900.00 -> 1800.00 would otherwise widen the column and make
      // every other column (and the whole table) shift while a Period is being picked.
      render: (r) => (
        <span className={cn("inline-block min-w-[54px]", !r.periodKey && "text-slate-300")}>
          {r.periodKey ? roundMoney(rowPrice(r)) : "—"}
        </span>
      ),
    },
    {
      key: "charge",
      label: t("cols.charge"),
      sortable: false,
      render: (r) => <ChargeSwitch on={r.charge} disabled={readOnly} onToggle={() => patch(r.id, { charge: !r.charge })} />,
    },
    {
      key: "status",
      label: t("cols.status"),
      sortable: false,
      render: (r) => {
        const s = STATUS_BADGE[r.status];
        return (
          <Badge className={cn("items-center gap-1.5", s.badge)}>
            <Dot className={s.dot} />
            {t(`status.${r.status}`)}
          </Badge>
        );
      },
    },
    {
      key: "action",
      label: t("cols.action"),
      sortable: false,
      className: "text-center",
      cellClassName: "whitespace-nowrap",
      render: (r) => (
        // Three fixed slots (Approve / Reject / Comm) so the buttons line up in every row, whether or not
        // the row has a Comm icon or is already settled.
        <div className="mx-auto grid w-fit grid-cols-[4.6em_4em_2.1em] items-center gap-[0.35em] type-body">
          {r.status === "pending" ? (
            <>
              <button
                type="button"
                disabled={readOnly || busyId != null || !r.periodKey || !r.canApprove || !(rowPrice(r) > 0)}
                title={readOnly ? t("readOnly") : !r.periodKey ? t("actions.selectPeriodFirst") : !r.canApprove ? t("actions.noAccount") : !(rowPrice(r) > 0) ? t("actions.noPrice") : undefined}
                onClick={() => decide(r, "approve")}
                className={cn(actionButton, "bg-brand-sweep shadow-[0_6px_14px_-6px_rgba(13,96,255,0.6)]")}
              >
                {t("actions.approve")}
              </button>
              <button
                type="button"
                disabled={readOnly || busyId != null}
                title={readOnly ? t("readOnly") : undefined}
                onClick={() => setConfirm({ row: r, action: "reject" })}
                className={cn(actionButton, "bg-[linear-gradient(180deg,#94a3b8_0%,#64748b_100%)] shadow-[0_6px_14px_-6px_rgba(71,85,105,0.6)]")}
              >
                {t("actions.reject")}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={readOnly || busyId != null || !r.canDelete}
              title={readOnly ? t("readOnly") : !r.canDelete ? t("actions.cannotUndo") : t("actions.putBack")}
              onClick={() => setConfirm({ row: r, action: "undo" })}
              className="col-span-2 flex items-center justify-center gap-1 rounded-lg border border-[#b9cdea] bg-white py-1 font-semibold! text-[#41588a] transition-colors enabled:cursor-pointer enabled:hover:bg-[#eef4fd] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Undo2 className="size-[1em]" strokeWidth={2.6} />
              {t("actions.undo")}
            </button>
          )}
          <span className="relative inline-flex">
            <IconAction icon={MessageSquare} title={t("actions.commTitle")} aria-label={t("actions.comm")} onClick={() => setChargeId(r.id)} className="size-[2em]" />
            {Object.values(r.departments).some((list) => list.length > 0) && (
              <i className="pointer-events-none absolute top-0.5 right-0.5 size-[7px] rounded-full bg-[#1f6fe8] ring-2 ring-white" />
            )}
          </span>
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
    <div className="relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
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

      <DataTable columns={columns} noun="records" minWidth="min-w-0" fitWidth loading={loading} emptyMessage={t("empty")} {...view.table} />

      {chargeRow && (
        <ChargeDialog
          row={chargeRow}
          readOnly={readOnly || chargeRow.status !== "pending"}
          accounts={ledger.shareAccounts}
          onPatch={(changes) => patch(chargeRow.id, changes)}
          onSave={(row) => saveShare(row, ledger.accounts)}
          onClose={closeCharge}
          notify={push}
        />
      )}
      <DeleteDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        names={confirm ? [confirm.row.company] : []}
        noun={confirm?.action === "undo" ? "approval" : "request"}
        verb={confirm?.action === "undo" ? "Undo" : "Reject"}
        verbPast={confirm?.action === "undo" ? "put back to Pending" : "rejected"}
        note={
          confirm?.action === "undo" && confirm.row.status === "approved"
            ? t("confirm.rollbackNote")
            : undefined
        }
        irreversible={false}
        onConfirm={() => {
          const { row, action } = confirm;
          setConfirm(null);
          decide(row, action);
        }}
      />
    </div>
  );
}
