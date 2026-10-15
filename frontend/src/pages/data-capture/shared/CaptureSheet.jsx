import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, ClipboardPaste, Copy, Eraser, SquareDashedMousePointer, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MAX_GRID_COLS, rowLetter } from "./dataCaptureRules";
import GridContextMenu from "./grid/GridContextMenu.jsx";
import GridDeleteDialog from "./grid/GridDeleteDialog.jsx";
import { clipboardOf, plainTextMatrix, readClipboard, writeClipboardText } from "./grid/gridClipboard";
import { formatMoneyDisplay } from "./paste/core/dataCapturePasteMoneyUtils.js";
import { pasteIntoSheet } from "./paste/pasteRouter";
import { translatePasteNotice } from "./paste/pasteNotice";
import { safeCellHtml } from "./safeHtml";

const COL_W = 55; // the least width of a column; a column grows to show its longest text in full, the sheet scrolls sideways
const headBase = "sticky z-2 h-[27px] border-r border-b border-white/25 text-center type-table-cell font-semibold! text-white select-none";
const headBg = "bg-[linear-gradient(180deg,#60c1fe,#0f61ff)]";
const headHot = "bg-[linear-gradient(180deg,#3a9bf0,#0a46c7)]";
const rowHeadBase = "sticky left-0 z-1 h-[27px] w-14 cursor-pointer border-r border-b border-[rgba(130,155,195,0.22)] text-center type-table-cell font-semibold! text-brand-navy select-none";

// Puts the caret back where it was after the text of a cell was rewritten (typing in lower case becomes upper case).
function setTextKeepCaret(el, text) {
  const sel = window.getSelection();
  const at = sel?.rangeCount && el.contains(sel.anchorNode) ? sel.anchorOffset : text.length;
  el.textContent = text;
  if (el.firstChild && sel) {
    const range = document.createRange();
    range.setStart(el.firstChild, Math.min(at, text.length));
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function caretToEnd(el) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Is the caret at the very start / end of the cell text? (Arrow Left / Right then moves to the next cell.)
function caretAtEdge(el, end) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return false;
  const len = el.textContent.length;
  return end ? sel.anchorOffset >= len : sel.anchorOffset === 0;
}

const Cell = memo(function Cell({ r, c, cell, selected, active, editing }) {
  const ref = useRef(null);
  const { value, html, styleCssText, style, className, colspan, hidden } = cell;
  // The DOM is only rewritten when the grid holds something else (a paste, a clear, an undo): while typing they match.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (html) {
      const safe = safeCellHtml(html);
      if (el.innerHTML !== safe) el.innerHTML = safe;
    } else if (el.textContent !== value || el.childElementCount) el.textContent = value;
  }, [value, html]);
  // What a paste copied of the look of a cell (colour, bold, ...), kept apart from the classes of the sheet.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.removeAttribute("style");
    if (styleCssText) el.style.cssText = styleCssText;
    else if (style) Object.assign(el.style, style);
    if (hidden) el.style.display = "none";
  }, [styleCssText, style, hidden]);
  return (
    <td
      ref={ref}
      data-r={r}
      data-c={c}
      colSpan={colspan > 1 ? colspan : undefined}
      title={value && !editing ? value : undefined}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      className={cn(
        "h-[27px] min-w-[55px] scroll-ml-16 scroll-mt-8 cursor-cell border-r border-b border-[rgba(130,155,195,0.22)] px-1.5 whitespace-nowrap outline-none select-none",
        selected ? "bg-[#cfe2ff] shadow-[inset_0_0_0_9999px_rgba(59,130,246,0.16)]" : "bg-white hover:bg-[#f1f6ff]",
        className,
        active && "outline-2 -outline-offset-2 outline-[#3b82f6]",
        editing && "bg-white text-clip select-text"
      )}
    />
  );
});

/**
 * The paste sheet (Data Capture Table): a spreadsheet-like grid held in `sheet` (useCaptureGrid).
 *  - Mouse: click, drag, Shift (extend) and Ctrl (add) select cells; the row letters / column numbers select a whole row / column;
 *    the corner selects all; double click edits; right click opens the menus.
 *  - Keyboard: arrows move, typing / Enter / F2 edits (Enter and Tab move on, past the last row / column they add one),
 *    Delete clears, Ctrl+A / C / V / Z select all / copy / paste / undo, Esc leaves.
 * columnEdit: false hides the column menu and "Entire column" (the Bank sheet keeps its columns).
 * captureType: "1.Text" | "4.RETURN" - which paste modules take a paste (paste/pasteRouter.js) and whether the amount typed in a
 *   cell is shown with thousand separators (Return).
 * maxCols: the widest a paste may make the sheet (the Bank sheet keeps its columns; default: the sheet cap).
 * onNotice(message, level): what a paste says ("Successfully pasted 12 cells ..."), already in the page language; level is
 *   "success" | "error".
 */
