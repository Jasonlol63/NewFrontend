import { Dialog } from "radix-ui";
import { useTranslation } from "react-i18next";

/**
 * Link Partner found the id twice: it is a login and also a Group. conflict = { login_partner, tenant_partner } (the two
 * matches, as text) or null (closed); onResolve("login" | "group") links the one picked.
 */
export default function ConflictDialog({ conflict, onResolve, onCancel, busy }) {
  const { t } = useTranslation(["ownership", "common"]);
  const option = "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-xl border border-[#dbe5f3] bg-white px-4 py-3 text-left type-table-cell font-semibold! text-brand-navy transition-colors hover:border-[#7fb2ff] hover:bg-[#f2f7ff] disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <Dialog.Root open={Boolean(conflict)} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-dialog-overlay bg-[rgba(20,51,107,0.22)] backdrop-blur-[6px] motion-reduce:animate-none" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 animate-dialog-in rounded-[20px] bg-white p-6 shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45)] outline-none motion-reduce:animate-none">
          <Dialog.Title className="m-0 mb-1.5 type-card-title font-semibold! text-brand-navy">{t("conflict.title")}</Dialog.Title>
          <Dialog.Description className="m-0 mb-4 type-table-cell font-normal! leading-relaxed text-[#5b74a3]">{t("conflict.text")}</Dialog.Description>
          <div className="flex flex-col gap-2.5">
            <button type="button" disabled={busy} onClick={() => onResolve("login")} className={option}>
              {t("conflict.asLogin")}
              <b className="font-extrabold">{conflict?.login_partner}</b>
            </button>
            <button type="button" disabled={busy} onClick={() => onResolve("group")} className={option}>
              {t("conflict.asGroup")}
              <b className="font-extrabold">{conflict?.tenant_partner}</b>
            </button>
          </div>
          <Dialog.Close className="mt-4 h-10 w-full cursor-pointer rounded-xl border border-[#dbe5f3] bg-white type-body font-semibold! text-brand-navy outline-none hover:bg-[#f5f8fd]">{t("common:cancel")}</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
