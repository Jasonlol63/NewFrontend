import { useCallback, useEffect, useState } from "react";
import { CircleDollarSign, Plus, Search, Trash2 } from "lucide-react";
import DataTable from "@/components/shared/list/DataTable.jsx";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import StatusDialog from "@/components/shared/StatusDialog.jsx";
import { PrimaryButton, SecondaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { IconAction } from "@/components/shared/list/cells.jsx";
import { useListView } from "@/components/shared/list/useListView";
import { useSession } from "@/context/session";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import CodeChips from "./CodeChips.jsx";
import DomainFormModal from "./DomainFormModal.jsx";
import PriceDialog from "./PriceDialog.jsx";
import { createDomain, deleteDomain, fetchAccounts, fetchDomains, fetchPrices, savePrices, saveTenantSetting, updateDomain } from "./domainApi";
import { domainBody } from "./domainFormRules";
import {
  EMPTY_PRICES,
  MAX_COMPANIES,
  MAX_GROUPS,
  canDeleteDomain,
  canSetPermanent,
  filterDomains,
  sortDomains,
  toDomains,
  toPriceBody,
  toPrices,
} from "./domainRules";
import { tenantSettingBody } from "./domainSettingsRules";

// Gap between the row cards; useListView needs the same number to work out how many rows fit.
const ROW_GAP = 8;

const buttonSize = "h-9 py-0";
const READ_ONLY = "Read-only login";

const NO_ROWS = [];
const NO_ACCOUNTS = [];

/**
 * Domain (C168 only): owners with their groups and companies, from the Spring Boot API (domainApi.js); the list is read
 * again after every change. Rows are cards without a frame around the list or the toolbar.
 *  - Add / Edit open the form modal; its Save sends the owner with its groups and companies, then the settings set in
 *    the modal (expiry, company type, share and the domain fee charge) one group / company at a time.
 *  - Price edits the default domain fee of a company and of a group.
 *  - Delete removes the ticked owners one after the other, with their groups, companies and C168 accounts; the back end
 *    refuses an owner that has transactions under C168 and the run stops there.
 */
export default function DomainPage() {
  const { user } = useSession();
  const viewer = useCurrentUser();
  const readOnly = Boolean(viewer?.readOnly);
  const tenantId = user?.tenant_id;

  const [rows, setRows] = useState(NO_ROWS);
  const [prices, setPrices] = useState(EMPTY_PRICES);
  const [accounts, setAccounts] = useState(NO_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null); // { title, message } of a failed action

  // null = closed, { mode: "add" } or { mode: "edit", domain } = open
  const [domainForm, setDomainForm] = useState(null);
  const closeDomainForm = useCallback(() => setDomainForm(null), []);
  const [priceOpen, setPriceOpen] = useState(false);
  const closePrice = useCallback(() => setPriceOpen(false), []);
  const [toDelete, setToDelete] = useState(null); // the owners to delete

  const view = useListView(rows, { filter: filterDomains, sort: sortDomains, canSelect: canDeleteDomain, rowGap: ROW_GAP });

  useEffect(() => {
    if (!tenantId) return undefined;
    let alive = true;
    Promise.all([fetchDomains(), fetchPrices(), fetchAccounts(tenantId)])
      .then(([list, fees, accountList]) => {
        if (!alive) return;
        setRows(toDomains(list));
        setPrices(toPrices(fees));
        setAccounts(accountList);
        setLoadError("");
      })
      .catch((e) => alive && setLoadError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tenantId, reloadKey]);

  const reloadRows = async () => setRows(toDomains(await fetchDomains()));

  // Runs one change: blocks double clicks, shows the backend's message when it fails. Returns true on success.
  const run = async (title, action) => {
    setBusy(true);
    try {
      await action();
      return true;
    } catch (e) {
      setProblem({ title, message: e.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const savePriceList = async (next) => {
    if (busy) return;
    const ok = await run("Could not save the prices", async () => setPrices(toPrices(await savePrices(toPriceBody(next)))));
    if (ok) setPriceOpen(false);
  };

  // The owner first; then every group / company whose Set was saved in the modal, one after the other (the back end charges the
  // domain fee on that call when Share is on). A failed owner keeps the modal open; failed settings are listed afterwards.
  const saveDomain = async ({ owner, groups, companies, settings }) => {
    if (busy) return;
    const isEdit = domainForm.mode === "edit";
    setBusy(true);
    let saved;
    try {
      const body = domainBody(isEdit, domainForm.domain?.id, { owner, groups, companies });
      saved = await (isEdit ? updateDomain(body) : createDomain(body));
    } catch (e) {
      setBusy(false);
      setProblem({ title: isEdit ? "Could not save the domain" : "Could not add the domain", message: e.message });
      return;
    }

    const tenantIds = new Map();
    for (const t of saved?.groups ?? []) tenantIds.set(`group:${t.code}`, t.id);
    for (const t of saved?.companies ?? []) tenantIds.set(`company:${t.code}`, t.id);
    const failed = [];
    for (const [key, values] of Object.entries(settings)) {
      const [kind, code] = key.split(":");
      const tenantIdOfKey = tenantIds.get(key);
      if (!tenantIdOfKey) continue;
      try {
        await saveTenantSetting(tenantSettingBody({ ownerId: saved.id, tenantId: tenantIdOfKey, kind, code, settings: values, accounts }));
      } catch (e) {
        failed.push(`${code}: ${e.message}`);
      }
    }

    try {
      await reloadRows();
    } catch (e) {
      failed.push(`The list could not be refreshed: ${e.message}`);
    }
    setBusy(false);
    setDomainForm(null);
    if (failed.length) {
      setProblem({ title: "Domain saved, but some settings were not", message: `${failed.join("; ")}. Open Edit and press Set again for these.` });
    }
  };

  const confirmDelete = async () => {
    const list = toDelete;
    setToDelete(null);
    setBusy(true);
    let done = 0;
    let failure = "";
    for (const r of list) {
      try {
        await deleteDomain(r.id);
        done += 1;
      } catch (e) {
        failure = `${r.ownerCode}: ${e.message}`;
        break;
      }
    }
    try {
      await reloadRows();
    } catch (e) {
      failure ||= `The list could not be refreshed: ${e.message}`;
    }
    view.clearSelection();
    setBusy(false);
    if (failure) setProblem({ title: done ? `Deleted ${done}, then stopped` : "Could not delete the domain", message: failure });
  };

  const columns = [
    { key: "no", label: "No", sortable: false, className: "w-[48px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
    { key: "ownerCode", label: "Owner Code", cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.ownerCode },
    { key: "name", label: "Name", fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.name },
    { key: "email", label: "Email", fit: true, cellClassName: "text-[#374151]", render: (r) => r.email },
    {
      key: "groups",
      label: "Groups",
      sortable: false,
      render: (r) => <CodeChips codes={r.groups} max={MAX_GROUPS} tone="group" />,
    },
    {
      key: "companies",
      label: "Companies",
      sortable: false,
      render: (r) => <CodeChips codes={r.companies} max={MAX_COMPANIES} tone="company" />,
    },
    { key: "createdBy", label: "Created By", cellClassName: "whitespace-nowrap", render: (r) => r.createdBy || "-" },
    {
      key: "action",
      label: "Action",
      sortable: false,
      className: "text-center",
      render: (r) => <IconAction title="Edit domain" aria-label="Edit domain" onClick={() => setDomainForm({ mode: "edit", domain: r })} />,
    },
  ];

  const selected = view.selectedRows.length;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <div className="flex flex-none flex-wrap items-center gap-2.5 px-1">
        <PrimaryButton
          icon={Plus}
          className={buttonSize}
          disabled={readOnly || loading || Boolean(loadError)}
          title={readOnly ? READ_ONLY : undefined}
          onClick={() => setDomainForm({ mode: "add" })}
        >
          Add Domain
        </PrimaryButton>

        <label className="flex h-9 w-full max-w-[280px] min-w-[180px] flex-1 items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3 text-[13px] shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-[#3b82f6]">
          <Search className="size-4 flex-none text-dash-faint" strokeWidth={2.2} />
          <input
            value={view.search}
            onChange={(e) => view.setSearch(e.target.value)}
            className="w-full bg-transparent uppercase outline-none placeholder:normal-case placeholder:text-dash-faint"
            placeholder="Search by Owner Name/Company"
          />
        </label>

        {/* Steel blue: one step deeper than Add Domain's blue, so Price reads as a settings action next to it. */}
        <SecondaryButton
          icon={CircleDollarSign}
          className={`${buttonSize} bg-[linear-gradient(180deg,#5b86e8_0%,#2a52c0_100%)] shadow-[0_6px_14px_-6px_rgba(42,82,192,0.6)] transition-[filter] hover:brightness-105`}
          disabled={loading || Boolean(loadError)}
          onClick={() => setPriceOpen(true)}
        >
          Price
        </SecondaryButton>

        {/* Always red, like the old page; it only acts when owners are ticked. */}
        <button
          type="button"
          disabled={!selected || busy || readOnly}
          title={readOnly ? READ_ONLY : undefined}
          onClick={() => setToDelete(view.selectedRows)}
          className="ml-auto inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-[10px] bg-[linear-gradient(180deg,#ff6b6b_0%,#dc2626_100%)] px-4 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(220,38,38,0.6)] transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
        >
          <Trash2 className="size-4" strokeWidth={2.2} />
          Delete ({selected})
        </button>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-none items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-dash-down">
          <span className="min-w-0">{loadError}</span>
          <button
            type="button"
            onClick={() => {
              setLoadError("");
              setLoading(true);
              setReloadKey((k) => k + 1);
            }}
            className="flex-none cursor-pointer border-none bg-transparent text-[12px] font-bold text-[#1d7bff]"
          >
            Retry
          </button>
        </div>
      )}

      <DataTable variant="cards" columns={columns} noun="domains" minWidth="min-w-0" fitWidth emptyMessage={loading ? "Loading…" : "No domains found"} {...view.table} />

      {priceOpen && <PriceDialog prices={prices} onSave={savePriceList} onClose={closePrice} />}

      {/* Add Domain and Edit Domain share one modal. */}
      {domainForm && (
        <DomainFormModal
          mode={domainForm.mode}
          domain={domainForm.domain}
          prices={prices}
          accounts={accounts}
          canPermanent={canSetPermanent(viewer)}
          readOnly={readOnly}
          saving={busy}
          onClose={closeDomainForm}
          onSave={saveDomain}
        />
      )}

      <DeleteDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        names={(toDelete ?? []).map((r) => r.ownerCode)}
        noun="domain"
        note="Its groups and companies, and their accounts under C168, are deleted too."
        onConfirm={confirmDelete}
      />
      <StatusDialog
        open={Boolean(problem)}
        onOpenChange={(open) => !open && setProblem(null)}
        type="error"
        title={problem?.title ?? ""}
        description={problem?.message ?? ""}
        confirmText="OK"
      />
    </div>
  );
}
