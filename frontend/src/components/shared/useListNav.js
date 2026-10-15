import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keyboard control of the option list of a dropdown: Arrow Down / Up move the highlight (wrapping round), Enter picks the
 * highlighted option. Put `onKeyDown` on the popup (it also hears the search box) and `listRef` on the scrolling list; mark the
 * highlighted option with data-active={nav.active === i}.
 *  - items: the options shown; selectedIndex: where the current value is (the highlight starts there, or on the first match
 *    of a search); open / query: when either changes the highlight starts again; onPick(item).
 */
export function useListNav({ items, selectedIndex = -1, open, query = "", onPick }) {
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    setActive(query ? 0 : Math.max(selectedIndex, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the highlight starts again on open / a new search only
  }, [open, query]);

  // The highlighted option stays in view.
  useEffect(() => {
    if (open) listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open, items]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (items.length === 0) return;
        setActive((i) => (e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length));
      } else if (e.key === "Enter") {
        const item = items[Math.min(active, items.length - 1)];
        if (!item) return;
        e.preventDefault();
        onPick(item);
      }
    },
    [items, active, onPick]
  );

  return { active, setActive, onKeyDown, listRef };
}
