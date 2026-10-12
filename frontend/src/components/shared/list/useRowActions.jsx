import { useState } from "react";
import { useTranslation } from "react-i18next";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import StatusDialog from "@/components/shared/StatusDialog.jsx";

/**
 * Status toggle + bulk delete flow shared by the list pages.
 *  - toggleStatus(row) / deleteRows(rows) are the page's API calls (they throw on failure).
 *  - noun ("user", "account") and label(row) word the delete confirmation; note(rows) can add a line under it
 *    (what else is removed with them).
 *  - Returns the rows being toggled (`pendingIds`), handlers, and the confirm / error `dialogs`
 *    to render once in the page.
 */
export function useRowActions({ toggleStatus, deleteRows, noun = "item", label = (row) => row.id, note, onDeleted }) {
  const { t } = useTranslation();
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [toDelete, setToDelete] = useState(null); // rows awaiting confirmation
  const [failure, setFailure] = useState(null); // { title, description }

  const toggle = async (row) => {
    setPendingIds((s) => new Set(s).add(row.id));
    try {
      await toggleStatus(row);
    } catch (err) {
      setFailure({ title: t("rowActions.statusFailed"), description: err.message });
    } finally {
      setPendingIds((s) => {
        const next = new Set(s);
        next.delete(row.id);
        return next;
      });
    }
  };

  const confirmDelete = async () => {
    const rows = toDelete;
    setToDelete(null);
    try {
      await deleteRows(rows);
    } catch (err) {
      setFailure({ title: t("rowActions.deleteFailed"), description: err.message });
    }
    onDeleted?.();
  };

  const dialogs = (
    <>
      <DeleteDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        names={toDelete?.map(label) ?? []}
        noun={noun}
        note={toDelete && note ? note(toDelete) : undefined}
        onConfirm={confirmDelete}
      />
      <StatusDialog
        open={Boolean(failure)}
        onOpenChange={(open) => !open && setFailure(null)}
        type="error"
        title={failure?.title}
        description={failure?.description}
        confirmText={t("ok")}
      />
    </>
  );

  return { pendingIds, toggle, requestDelete: (rows) => rows.length && setToDelete(rows), dialogs };
}
