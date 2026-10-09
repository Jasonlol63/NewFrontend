import { useSyncExternalStore } from "react";

/** True while the window matches the media query (e.g. "(min-width: 1700px)"); updates live on resize. */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
