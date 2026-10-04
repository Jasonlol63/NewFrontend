import { Link, useLocation } from "react-router-dom";
import { Tooltip } from "radix-ui";
import { LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACTIVE_ITEM_CLASS,
  DEFAULT_PROFILE,
  IDLE_ITEM_CLASS,
  MENU_ITEMS,
  SIDEBAR_BG_STYLE,
} from "./sidebarConfig";

const ITEM_CLASS =
  "flex size-10 flex-none items-center justify-center rounded-xl border-none bg-transparent no-underline cursor-pointer short:size-9";

function RailTip({ label, children }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={10}
          className="z-50 rounded-lg bg-[#0c2452] px-2.5 py-1.5 text-xs font-semibold text-white shadow-[0_8px_20px_-6px_rgba(4,15,40,0.6)] animate-in fade-in-0 zoom-in-95"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// Icon-only sidebar used below 1200px. Items with a submenu (and the menu
// button) open the full sidebar as a drawer instead of navigating.
export default function SidebarRail({
  userName = DEFAULT_PROFILE.userName,
  avatarSrc = DEFAULT_PROFILE.avatarSrc,
  onOpenMenu,
  onLogout,
}) {
  const { pathname } = useLocation();

  return (
    <Tooltip.Provider delayDuration={150}>
      <aside
        className="relative flex h-full w-16 flex-none flex-col items-center gap-3 overflow-hidden py-3.5 text-[#eaf1ff] shadow-[6px_0_24px_-8px_rgba(4,15,40,0.55)] short:gap-2 short:py-2.5"
        style={SIDEBAR_BG_STYLE}
      >
        <RailTip label="Menu">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className={cn(ITEM_CLASS, "text-white hover:bg-white/10")}
          >
            <Menu size={22} />
          </button>
        </RailTip>

        <RailTip label={userName}>
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label={`${userName} profile`}
            className="relative size-10 flex-none cursor-pointer rounded-full border-none p-[2px] shadow-[0_0_10px_1px_rgba(56,189,248,0.5)] short:size-9"
            style={{ backgroundImage: "conic-gradient(from 180deg, #38bdf8, #0a3fc9, #38bdf8)" }}
          >
            <img
              src={avatarSrc}
              alt=""
              className="h-full w-full rounded-full border-2 border-[#0c2452] object-cover"
            />
            <span className="absolute bottom-0 right-0 size-[11px] rounded-full border-2 border-[#12305f] bg-[#31d67a]" />
          </button>
        </RailTip>

        <div className="h-px w-8 flex-none bg-[linear-gradient(90deg,transparent_0%,rgba(103,232,249,0.7)_50%,transparent_100%)] shadow-[0_0_8px_1px_rgba(56,189,248,0.5)]" />

        <nav className="scrollbar-sidebar flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden">
          {MENU_ITEMS.map(({ key, label, icon: Icon, path, children }) => {
            const tip = children ? `${label} ›` : label;
            // Resolved here rather than via NavLink: Tooltip's asChild Slot
            // stringifies a function className.
            const isUnder = (p) => pathname === p || pathname.startsWith(`${p}/`);
            const active = children ? children.some((c) => isUnder(c.path)) : isUnder(path);
            if (children) {
              return (
                <RailTip key={key} label={tip}>
                  <button
                    type="button"
                    onClick={onOpenMenu}
                    aria-label={label}
                    className={cn(ITEM_CLASS, active ? ACTIVE_ITEM_CLASS : IDLE_ITEM_CLASS)}
                  >
                    <Icon size={18} className="stroke-current" />
                  </button>
                </RailTip>
              );
            }
            return (
              <RailTip key={path} label={tip}>
                <Link
                  to={path}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(ITEM_CLASS, active ? ACTIVE_ITEM_CLASS : IDLE_ITEM_CLASS)}
                >
                  <Icon size={18} className="stroke-current" />
                </Link>
              </RailTip>
            );
          })}
        </nav>

        <RailTip label="Logout">
          <button
            type="button"
            onClick={onLogout}
            aria-label="Logout"
            className={cn(
              ITEM_CLASS,
              "bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] text-white shadow-[0_10px_20px_-6px_rgba(20,90,220,0.6),inset_0_-3px_6px_rgba(0,0,0,0.1),inset_0_2px_3px_rgba(255,255,255,0.3)]"
            )}
          >
            <LogOut size={17} />
          </button>
        </RailTip>
      </aside>
    </Tooltip.Provider>
  );
}
