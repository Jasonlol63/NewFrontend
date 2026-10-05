import { cn } from "@/lib/utils";

// Small ON / OFF switch (Login blue when on, grey-blue when off), same rounded-square shape as Account's alert pill.
export default function ChargeSwitch({ on, onToggle, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Charge"
      onClick={onToggle}
      disabled={disabled}
      title={disabled ? "Read-only login" : undefined}
      className={cn(
        "relative inline-flex h-[18px] w-10 items-center rounded-[5px] border-none text-[7.5px] font-bold tracking-[0.1px] text-white transition-[filter] enabled:cursor-pointer enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60",
        on
          ? "justify-start bg-[linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0)_50%),linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] pl-1.5 shadow-[0_3px_7px_-3px_rgba(13,96,255,0.6)]"
          : "justify-end bg-[linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0)_50%),linear-gradient(180deg,#b6c4d8,#8497b3)] pr-[5px] shadow-[0_3px_7px_-3px_rgba(100,116,139,0.5)]"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0.5 size-3.5 rounded-[3.5px] bg-[linear-gradient(180deg,#fff_0%,#f1f5f9_100%)]",
          on ? "right-0.5" : "left-0.5"
        )}
      />
      {on ? "ON" : "OFF"}
    </button>
  );
}
