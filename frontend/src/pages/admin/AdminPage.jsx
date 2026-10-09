import { useCallback, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import DataTable from "@/components/shared/list/DataTable.jsx";
import ListToolbar, { DeleteButton, PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { Badge, DateText, IconAction, StatusBadge } from "@/components/shared/list/cells.jsx";
import { useListScope } from "@/components/shared/list/useListScope";
import { useListView } from "@/components/shared/list/useListView";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import { useTenantList } from "@/components/shared/list/useTenantList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { postJson } from "@/lib/api";
import { ROLE_BADGE, filterUsers, normalizeUserRow, roleLabel, rowCapabilities, sortUsers } from "./userListRules";
import UserFormModal from "./UserFormModal.jsx";

const canSelect = (u) => u.caps.canDelete;
// The owner row and a staff row can share an id (different tables).
const rowKey = (u) => `${u.isOwnerShadow ? "owner" : "user"}-${u.id}`;

export default function AdminPage() {
  const viewer = useCurrentUser();
  // null = closed, { mode: "add" } or { mode: "edit", user } = open
  const [userForm, setUserForm] = useState(null);
  const closeUserForm = useCallback(() => setUserForm(null), []);
  const scope = useListScope({ onChange: () => view.reset() });
  const { rows, error: listError, loading, toggleStatus, deleteRows, reload } = useTenantList("/api/userlist", scope.tenantId, {
    normalize: normalizeUserRow,
    rowKey,
  });

  // Posts what the modal built ({ url, body }); on success the modal closes and the list is fetched again.
  // A failure is thrown back to the modal, which shows the message.
  const submitUser = useCallback(
    async ({ url, body }) => {
      await postJson(url, body);
      closeUserForm();
      reload();
    },
    [closeUserForm, reload]
  );

  const rowsWithCaps = useMemo(() => rows.map((u) => ({ ...u, caps: rowCapabilities(u, viewer) })), [rows, viewer]);
  const filter = useCallback((list, opts) => filterUsers(list, { ...opts, viewer }), [viewer]);
  const view = useListView(rowsWithCaps, { filter, sort: sortUsers, canSelect });
  const actions = useRowActions({
    toggleStatus,
    deleteRows,
    noun: "user",
    label: (u) => u.loginId,
    onDeleted: view.clearSelection,
  });

  const columns = [
    { key: "no", label: "No", sortable: false, className: "w-[56px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
    { key: "loginId", label: "Login ID", cellClassName: "font-semibold whitespace-nowrap", render: (u) => u.loginId },
    { key: "name", label: "Name", cellClassName: "whitespace-nowrap", render: (u) => u.name },
    { key: "email", label: "Email", cellClassName: "text-[#374151]", render: (u) => u.email },
    {
      key: "role",
      label: "Role",
      render: (u) => <Badge className={ROLE_BADGE[u.role] ?? ROLE_BADGE.customer_service}>{roleLabel(u.role)}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (u) => (
        <StatusBadge
          status={u.status}
          pending={actions.pendingIds.has(u.id)}
          onToggle={u.caps.canToggleStatus ? () => actions.toggle(u) : undefined}
        />
      ),
    },
    { key: "lastLogin", label: "Last Login", render: (u) => <DateText value={u.lastLogin} /> },
    { key: "lastLogout", label: "Last Logout", cellClassName: "text-[#374151]", render: (u) => <DateText value={u.lastLogout} /> },
    { key: "createdBy", label: "Created By", cellClassName: "whitespace-nowrap", render: (u) => u.createdBy || "-" },
    {
      key: "action",
      label: "Action",
      sortable: false,
      className: "text-center",
      render: (u) => (
        <IconAction
          disabled={!u.caps.canEdit}
          title={u.caps.canEdit ? "Edit user" : "No permission to edit"}
          onClick={() => setUserForm({ mode: "edit", user: u })}
        />
      ),
    },
  ];

  const pageError = scope.error || listError;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <ListToolbar
        primaryAction={
          <PrimaryButton
            icon={UserPlus}
            disabled={!scope.tenantId || Boolean(viewer?.readOnly)}
            onClick={() => setUserForm({ mode: "add" })}
          >
            Add User
          </PrimaryButton>
        }
        actions={<DeleteButton count={view.selectedRows.length} onClick={() => actions.requestDelete(view.selectedRows)} />}
        searchPlaceholder="Search Login ID, Name, Email"
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

      <DataTable
        columns={columns}
        rowKey={rowKey}
        noun="users"
        loading={loading}
        boxedPager
        {...view.table}
      />

      {actions.dialogs}

      {/* Add User and Edit User share one modal. */}
      {userForm && (
        <UserFormModal
          mode={userForm.mode}
          user={userForm.user}
          tenantId={scope.tenantId}
          companyCode={scope.company}
          viewer={viewer}
          onClose={closeUserForm}
          onSave={submitUser}
        />
      )}
    </div>
  );
}
