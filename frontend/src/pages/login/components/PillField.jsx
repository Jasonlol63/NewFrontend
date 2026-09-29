import { cn } from "@/lib/utils";

export default function PillField({ icon: Icon, trailing, className, center, ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <span className="pointer-events-none absolute left-[18px] top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[#4f8ef0]">
          <Icon size={16} />
        </span>
      )}
      <input
        className={cn(
          "h-[46px] w-full rounded-full border-[1.5px] border-[#bcd9fb] bg-gradient-to-b from-white to-[#f7fbff] text-[12.5px] text-[#35538c] shadow-[inset_0_1px_2px_rgba(20,70,160,0.05)] outline-none transition-[border-color,box-shadow] placeholder:text-[#a9c3e6] focus:border-[#4f8ef0] focus:shadow-[0_0_0_4px_rgba(79,142,240,0.12)]",
          Icon ? "pl-[46px] pr-[18px]" : "px-[18px]",
          trailing && "pr-[46px]",
          center && "text-center text-base font-bold tracking-[8px]",
          className
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}