export default function CaptureSheet({ sheet, columnEdit = true, captureType = "1.Text", maxCols = MAX_GRID_COLS, onNotice }) {
  const { t } = useTranslation("capture");
  const { grid, active, editing, hotRows, hotCols, isSelected, actions } = sheet;
  const wrapRef = useRef(null);
  const drag = useRef(null);
  const [menu, setMenu] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const cols = useMemo(() => Array.from({ length: grid.cols }, (_, c) => c), [grid.cols]);
  const rows = useMemo(() => Array.from({ length: grid.rows }, (_, r) => r), [grid.rows]);
  const focusSheet = useCallback(() => wrapRef.current?.focus({ preventScroll: true }), []);
  // The keyboard stays with the sheet after a menu or the Delete dialog closes (Ctrl+Z, arrows...).
  const closeMenu = useCallback(() => {
    setMenu(null);
    focusSheet();
  }, [focusSheet]);

  // End of a drag, wherever the button is released.
  useEffect(() => {
    const up = () => {
      drag.current = null;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // A cell goes into edit mode: it gets the focus with the caret at the end; leaving it hands the focus back to the sheet.
  useEffect(() => {
    if (!editing) return;
    const td = wrapRef.current?.querySelector(`td[data-r="${editing.r}"][data-c="${editing.c}"]`);
    if (td) {
      td.focus({ preventScroll: true });
      caretToEnd(td);
    }
  }, [editing]);

  // The keyboard cell stays in view (under the sticky header / row letters, see scroll-mt / scroll-ml of the cell).
  useEffect(() => {
    if (!active) return;
    wrapRef.current?.querySelector(`td[data-r="${active.r}"][data-c="${active.c}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const finishEdit = () => {
    sheet.stopEdit();
    focusSheet();
  };

  const doPaste = useCallback(
    (clip) => {
      sheet.stopEdit();
      const b = sheet.bounds;
      const start = b ? { row: b.r1, col: b.c1 } : { row: active?.r ?? 0, col: active?.c ?? 0 };
      const notify = (message, level) => onNotice?.(translatePasteNotice(message, t), level === "danger" ? "error" : "success");
      const taken = pasteIntoSheet({ clip, grid: sheet.grid, anchor: start, captureType, maxCols, notify, commit: actions.replaceGrid });
      // No module took it: a plain tab / newline paste.
      if (!taken && clip.text) actions.paste(plainTextMatrix(clip.text), { r: start.row, c: start.col });
    },
    [sheet, active, actions, captureType, maxCols, onNotice, t]
  );

  // ---- mouse ----
  const onMouseDown = (e) => {
    if (e.button === 2) return;
    const th = e.target.closest("th");
    const td = e.target.closest("td");
    const add = e.ctrlKey || e.metaKey;
    if (td) {
      const r = Number(td.dataset.r);
      const c = Number(td.dataset.c);
      // Clicking inside the cell being typed in keeps the native caret / text selection.
      if (editing && editing.r === r && editing.c === c) return;
      e.preventDefault();
      focusSheet();
      if (editing) sheet.stopEdit();
      sheet.selectCell(r, c, { add, extend: e.shiftKey });
      drag.current = add || e.shiftKey ? null : { kind: "cell", from: { r, c } };
    } else if (th) {
      e.preventDefault();
      focusSheet();
      if (th.dataset.corner != null) return sheet.selectAll();
      if (th.dataset.row != null) {
        const r = Number(th.dataset.row);
        sheet.selectRows(r, r, add);
        drag.current = { kind: "row", from: r };
      } else if (th.dataset.col != null) {
        const c = Number(th.dataset.col);
        sheet.selectCols(c, c, add);
        drag.current = { kind: "col", from: c };
      }
    }
  };
  const onMouseOver = (e) => {
    const d = drag.current;
    if (!d) return;
    const td = e.target.closest("td");
    const th = e.target.closest("th");
    if (d.kind === "cell") {
      if (td) sheet.dragTo(d.from, Number(td.dataset.r), Number(td.dataset.c));
    } else if (d.kind === "row") {
      const r = td?.dataset.r ?? th?.dataset.row;
      if (r != null) sheet.selectRows(d.from, Number(r));
    } else {
      const c = td?.dataset.c ?? th?.dataset.col;
      if (c != null) sheet.selectCols(d.from, Number(c));
    }
  };
  const onDoubleClick = (e) => {
    const td = e.target.closest("td");
    if (td) sheet.startEdit(Number(td.dataset.r), Number(td.dataset.c));
  };

  // ---- menus ----
  const cellMenu = [
    { label: t("menu.copy"), icon: Copy, onSelect: () => writeClipboardText(actions.copyText()) },
    { label: t("menu.paste"), icon: ClipboardPaste, onSelect: () => readClipboard().then((clip) => clip && doPaste(clip)) },
    { label: t("menu.clear"), icon: Eraser, onSelect: sheet.clearSelected },
    { label: t("menu.delete"), icon: Trash2, danger: true, onSelect: () => setDeleteOpen(true) },
    { separator: true },
    { label: t("menu.selectAll"), icon: SquareDashedMousePointer, onSelect: sheet.selectAll },
  ];
  const rowMenu = (r) => [
    { label: t("menu.insertRowAbove"), icon: ArrowUpToLine, onSelect: () => actions.insertRowAbove(r) },
    { label: t("menu.insertRowBelow"), icon: ArrowDownToLine, onSelect: () => actions.insertRowBelow(r) },
    { label: t("menu.deleteRow"), icon: Trash2, danger: true, onSelect: () => actions.deleteRows() },
    { label: t("menu.clearRow"), icon: Eraser, onSelect: () => actions.clearRows() },
  ];
  const colMenu = (c) => [
    { label: t("menu.insertColLeft"), icon: ArrowLeftToLine, onSelect: () => actions.insertColLeft(c) },
    { label: t("menu.insertColRight"), icon: ArrowRightToLine, onSelect: () => actions.insertColRight(c) },
    { label: t("menu.deleteColumn"), icon: Trash2, danger: true, onSelect: () => actions.deleteCols() },
    { label: t("menu.clearColumn"), icon: Eraser, onSelect: () => actions.clearCols() },
  ];
  const onContextMenu = (e) => {
    e.preventDefault();
    const td = e.target.closest("td");
    const th = e.target.closest("th");
    const at = { x: e.clientX, y: e.clientY };
    if (td) {
      const r = Number(td.dataset.r);
      const c = Number(td.dataset.c);
      if (!isSelected(r, c)) sheet.selectOnly(r, c);
      setMenu({ ...at, items: cellMenu });
    } else if (th?.dataset.row != null) {
      const r = Number(th.dataset.row);
      if (!hotRows.has(r)) sheet.selectRows(r, r);
      setMenu({ ...at, items: rowMenu(r) });
    } else if (th?.dataset.col != null && columnEdit) {
      const c = Number(th.dataset.col);
      if (!hotCols.has(c)) sheet.selectCols(c, c);
      setMenu({ ...at, items: colMenu(c) });
    }
  };
  const confirmDelete = (choice) => {
    if (choice === "left") actions.shiftLeft();
    else if (choice === "up") actions.shiftUp();
    else if (choice === "row") actions.deleteRows();
    else actions.deleteCols();
  };

  // ---- keyboard ----
  const goTo = (r, c) => {
    sheet.selectOnly(r, c);
  };
  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;
    const here = active ?? { r: 0, c: 0 };

    if (editing) {
      const td = e.target.closest?.("td");
      if (mod || !td) return; // Ctrl+Z / A / C / V work on the text of the cell itself
      if (key === "Enter") {
        e.preventDefault();
        finishEdit();
        if (editing.r >= grid.rows - 1) actions.growTo(grid.rows + 1, grid.cols);
        goTo(editing.r + 1, editing.c);
      } else if (key === "Tab") {
        e.preventDefault();
        finishEdit();
        if (e.shiftKey) goTo(editing.r, Math.max(0, editing.c - 1));
        else {
          if (editing.c >= grid.cols - 1) actions.growTo(grid.rows, grid.cols + 1);
          goTo(editing.r, editing.c + 1);
        }
      } else if (key === "Escape") {
        e.preventDefault();
        finishEdit();
      } else if (key === "ArrowUp" || key === "ArrowDown") {
        e.preventDefault();
        finishEdit();
        goTo(Math.min(Math.max(editing.r + (key === "ArrowUp" ? -1 : 1), 0), grid.rows - 1), editing.c);
      } else if ((key === "ArrowLeft" && caretAtEdge(td, false)) || (key === "ArrowRight" && caretAtEdge(td, true))) {
        e.preventDefault();
        finishEdit();
        goTo(editing.r, Math.min(Math.max(editing.c + (key === "ArrowLeft" ? -1 : 1), 0), grid.cols - 1));
      }
      return;
    }

    if (mod) {
      const k = key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        actions.undo();
      } else if (k === "a") {
        e.preventDefault();
        sheet.selectAll();
      } else if (k === "c") {
        e.preventDefault();
        writeClipboardText(actions.copyText());
      }
      return; // Ctrl+V arrives as a paste event
    }
    if (key.startsWith("Arrow")) {
      e.preventDefault();
      sheet.moveActive(key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0, key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0);
    } else if (key === "Delete" || key === "Backspace") {
      e.preventDefault();
      sheet.clearSelected();
    } else if (key === "Escape") {
      sheet.clearSelection();
    } else if (key === "Enter" || key === "F2") {
      e.preventDefault();
      sheet.startEdit(here.r, here.c);
    } else if (key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) goTo(here.r, Math.max(0, here.c - 1));
      else {
        if (here.c >= grid.cols - 1) actions.growTo(grid.rows, grid.cols + 1);
        goTo(here.r, here.c + 1);
      }
    } else if (key.length === 1 && !e.altKey && active) {
      // A letter on a selected cell replaces its content and starts editing.
      e.preventDefault();
      const td = wrapRef.current?.querySelector(`td[data-r="${here.r}"][data-c="${here.c}"]`);
      if (td) {
        // Focus at once (not after the next render) so the letters typed right behind this one land in the cell.
        td.textContent = key.toUpperCase();
        td.focus({ preventScroll: true });
        caretToEnd(td);
      }
      sheet.setValue(here.r, here.c, key.toUpperCase());
      sheet.startEdit(here.r, here.c);
    }
  };

  const onPaste = (e) => {
    e.preventDefault();
    doPaste(clipboardOf(e));
  };

  const onInput = (e) => {
    const td = e.target.closest("td");
    if (!td) return;
    const text = td.textContent.replace(/[\r\n]+/g, " ");
    const upper = text.toUpperCase();
    if (upper !== td.textContent) setTextKeepCaret(td, upper);
    sheet.setValue(Number(td.dataset.r), Number(td.dataset.c), upper);
  };
  const onBlur = (e) => {
    // Leaving the cell being typed in ends the edit; in Return the amount is shown with thousand separators.
    if (editing && e.target.matches?.("td")) {
      if (captureType !== "1.Text") {
        const text = e.target.textContent.trim();
        const shown = text ? formatMoneyDisplay(text) : "";
        if (shown && shown !== text) sheet.setValue(editing.r, editing.c, shown.toUpperCase());
      }
      sheet.stopEdit();
    }
  };

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onMouseDown={onMouseDown}
      onMouseOver={onMouseOver}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onInput={onInput}
      onBlur={onBlur}
      className="min-h-0 flex-1 overflow-auto border-t border-modal-input-line bg-white outline-none [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]"
    >
      <table className="w-full table-auto border-separate border-spacing-0 type-table-cell" style={{ minWidth: 56 + grid.cols * COL_W }}>
        <thead>
          <tr>
            <th data-corner="" title={t("sheet.selectAll")} className={cn(headBase, headBg, "top-0 left-0 z-3 w-14 cursor-pointer")} />
            {cols.map((c) => (
              <th key={c} data-col={c} className={cn(headBase, "top-0 cursor-pointer", hotCols.has(c) ? headHot : headBg)}>
                {c + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r} className="group/row">
              <th data-row={r} className={cn(rowHeadBase, hotRows.has(r) ? "bg-[rgba(170,200,245,0.95)]" : "bg-[rgba(214,230,250,0.85)]")}>
                {rowLetter(r)}
              </th>
              {cols.map((c) => (
                <Cell key={c} r={r} c={c} cell={grid.cells[r][c]} selected={isSelected(r, c)} active={active?.r === r && active?.c === c} editing={editing?.r === r && editing?.c === c} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <GridContextMenu menu={menu} onClose={closeMenu} />
      <GridDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} columns={columnEdit} onConfirm={confirmDelete} onClosed={focusSheet} />
    </div>
  );
}
