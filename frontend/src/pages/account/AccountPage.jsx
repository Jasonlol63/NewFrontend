import { useCallback, useState } from "react";
import { Coins, Plus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import DataTable from "@/components/shared/list/DataTable.jsx";
import ListToolbar, { DeleteButton, PrimaryButton, SecondaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { Badge, DateText, IconAction, StatusBadge } from "@/components/shared/list/cells.jsx";
import { useListScope } from "@/components/shared/list/useListScope";
import { useListView } from "@/components/shared/list/useListView";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import { useTenantList } from "@/components/shared/list/useTenantList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { postJson } from "@/lib/api";
import { ROLE_BADGE, ROLE_BADGE_NONE, filterAccounts, normalizeAccountRow, sortAccounts } from "./accountRules";
import AccountFormModal from "./form/AccountFormModal.jsx";
import { UPDATE_URL, toLocalIsoDate } from "./form/accountFormRules";
import CurrencySettingModal from "./currency/CurrencySettingModal.jsx";
import LinkAccountModal from "./link/LinkAccountModal.jsx";

// Payment alert on / off; a click switches it right away (see toggleAlert in the page).
function AlertPill({ on, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      title={disabled ? "Read-only login" : "Click to switch"}
      // Rounded rectangle (rounded-md) to line up with the Role / Status badges.
      className={cn(
        "relative inline-flex h-[22px] w-[46px] items-center rounded-md border-none text-[9.5px] font-bold tracking-[0.3px] text-white transition-[filter] enabled:cursor-pointer enabled:hover:brightness-105 disabled:cursor-not-allowed",
        on
          ? "justify-start bg-alert-on pl-2 shadow-[0_4px_10px_-4px_rgba(5,150,105,0.6),inset_0_0_0_1px_rgba(4,120,87,0.25)]"
          : "justify-end bg-alert-off pr-[7px] shadow-[0_4px_10px_-4px_rgba(229,62,62,0.6),inset_0_0_0_1px_rgba(185,28,28,0.25)]"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-4 rounded-[4px] bg-[linear-gradient(180deg,#fff_0%,#f1f5f9_100%)]",
          on ? "right-[3px] shadow-[0_1px_3px_rgba(6,78,59,0.4)]" : "left-[3px] shadow-[0_1px_3px_rgba(127,29,29,0.4)]"
        )}
      />
      {on ? "ON" : "OFF"}
    </button>
  );
}

export default function AccountPage() {
  const user = useCurrentUser();
  const readOnly = Boolean(user?.readOnly);
  // null = closed, { mode: "add" } or { mode: "edit", account } = open
  const [accountForm, setAccountForm] = useState(null);
  const closeAccountForm = useCallback(() => setAccountForm(null), []);
  const [linkAccount, setLinkAccount] = useState(null); // the row whose links are being edited
  const closeLinkAccount = useCallback(() => setLinkAccount(null), []);
  const [currencySetting, setCurrencySetting] = useState(false);
  const closeCurrencySetting = useCallback(() => setCurrencySetting(false), []);
  const [alertPending, setAlertPending] = useState(() => new Set()); // account ids whose alert is being switched off
  const [actionError, setActionError] = useState("");
  const scope = useListScope({ onChange: () => view.reset() });
  const { rows, error: listError, loading, toggleStatus, deleteRows, reload } = useTenantList("/api/account", scope.tenantId, {
    normalize: normalizeAccountRow,
  });

  // Companies the Add / Edit modal offers: the picked Group's companies, or just the Group when its own view is picked.
  const modalCompanyOptions =
    scope.company === null && scope.group
      ? [{ value: scope.group, label: scope.group, tenantId: scope.tenantId }]
      : scope.companyOptions;

  // Posts what the modal built ({ url, body }); on success the modal closes and the list is fetched again.
  // A failure is thrown back to the modal, which shows the message.
  const submitAccount = useCallback(
    async ({ url, body }) => {
      await postJson(url, body);
      closeAccountForm();
      reload();
    },
    [closeAccountForm, reload]
  );

  // Alert pill: switches the alert on or off right away, keeping whatever alert settings the account already
  // has. An account that never had any settings simply switches on with none, and the backend raises no alert
  // until a type, start date and amount are set (Edit Account). It is a full account update (the backend replaces
  // the account's currencies and companies with what it is sent), so both are read first and sent back unchanged.
  const toggleAlert = async (a) => {
    setActionError("");
    setAlertPending((s) => new Set(s).add(a.id));
    try {
      const available = await postJson(
        `/api/currency/available?tenant_id=${encodeURIComponent(scope.tenantId)}&account_id=${encodeURIComponent(a.id)}`,
        null
      );
      await postJson(UPDATE_URL, {
        id: a.id,
        scopeTenantId: scope.tenantId,
        name: a.name,
        role: a.role,
        remark: a.remark,
        paymentAlert: a.paymentAlert ? 0 : 1,
        alertDay: a.alertDay,
        alertAmount: a.alertAmount,
        alertSpecificDate: toLocalIsoDate(a.alertStartDate) || null,
        currencyIds: (available.data || []).filter((c) => c.is_linked).map((c) => c.id),
        tenantIds: a.tenantIds.length ? a.tenantIds : [scope.tenantId],
      });
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAlertPending((s) => {
        const next = new Set(s);
        next.delete(a.id);
        return next;
      });
    }
  };

  // Only inactive accounts can be deleted.
  const canSelect = useCallback((a) => !readOnly && a.status === "inactive", [readOnly]);
  const view = useListView(rows, { filter: filterAccounts, sort: sortAccounts, canSelect });
  const actions = useRowActions({
    toggleStatus,
    deleteRows,
    noun: "account",
    label: (a) => a.accountId,
    onDeleted: view.clearSelection,
  });

  const columns = [
    { key: "no", label: "No", sortable: false, className: "w-[56px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
    { key: "accountId", label: "Account", cellClassName: "font-semibold whitespace-nowrap", render: (a) => a.accountId },
    { key: "name", label: "Name", cellClassName: "whitespace-nowrap", render: (a) => a.name },
    { key: "role", label: "Role", render: (a) => <Badge className={ROLE_BADGE[a.role] ?? ROLE_BADGE_NONE}>{a.role}</Badge> },
    {
      key: "alert",
      label: "Alert",
      render: (a) => (
        <AlertPill on={a.paymentAlert} disabled={readOnly || alertPending.has(a.id)} onToggle={() => toggleAlert(a)} />
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (a) => (
        <StatusBadge
          status={a.status}
          pending={actions.pendingIds.has(a.id)}
          onToggle={readOnly ? undefined : () => actions.toggle(a)}
          disabledTitle={readOnly ? "Read-only login" : undefined}
        />
      ),
    },
    { key: "lastLogin", label: "Last Login", render: (a) => <DateText value={a.lastLogin} /> },
    { key: "lastLogout", label: "Last Logout", cellClassName: "text-[#374151]", render: (a) => <DateText value={a.lastLogout} /> },
    {
      key: "remark",
      label: "Remark",
      cellClassName: "max-w-[220px] truncate text-[#374151]",
      render: (a) => <span title={a.remark || undefined}>{a.remark || "-"}</span>,
    },
    {
      key: "action",
      label: "Action",
      sortable: false,
      className: "text-center",
      cellClassName: "whitespace-nowrap",
      render: (a) => (
        <>
          <IconAction
            onClick={() => setAccountForm({ mode: "edit", account: a })}
            disabled={readOnly}
            title={readOnly ? "Read-only login" : "Edit account"}
            aria-label="Edit account"
          />
          <IconAction
            icon={Plus}
            onClick={() => setLinkAccount(a)}
            disabled={readOnly}
            title={readOnly ? "Read-only login" : "Link account"}
            aria-label="Link account"
          />
        </>
      ),
    },
  ];

  const pageError = scope.error || listError || actionError;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <ListToolbar
        primaryAction={
          <PrimaryButton icon={UserPlus} onClick={() => setAccountForm({ mode: "add" })} disabled={readOnly} title={readOnly ? "Read-only login" : undefined}>
            Add Account
          </PrimaryButton>
        }
        actions={
          <>
            <SecondaryButton icon={Coins} onClick={() => setCurrencySetting(true)} disabled={readOnly || loading || !scope.tenantId} title={readOnly ? "Read-only login" : undefined}>
              Currency Setting
            </SecondaryButton>
            <DeleteButton count={view.selectedRows.length} onClick={() => actions.requestDelete(view.selectedRows)} />
          </>
        }
        searchPlaceholder="Search Account, Name, Role, Remark"
        search={view.search}
        onSearchChange={view.setSearch}
        chips={view.chips}
        onChipChange={view.setChip}
        scope={scope}
      />

      {pageError && (
        <div className="flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-dash-down">
          {pageError}
        </div>
      )}

      <DataTable columns={columns} noun="accounts" loading={loading} boxedPager {...view.table} />

      {actions.dialogs}

      {/* Currency Setting fills the content area (sidebar stays visible). */}
      {currencySetting && (
        <CurrencySettingModal tenantId={scope.tenantId} accounts={rows} onClose={closeCurrencySetting} onSaved={closeCurrencySetting} />
      )}

      {linkAccount && (
        <LinkAccountModal account={linkAccount} accounts={rows} tenantId={scope.tenantId} onClose={closeLinkAccount} onSaved={closeLinkAccount} />
      )}

      {/* Add Account and Edit Account share one modal. */}
      {accountForm && (
        <AccountFormModal
          mode={accountForm.mode}
          account={accountForm.account}
          tenantId={scope.tenantId}
          companyOptions={modalCompanyOptions}
          onClose={closeAccountForm}
          onSave={submitAccount}
        />
      )}
    </div>
  );
}
