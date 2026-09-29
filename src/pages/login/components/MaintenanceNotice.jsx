import { Wrench } from "lucide-react";

// Design-only maintenance banner shown above the login card. Content is
// hard-coded for now; it will be driven by the maintenance API later.
export default function MaintenanceNotice({ className }) {
  return (
    <div
      className={`flex h-10 w-full items-center gap-[9px] rounded-full bg-notice-gradient py-0 pl-[6px] pr-3 shadow-notice ${className ?? ""}`}
    >
      <span className="flex size-7 flex-none items-center justify-center rounded-full bg-white text-brand-blue shadow-[0_2px_6px_-2px_rgba(20,70,160,0.3)]">
        <Wrench size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium tabular-nums text-brand-navy">
        系统维护 · 今晚 23:00 – 01:00
      </span>
      <span className="flex flex-none items-center gap-[5px] rounded-full bg-white px-2 py-1 text-[10.5px] font-bold leading-none text-notice-warn shadow-[0_1px_3px_rgba(20,70,160,0.12)]">
        <i className="size-1.5 rounded-full bg-notice-warn-dot" />
        即将开始
      </span>
    </div>
  );
}
