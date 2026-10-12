import { useCallback, useEffect, useRef } from "react";
import { cellsToGrid, fetchDraft, saveDraft } from "./captureApi";
import { createGrid, hasData } from "./grid/gridModel";

const SAVE_PAUSE = 600;

/**
 * Keeps the sheet of one process + currency as a draft on the server (/api/datacapture/*\/draft/*).
 *  - sheet: useCaptureGrid; draft: { kind: "bank" | "game", tenantId, process, currencyId } or null when the picked process keeps
 *    no draft; picked: process + currency are both chosen (a new pick starts from the draft of that pick, or from an empty sheet);
 *    size: { rows, cols } of a fresh sheet; readOnly: a read-only login never saves.
 *  - onLoadError(error): the draft of a pick could not be loaded (nothing is saved for that pick then).
 *  - Edits are saved after a short pause, and at once when the pick changes or the page closes. Nothing is saved for a pick
 *    until its draft was loaded (an empty sheet must not wipe a draft that has not come back yet).
 * Returns { flush, remove }: flush saves now (before Reset / Submit); remove empties the draft and the sheet and answers (a promise)
 * true when the server emptied it, false when that failed (the sheet is then left as it is), null when there was no draft loaded to empty.
 */
export function useCaptureDraft({ sheet, draft, picked, size, readOnly = false, onLoadError }) {
  const { grid, resetGrid } = sheet;
  const keyId = draft ? `${draft.kind}:${draft.tenantId}:${draft.process}:${draft.currencyId}` : null;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // The grid of the last commit, for the cleanup below (it runs after the next render, when a Reset has emptied the grid).
  const committed = useRef(grid);
  const latest = useRef(grid);
  latest.current = grid;
  // The key whose draft is loaded: only that one is saved. skip: grid changes made by this hook itself, not by the user.
  const ready = useRef(null);
  const skip = useRef(0);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;

  useEffect(() => {
    committed.current = grid;
  }, [grid]);

  const empty = useCallback(() => {
    skip.current += 1;
    resetGrid(createGrid(sizeRef.current.rows, sizeRef.current.cols));
  }, [resetGrid]);

  // A different process / currency: save the one that was left, start empty, load the draft of the new one.
  useEffect(() => {
    if (!picked) return undefined;
    ready.current = null;
    empty();
    let cancelled = false;
    const key = draftRef.current;
    if (key) {
      fetchDraft(key)
        .then((cells) => {
          if (cancelled) return;
          ready.current = keyId;
          // Typed or pasted while it was loading: that stays.
          if (cells.length && !hasData(latest.current)) {
            skip.current += 1;
            resetGrid(cellsToGrid(cells, sizeRef.current.rows, sizeRef.current.cols));
          }
        })
        .catch((err) => {
          // Not loaded: nothing is saved for this pick, so the server draft stays as it is.
          if (!cancelled && err?.name !== "AbortError") onLoadErrorRef.current?.(err);
        });
    }
    return () => {
      cancelled = true;
      if (key && ready.current === keyId && !readOnly) saveDraft(key, committed.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new pick reloads
  }, [keyId, picked]);

  // Edits of the sheet.
  useEffect(() => {
    if (skip.current > 0) {
      skip.current -= 1;
      return undefined;
    }
    const key = draftRef.current;
    if (!key || readOnly || ready.current !== keyId) return undefined;
    const timer = setTimeout(() => saveDraft(key, grid), SAVE_PAUSE);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a save follows a change of the grid only
  }, [grid]);

  // Closing or reloading the tab inside the pause still keeps the last edit.
  useEffect(() => {
    const save = () => {
      const key = draftRef.current;
      if (key && !readOnly && ready.current === `${key.kind}:${key.tenantId}:${key.process}:${key.currencyId}`) saveDraft(key, committed.current, { keepalive: true });
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [readOnly]);

  const flush = useCallback(() => {
    const key = draftRef.current;
    if (key && !readOnly && ready.current === keyId) saveDraft(key, latest.current);
  }, [keyId, readOnly]);
  const remove = useCallback(async () => {
    const key = draftRef.current;
    if (!key || readOnly || ready.current !== keyId) {
      empty();
      return null;
    }
    const ok = await saveDraft(key, createGrid(1, 1));
    if (ok) empty();
    return ok;
  }, [keyId, readOnly, empty]);

  return { flush, remove };
}
