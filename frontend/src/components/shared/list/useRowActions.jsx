import { useState } from "react";
import { useTranslation } from "react-i18next";
import DeleteDialog from "@/components/shared/DeleteDialog.jsx";
import Toast from "@/components/shared/Toast.jsx";
import { useNotice } from "@/hooks/useNotice";

/**
 * Status toggle + bulk delete flow shared by the list pages.
 *  - toggleStatus(row) / deleteRows(rows) are the page's API calls (they throw on failure).
 *  - noun ("user", "account") and label(row) word the delete confirmation; note(rows) can add a line under it
 *    (what else is removed with them).
 *  - push: the page's toast push (see hooks/useNotice), so its toasts share one stack; without it the hook keeps its own.
 *    A failed toggle / delete is an error toast, a finished delete a success toast; a status change shows nothing.
 *  - Returns the rows being toggled (`pendingIds`), handlers, and the delete confirmation `dialogs` to render once in the page.
 */
export function useRowActions({ toggleStatus, deleteRows, noun = "item", label = (row) => row.id, note, onDeleted, push: pagePush }) {
  const { t } = useTranslation();
  const own = useNotice(5000);
  const push = pagePush ?? own.push;
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [toDelete, setToDelete] = useState(null); // rows awaiting confirmation
  const nounText = t(`nouns.${noun}`, { defaultValue: noun });

  const toggle = async (row) => {
    setPendingIds((s) => new Set(s).add(row.id));
    try {
      await toggleStatus(row);
    } catch (err) {
      push(t("rowActions.statusFailed"), "error", err.message);
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
      const cap = nounText.charAt(0).toUpperCase() + nounText.slice(1);
      push(rows.length === 1 ? t("rowActions.deleted", { noun: cap }) : t("rowActions.deletedMany", { count: rows.length, noun: nounText }));
    } catch (err) {
      push(t("rowActions.deleteFailed", { noun: nounText }), "error", err.message);
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
      <Toast toasts={own.toasts} onClose={own.dismiss} />
    </>
  );

  return { pendingIds, toggle, requestDelete: (rows) => rows.length && setToDelete(rows), dialogs };
}
