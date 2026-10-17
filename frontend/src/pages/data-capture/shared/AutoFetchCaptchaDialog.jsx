import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SoftButton, TextInput, primaryButtonClass } from "@/components/shared/form-modal/fields.jsx";

/**
 * Auto Fetch: the report website's validation code, which only a person can read. Shows the image the website sent and
 * sends the typed code back (onSubmit); the website session is then kept, so this is asked once, not once per report.
 * captcha: { image, message, site } - message is why a code was refused, when one was. onRefresh asks for a new image.
 */
export default function AutoFetchCaptchaDialog({ captcha, loading, onSubmit, onRefresh, onClose }) {
  const { t } = useTranslation(["capture", "common"]);
  const [code, setCode] = useState("");

  // A new image (a refused code, or a fresh one) empties the box.
  useEffect(() => {
    setCode("");
  }, [captcha?.image]);

  const send = () => {
    const value = code.trim();
    if (value && !loading) onSubmit(value);
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      {/* In full screen only the full-screen element is drawn, so the dialog goes inside it. */}
      <Dialog.Portal container={document.fullscreenElement ?? undefined}>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-dialog-overlay bg-[rgba(20,51,107,0.22)] backdrop-blur-[6px] motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[clamp(300px,24vw,380px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 animate-dialog-in rounded-[20px] bg-white px-6 pb-5 pt-5 shadow-[0_30px_60px_-20px_rgba(20,51,107,0.45),0_8px_20px_-10px_rgba(20,70,160,0.25)] outline-none motion-reduce:animate-none"
        >
          <Dialog.Title className="m-0 fm-section text-brand-navy">{t("autoFetch.title")}</Dialog.Title>
          <p className="mt-1 mb-3 type-caption leading-snug text-dash-sub">{t("autoFetch.hint", { site: captcha.site })}</p>

          <div className="flex items-center gap-2">
            {/* The image comes from the website as a data: URL, through our own backend. */}
            <img src={captcha.image} alt={t("autoFetch.imageAlt")} className="h-[46px] flex-none rounded-[8px] border border-modal-input-line bg-white object-contain px-1" />
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title={t("autoFetch.refresh")}
              aria-label={t("autoFetch.refresh")}
              className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-[9px] border border-modal-input-line bg-modal-input text-[#475569] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} strokeWidth={2.2} />
            </button>
            <TextInput
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              autoFocus
              autoComplete="off"
              inputMode="numeric"
              placeholder={t("autoFetch.placeholder")}
              className="min-w-0 flex-1 text-center tracking-[2px]"
            />
          </div>

          {captcha.message && <p className="mt-2.5 mb-0 type-caption leading-snug text-[#d93a3a]">{captcha.message}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <SoftButton className="h-9 min-w-[88px] px-5" onClick={onClose}>
              {t("common:cancel")}
            </SoftButton>
            <button type="button" onClick={send} disabled={!code.trim() || loading} className={cn(primaryButtonClass, "h-9 min-w-[88px] px-5 fm-btn disabled:cursor-not-allowed disabled:opacity-50")}>
              {loading ? t("autoFetch.working") : t("common:ok")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
