import { forwardRef } from "react";
import { SHEET_COLS, SHEET_ROWS, rowLetter } from "./dataCaptureRules";

const cols = Array.from({ length: SHEET_COLS }, (_, c) => c + 1);
const rows = Array.from({ length: SHEET_ROWS }, (_, r) => rowLetter(r));

/**
 * Spreadsheet-like paste area: columns 1-20, rows A.., every cell editable text. Cells are uncontrolled
 * (the browser keeps what is typed / pasted); onInput lets the page know something was entered.
 * Remount it with a new `key` to clear it.
 */
const CaptureSheet = forwardRef(function CaptureSheet({ onInput }, ref) {
  return (
    <div className="min-h-0 flex-1 overflow-auto border-t border-modal-input-line [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
      <table ref={ref} onInput={onInput} className="w-full min-w-[1100px] table-fixed border-separate border-spacing-0 text-[12.5px]">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-3 h-[27px] w-14 border-r border-b border-white/25 bg-[linear-gradient(180deg,#60c1fe,#0f61ff)]" />
            {cols.map((c) => (
              <th key={c} className="sticky top-0 z-2 h-[27px] border-r border-b border-white/25 bg-[linear-gradient(180deg,#60c1fe,#0f61ff)] text-center font-bold text-white">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((letter) => (
            <tr key={letter} className="group/row">
              <th className="sticky left-0 z-1 h-[27px] w-14 border-r border-b border-[rgba(130,155,195,0.22)] bg-[rgba(214,230,250,0.85)] text-center font-extrabold text-brand-navy">{letter}</th>
              {cols.map((c) => (
                <td
                  key={c}
                  contentEditable="plaintext-only"
                  suppressContentEditableWarning
                  className="h-[27px] cursor-cell overflow-hidden border-r border-b border-[rgba(130,155,195,0.22)] bg-white/50 px-1.5 text-ellipsis whitespace-nowrap outline-none group-even/row:bg-white/30 hover:bg-white/80 focus:bg-white focus:text-clip focus:outline-2 focus:-outline-offset-2 focus:outline-[#3b82f6]"
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default CaptureSheet;
