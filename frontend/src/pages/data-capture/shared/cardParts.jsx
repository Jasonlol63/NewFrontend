import { cn } from "@/lib/utils";

// Frosted-glass card, the same surface as the form modals (not pure white).
export const cardClass = "rounded-xl border border-modal-line bg-modal-card shadow-modal-card backdrop-blur-[14px] backdrop-saturate-[1.2]";

// Blue bar + title; `border` adds the line under it (the Submitted card). `aside` sits at the right end (a count).
export function CardTitle({ children, className, aside }) {
  return (
    <div className={cn("flex items-center gap-2 border-b border-[rgba(47,111,239,0.35)] pb-[9px]", className)}>
      <span className="h-4 w-1 flex-none rounded-sm bg-[linear-gradient(180deg,#3fc4ff,#0a3fc9)]" />
      <h2 className="m-0 min-w-0 truncate type-card-title text-brand-navy">{children}</h2>
      {aside && <div className="ml-auto flex-none">{aside}</div>}
    </div>
  );
}
