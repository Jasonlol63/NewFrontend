import { cn } from "@/lib/utils";

// Frame shared by the cards of the Settings tab (Maintenance notice, Telegram link).
export const PANEL_CLASS =
  "relative flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-modal-line bg-white/55 shadow-modal-card backdrop-blur-[14px]";

// Thin colour bar along the top edge tells the two modules apart.
const ACCENT = {
  amber: "bg-[linear-gradient(90deg,#ffb347,#f5841f)]",
  blue: "bg-[linear-gradient(90deg,#46b8f5,#1a8fe0)]",
};

const TILE_CLASS = {
  amber: "bg-[linear-gradient(135deg,#ffb347,#f5841f)] shadow-[0_10px_20px_-8px_rgba(245,132,31,0.55),inset_0_2px_4px_rgba(255,255,255,0.35)]",
  blue: "bg-[linear-gradient(135deg,#46b8f5,#1a8fe0)] shadow-[0_10px_20px_-8px_rgba(26,143,224,0.55),inset_0_2px_4px_rgba(255,255,255,0.35)]",
};

export function AccentBar({ accent }) {
  return <span aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-1", ACCENT[accent])} />;
}

/** Icon tile of a card header; `size` is a Tailwind size class. */
export function CardTile({ icon: Icon, accent, className, iconClassName }) {
  return (
    <div className={cn("grid flex-none place-items-center rounded-[11px] text-white", TILE_CLASS[accent], className)}>
      <Icon className={cn("size-[18px]", iconClassName)} strokeWidth={2.2} />
    </div>
  );
}

/**
 * Glass card of the Settings tab: coloured top bar, icon tile + title (+ subtitle, + `right`) on top, an optional
 * footer line at the bottom, and a body that scrolls on its own when the screen is too short.
 */
export default function PanelCard({ icon, accent, title, subtitle, right, footer, className, bodyClassName, children }) {
  return (
    <section className={cn(PANEL_CLASS, "min-h-0", className)}>
      <AccentBar accent={accent} />
      <header className="flex flex-none items-center gap-2.5 px-[clamp(12px,2dvh,18px)] pb-2 pt-[clamp(12px,2.2dvh,18px)]">
        <CardTile icon={icon} accent={accent} className="size-[clamp(32px,4.6dvh,38px)]" />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 break-words text-[clamp(15px,2.2dvh,17px)] font-extrabold leading-tight tracking-[-0.2px] text-brand-navy">{title}</h2>
          {subtitle && <p className="m-0 break-words text-[11.5px] font-medium text-[#6b7fa5]">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-[clamp(8px,1.6dvh,12px)] overflow-y-auto px-[clamp(12px,2dvh,18px)] pb-[clamp(10px,2dvh,16px)] pt-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]",
          bodyClassName
        )}
      >
        {children}
      </div>
      {footer && <footer className="flex-none border-t border-modal-line px-[clamp(12px,2dvh,18px)] pb-[clamp(10px,2dvh,14px)] pt-2.5">{footer}</footer>}
    </section>
  );
}

/** Green "Published" / "Active" dot pill. */
export function StatusPill({ children, className }) {
  return (
    <span className={cn("inline-flex flex-none items-center gap-1.5 rounded-full bg-[#e6f8ee] px-2.5 py-0.5 text-[11px] font-bold text-[#15803d]", className)}>
      <i className="size-1.5 rounded-full bg-[#22c55e]" />
      {children}
    </span>
  );
}
