// One labelled row of a filter card ("Group ID:" + its chips), labels share one width.
export default function FilterRow({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[84px] flex-none text-[13px] font-bold text-[#1f2937]">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
