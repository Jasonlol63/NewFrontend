import { cn } from "@/lib/utils";
import DropdownSelect from "@/components/shared/DropdownSelect.jsx";

// 30px controls of the Transaction Payment cards. The `!` marks win over DropdownSelect's own trigger classes.
const SELECT =
  "h-[30px]! w-full! gap-1.5! rounded-lg! border-modal-input-line! bg-white! px-2.5! py-0! text-[13px]! font-normal! text-[#111827]! shadow-[0_1px_3px_rgba(15,23,42,0.05)]! max-[1500px]:text-[12.5px]!";

export const INPUT =
  "h-[30px] w-full min-w-0 rounded-lg border border-modal-input-line bg-white px-3 text-[13.5px] text-[#111827] shadow-[0_1px_3px_rgba(15,23,42,0.05)] outline-none transition-[border-color,box-shadow] placeholder:text-[#9ca3af] focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] read-only:bg-[#f1f5f9] read-only:text-[#475569] disabled:cursor-not-allowed disabled:bg-[rgba(226,232,240,0.55)]";

export const LABEL = "text-[12.5px] font-bold whitespace-nowrap text-[#374151]";

// The popup list is kept short (about six rows) and scrolls; `compact` also drops its 200px minimum width (currency lists).
export function Select({ className, compact = false, ...props }) {
  return <DropdownSelect className={cn(SELECT, className)} listClassName="max-h-[168px]!" panelClassName={compact ? "min-w-[84px]!" : undefined} {...props} />;
}
