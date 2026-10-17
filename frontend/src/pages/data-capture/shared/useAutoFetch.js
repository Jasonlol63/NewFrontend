import { useCallback, useEffect, useRef, useState } from "react";
import { AUTO_FETCH_CAPTCHA, fetchAutoReport } from "./autoFetchApi";

/**
 * Auto Fetch of the Data Capture Table: fills the sheet with the picked process's Payment Report instead of it being
 * copied in by hand.
 *  - setup: { tenantId, processId, captureDate } of the pick, or null when the process has no Auto Fetch (nothing runs);
 *  - canFill(): false stops a fetched report from being written (the sheet is not empty / the page is read-only);
 *  - onReport(text): the report, as the text a copy of the two tables gives, to paste into the sheet;
 *  - onError(message): what went wrong, for a toast.
 * A pick fetches on its own, once per pick: a website session that is already open means the sheet simply fills. When
 * the website wants its validation code, `captcha` holds the image to show and submit(code) answers it. refresh() asks
 * again (after Reset, or to try a new code).
 */
export function useAutoFetch({ setup, canFill, onReport, onError }) {
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState(null);
  const key = setup ? `${setup.tenantId}|${setup.processId}|${setup.captureDate}` : "";
  // The pick a fetch has already been started for, so it does not run again on every render.
  const asked = useRef("");
  const live = useRef(null);
  const cb = useRef({ canFill, onReport, onError });
  cb.current = { canFill, onReport, onError };

  const run = useCallback(
    async (answer) => {
      if (!setup) return;
      const run = Symbol("fetch");
      live.current = run;
      setLoading(true);
      try {
        const result = await fetchAutoReport({ ...setup, ...answer });
        if (live.current !== run) return;
        if (result.status === AUTO_FETCH_CAPTCHA) {
          setCaptcha({ ticket: result.ticket, image: result.captchaImage, message: result.message, site: result.site });
          return;
        }
        setCaptcha(null);
        if (!result.text) {
          cb.current.onError?.("");
          return;
        }
        if (cb.current.canFill?.()) cb.current.onReport?.(result.text, result);
      } catch (err) {
        if (live.current !== run) return;
        if (err?.name === "AbortError") return;
        // A refused code / password keeps the dialog open so another code can be typed.
        setCaptcha((c) => (c ? { ...c, message: err.message } : null));
        cb.current.onError?.(err.message);
      } finally {
        if (live.current === run) setLoading(false);
      }
    },
    [setup]
  );

  // A new pick fetches once on its own; leaving Auto Fetch behind drops whatever was in flight.
  useEffect(() => {
    if (!key) {
      asked.current = "";
      live.current = null;
      setCaptcha(null);
      return;
    }
    if (asked.current === key) return;
    asked.current = key;
    setCaptcha(null);
    run();
  }, [key, run]);

  const submit = useCallback((code) => run({ ticket: captcha?.ticket, captcha: code }), [run, captcha]);
  const refresh = useCallback(() => {
    asked.current = key;
    setCaptcha(null);
    run();
  }, [run, key]);
  const dismiss = useCallback(() => {
    live.current = null;
    setCaptcha(null);
    setLoading(false);
  }, []);

  return { enabled: Boolean(setup), loading, captcha, submit, refresh, dismiss };
}
