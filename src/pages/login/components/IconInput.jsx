import { cn } from "@/lib/utils";

export default function IconInput({ icon: Icon, trailing, className, ...props }) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-[14px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#6fa8ea]"
        aria-hidden="true"
      />
      <input
        className={cn(
          "h-[38px] w-full rounded-[13px] border border-[#d9e8fb] bg-gradient-to-b from-white to-[#f7fbff] pl-[38px] pr-[14px] text-[12.5px] text-[#4a6fa5] shadow-[inset_0_1px_2px_rgba(20,70,160,0.06)] outline-none placeholder:text-[#a9c3e6]",
          className
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}
