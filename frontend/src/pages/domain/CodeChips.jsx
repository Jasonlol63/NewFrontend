import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex h-6 flex-none items-center rounded-lg border px-2.5 text-[12px] font-bold tracking-[0.2px] whitespace-nowrap max-[1280px]:px-2 max-[1280px]:text-[11.5px]";

// Groups: soft blue fill. Companies: white with a blue edge. Same hue family, told apart by depth.
const TONE = {
  group: "border-[#9fc3f5] bg-[#cfe3ff] text-[#0f3f9e] shadow-[0_1px_2px_rgba(47,111,239,0.15)]",
  company: "border-[#c7d8f3] bg-white text-brand-navy shadow-[0_1px_2px_rgba(20,60,140,0.08)]",
};

/**
 * The codes of an owner's groups or companies, at most `max` of them; the rest collapse into one "+N"
 * chip (hover shows the hidden codes). No codes at all shows a faint dash.
 */
export default function CodeChips({ codes, max, tone }) {
  if (!codes.length) return <span className="text-[#b6c2d4]">—</span>;
  const shown = codes.slice(0, max);
  const hidden = codes.slice(max);
  return (
    <span className="inline-flex items-center gap-[5px] max-[1280px]:gap-1">
      {shown.map((code) => (
        <span key={code} className={cn(chip, TONE[tone])}>
          {code}
        </span>
      ))}
      {hidden.length > 0 && (
        <span
          title={hidden.join(", ")}
          className={cn(
            chip,
            "cursor-default gap-px border-[#9cc4fb] bg-[linear-gradient(135deg,#e3f0ff_0%,#c4dcff_55%,#aee4fb_100%)] pr-1.5 text-[#1346a8] shadow-[0_2px_5px_-2px_rgba(47,111,239,0.45)] max-[1280px]:pr-1.5"
          )}
        >
          +{hidden.length}
          <ChevronRight className="size-3" strokeWidth={2.6} />
        </span>
      )}
    </span>
  );
}
