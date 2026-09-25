import { cn } from "@/lib/utils";

export default function RoleTabs({ options, value, onChange }) {
  return (
    <div className="grid grid-cols-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative isolate cursor-pointer border-none bg-[#dbe7f7] py-[14px] text-sm font-bold transition-[color,transform] duration-[250ms] active:scale-[0.99]",
              active ? "text-white" : "text-[#6f93c9]"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-0 -z-10 bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] shadow-[inset_0_-3px_10px_rgba(255,255,255,0.25)] transition-opacity duration-[250ms] ease-out",
                active ? "opacity-100" : "opacity-0"
              )}
            />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
