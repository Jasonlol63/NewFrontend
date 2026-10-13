import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";
import DataTable from "@/components/shared/list/DataTable.jsx";
import ListToolbar, { DeleteButton, PrimaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { Badge, DateText, IconAction, StatusBadge } from "@/components/shared/list/cells.jsx";
import { useListScope } from "@/components/shared/list/useListScope";
import { useListView } from "@/components/shared/list/useListView";
import { useRowActions } from "@/components/shared/list/useRowActions.jsx";
import { useTenantList } from "@/components/shared/list/useTenantList";
import Toast from "@/components/shared/Toast.jsx";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotice } from "@/hooks/useNotice";
import { postJson } from "@/lib/api";
import { ROLE_BADGE, filterUsers, normalizeUserRow, roleLabel, rowCapabilities, sortUsers } from "./userListRules";
import UserFormModal from "./UserFormModal.jsx";

const canSelect = (u) => u.caps.canDelete;
// The owner row and a staff row can share an id (different tables).
const rowKey = (u) => `${u.isOwnerShadow ? "owner" : "user"}-${u.id}`;

export default function AdminPage() {
  const { t } = useTranslation(["admin", "common", "sidebar"]);
  const { toasts, push, dismiss } = useNotice(5000);
  const viewer = useCurrentUser();
  // null = closed, { mode: "add" } or { mode: "edit", user } = open
  const [userForm, setUserForm] = useState(null);
  const closeUserForm = useCallback(() => setUserForm(null), []);
  const scope = useListScope({ onChange: () => view.reset() });
  const { rows, error: listError, loading, toggleStatus, deleteRows, reload } = useTenantList("/api/userlist", scope.tenantId, {
    normalize: normalizeUserRow,
    rowKey,
  });

  // Posts what the modal built ({ url, body }); on success the modal closes, the list is fetched again and a toast says so.
  // A failure is thrown back to the modal, which shows it as a toast.
  const submitUser = useCallback(
    async ({ url, body }, meta) => {
      await postJson(url, body);
      const adding = userForm?.mode === "add";
      closeUserForm();
      reload();
      push(adding ? t("toast.added", { id: meta?.loginId }) : t("toast.saved"));
    },
    [closeUserForm, reload, push, t, userForm]
  );

  const rowsWithCaps = useMemo(() => rows.map((u) => ({ ...u, caps: rowCapabilities(u, viewer) })), [rows, viewer]);
  const filter = useCallback((list, opts) => filterUsers(list, { ...opts, viewer }), [viewer]);
  const view = useListView(rowsWithCaps, { filter, sort: sortUsers, canSelect, rowMin: 26 });
  const actions = useRowActions({
    toggleStatus,
    deleteRows,
    noun: "user",
    label: (u) => u.loginId,
    onDeleted: view.clearSelection,
    push,
  });

  const columns = [
    { key: "no", label: t("col.no"), sortable: false, className: "w-[56px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
    { key: "loginId", label: t("col.loginId"), cellClassName: "font-semibold whitespace-nowrap", render: (u) => u.loginId },
    { key: "name", label: t("col.name"), cellClassName: "whitespace-nowrap", render: (u) => u.name },
    { key: "email", label: t("col.email"), cellClassName: "text-[#374151]", render: (u) => u.email },
    {
      key: "role",
      label: t("col.role"),
      render: (u) => (
        <Badge className={ROLE_BADGE[u.role] ?? ROLE_BADGE.customer_service}>{t(`sidebar:role.${u.role}`, { defaultValue: roleLabel(u.role) })}</Badge>
      ),
    },
    {
      key: "status",
      label: t("col.status"),
      render: (u) => (
        <StatusBadge
          status={u.status}
          pending={actions.pendingIds.has(u.id)}
          onToggle={u.caps.canToggleStatus ? () => actions.toggle(u) : undefined}
        />
      ),
    },
    { key: "lastLogin", label: t("col.lastLogin"), render: (u) => <DateText value={u.lastLogin} variant="gradient" /> },
    { key: "lastLogout", label: t("col.lastLogout"), cellClassName: "text-[#374151]", render: (u) => <DateText value={u.lastLogout} variant="gradient" /> },
    { key: "createdBy", label: t("col.createdBy"), cellClassName: "whitespace-nowrap", render: (u) => u.createdBy || "-" },
    {
      key: "action",
      label: t("col.action"),
      sortable: false,
      className: "text-center",
      render: (u) => (
        <IconAction
          className="size-6"
          disabled={!u.caps.canEdit}
          title={u.caps.canEdit ? t("page.edit") : t("page.noEditPermission")}
          onClick={() => setUserForm({ mode: "edit", user: u })}
        />
      ),
    },
  ];

  // A list or company that did not load is an error toast (once per error).
  useEffect(() => {
    if (listError) push(t("errors.list"), "error", listError, { label: t("common:retry"), onClick: reload });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listError]);
  useEffect(() => {
    if (scope.error) push(t("errors.scope"), "error", scope.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.error]);

  return (
    <div className="relative flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <Toast toasts={toasts} onClose={dismiss} />
      <ListToolbar
        primaryAction={
          <PrimaryButton
            icon={UserPlus}
            disabled={!scope.tenantId || Boolean(viewer?.readOnly)}
            onClick={() => setUserForm({ mode: "add" })}
          >
            {t("page.add")}
          </PrimaryButton>
        }
        actions={<DeleteButton count={view.selectedRows.length} onClick={() => actions.requestDelete(view.selectedRows)} />}
        searchPlaceholder={t("page.search")}
        search={view.search}
        onSearchChange={view.setSearch}
        chips={view.chips}
        onChipChange={view.setChip}
        scope={scope}
      />

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
