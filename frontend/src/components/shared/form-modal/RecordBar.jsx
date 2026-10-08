import { History, UserPlus } from "lucide-react";
import { formatRecordTime } from "./recordTime.js";

// The small blue tag with who did it (SH, JK).
export function ByTag({ children }) {
  return <span className="flex-none rounded-[5px] bg-[#dbeafe] px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.4px] text-[#1d4ed8]">{children}</span>;
}

/**
 * Edit modals: who last changed the record and who created it, as one slim line for the footer (footerStart of FormModal),
 * so it never takes height from the cards. It wraps onto two lines when the footer is narrow.
 * modified / created: { at, by }.
 */
export default function RecordBar({ modified, created }) {
  const items = [
    { icon: History, label: "Modified", ...modified },
    { icon: UserPlus, label: "Created", ...created },
  ];
  return (
    <div className="mr-auto flex min-w-0 flex-[1_1_320px] flex-wrap items-center gap-x-4 gap-y-1">
      {items.map(({ icon: Icon, label, at, by }) => (
        <span key={label} className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap text-[#475569] tabular-nums">
          <Icon className="size-3.5 text-[#64748b]" strokeWidth={2.2} />
          <b className="text-[11px] font-extrabold tracking-[0.5px] text-brand-navy uppercase">{label}</b>
          {formatRecordTime(at)}
          {by && <ByTag>{by}</ByTag>}
        </span>
      ))}
    </div>
  );
}
