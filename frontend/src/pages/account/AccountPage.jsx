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
import { ROLE_BADGE, ROLE_BADGE_NONE, filterAccounts, normalizeAccountRow, sortAccounts } from "./accountRules";
import AccountFormModal from "./AccountFormModal.jsx";
import CurrencySettingModal from "./CurrencySettingModal.jsx";
import { MOCK_ACCOUNTS } from "./currencySettingRules";

const NOT_BUILT = "Not available yet";

// Payment alert on / off. Clicking it only switches it on this page for now (design preview):
// saving goes through the full account update (with the account's linked currencies), not wired up yet.
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
  const [currencySetting, setCurrencySetting] = useState(false);
  const closeCurrencySetting = useCallback(() => setCurrencySetting(false), []);
  // Payment alert switched on this page (account id -> on/off), until the update API is wired up.
  const [alertOverrides, setAlertOverrides] = useState({});
  const alertOn = (a) => alertOverrides[a.id] ?? a.paymentAlert;
  const scope = useListScope("account.scope", { onChange: () => view.reset() });
  const { rows, error: listError, loading, toggleStatus, deleteRows } = useTenantList("/api/account", scope.tenantId, {
    normalize: normalizeAccountRow,
  });

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
        <AlertPill
          on={alertOn(a)}
          disabled={readOnly}
          onToggle={() => setAlertOverrides((o) => ({ ...o, [a.id]: !alertOn(a) }))}
        />
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
            onClick={() => setAccountForm({ mode: "edit", account: { ...a, paymentAlert: alertOn(a) } })}
            disabled={readOnly}
            title={readOnly ? "Read-only login" : "Edit account"}
            aria-label="Edit account"
          />
          <IconAction icon={Plus} disabled title={NOT_BUILT} aria-label="Link account" />
        </>
      ),
    },
  ];

  const pageError = scope.error || listError;

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
            <SecondaryButton icon={Coins} onClick={() => setCurrencySetting(true)} disabled={readOnly} title={readOnly ? "Read-only login" : undefined}>
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

      {/* Currency Setting fills the content area (sidebar stays visible). UI only for now: the holdings are placeholders and Save just closes it. */}
      {currencySetting && (
        <CurrencySettingModal accounts={rows.length ? rows : MOCK_ACCOUNTS} onClose={closeCurrencySetting} onSave={closeCurrencySetting} />
      )}

      {/* Add Account and Edit Account share one modal. UI only for now: Save just closes it until the API is wired up. */}
      {accountForm && (
        <AccountFormModal
          mode={accountForm.mode}
          account={accountForm.account}
          companyCode={scope.company}
          companyOptions={scope.companyOptions}
          onClose={closeAccountForm}
          onSave={closeAccountForm}
        />
      )}
    </div>
  );
}
