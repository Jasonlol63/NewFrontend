import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * Tells the errors of a capture page as toasts (push of hooks/useNotice): each [error, headline, retry?] entry is shown once when
 * its error text appears or changes, with the back end's text as the second line and a Retry link when `retry` is given.
 */
export function useErrorToasts(push, entries) {
  const { t } = useTranslation("common");
  const shown = useRef(new Map());
  useEffect(() => {
    for (const [error, headline, retry] of entries) {
      const last = shown.current.get(headline) ?? "";
      if ((error || "") === last) continue;
      shown.current.set(headline, error || "");
      if (error) push(headline, "error", error, retry ? { label: t("retry"), onClick: retry } : undefined);
    }
  });
}
