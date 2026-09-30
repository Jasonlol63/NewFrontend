import { useState } from "react";
import StatusDialog from "@/components/shared/StatusDialog.jsx";

/**
 * Status toggle + bulk delete flow shared by the list pages.
 *  - toggleStatus(row) / deleteRows(rows) are the page's API calls (they throw on failure).
 *  - noun ("user", "account") and label(row) word the delete confirmation.
 *  - Returns the rows being toggled (`pendingIds`), handlers, and the confirm / error `dialogs`
 *    to render once in the page.
 */
export function useRowActions({ toggleStatus, deleteRows, noun = "item", label = (row) => row.id, onDeleted }) {
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [toDelete, setToDelete] = useState(null); // rows awaiting confirmation
  const [failure, setFailure] = useState(null); // { title, description }

  const toggle = async (row) => {
    setPendingIds((s) => new Set(s).add(row.id));
    try {
      await toggleStatus(row);
    } catch (err) {
      setFailure({ title: "Status not changed", description: err.message });
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
      setFailure({ title: "Delete failed", description: err.message });
    }
    onDeleted?.();
  };

  const count = toDelete?.length ?? 0;
  const dialogs = (
    <>
      <StatusDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        type="warning"
        title={`Delete ${count} ${noun}${count === 1 ? "" : "s"}?`}
        description={
          toDelete && (
            <>
              <b>{toDelete.map(label).join(", ")}</b> will be deleted. This can't be undone.
            </>
          )
        }
        cancelText="Cancel"
        confirmText="Delete"
        onConfirm={confirmDelete}
      />
      <StatusDialog
        open={Boolean(failure)}
        onOpenChange={(open) => !open && setFailure(null)}
        type="error"
        title={failure?.title}
        description={failure?.description}
        confirmText="OK"
      />
    </>
  );

  return { pendingIds, toggle, requestDelete: (rows) => rows.length && setToDelete(rows), dialogs };
}
