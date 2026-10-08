import { cn } from "@/lib/utils";
import { cardClass, CardTitle } from "./cardParts.jsx";

/** Right card of Data Capture: the processes already submitted for the picked date, newest first. Scrolls inside itself. */
export default function SubmittedProcesses({ items }) {
  return (
    <section className={cn(cardClass, "flex min-h-0 flex-col px-4 pt-3 pb-3.5")}>
      <CardTitle>Submitted Processes</CardTitle>
      {items.length === 0 ? (
        <div className="mt-3 grid min-h-[84px] flex-1 place-items-center rounded-[10px] border border-dashed border-modal-input-line bg-white/35 p-2.5 text-center text-[13px] italic text-dash-sub">
          No processes submitted for this date
        </div>
      ) : (
        // The list is absolutely placed so it scrolls inside the card instead of making the top row taller.
        <div className="relative mt-2.5 min-h-[84px] flex-1">
          <ul className="absolute inset-0 m-0 flex list-none flex-col gap-1.5 overflow-y-auto p-0 pr-1 [scrollbar-color:rgba(100,130,180,0.45)_transparent] [scrollbar-width:thin]">
            {items.map((it) => (
              <li
                key={it.id}
                className="relative flex flex-none items-center gap-2.5 rounded-[10px] border border-modal-line bg-white/60 py-[7px] pr-3 pl-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition hover:-translate-y-px hover:bg-white/90 hover:shadow-[0_4px_10px_-6px_rgba(20,51,107,0.35)]"
              >
                <span className="absolute top-[9px] bottom-[9px] left-1.5 w-[3px] rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
                <span className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden whitespace-nowrap">
                  <b className="flex-none text-[13px] font-extrabold text-brand-navy">{it.code}</b>
                  <span className="truncate text-[12px] text-dash-sub">{it.name}</span>
                </span>
                <span className="min-w-[42px] flex-none rounded-full border border-[#bfd8ff] bg-[linear-gradient(90deg,#d6ebff,#f0f8ff)] px-2 py-0.5 text-center text-[10.5px] font-extrabold tracking-[0.3px] text-[#1d4ed8]">
                  {it.by}
                </span>
                <span className="flex flex-none flex-col items-end leading-tight tabular-nums">
                  <em className="text-[12px] font-bold not-italic text-[#334155]">{it.time}</em>
                  <small className="text-[10.5px] text-dash-faint">{it.date}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
