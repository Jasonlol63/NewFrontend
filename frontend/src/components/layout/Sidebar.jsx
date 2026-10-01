import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Bell, ChevronRight, Clock, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import PillSwitch from "@/components/shared/PillSwitch.jsx";
import {
  ACTIVE_ITEM_CLASS,
  DEFAULT_PROFILE,
  IDLE_ITEM_CLASS,
  MENU_ITEMS,
  SIDEBAR_BG_STYLE,
} from "./sidebarConfig";

const LANG_OPTIONS = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中" },
];

// Full sidebar. Width follows the viewport (220px on a 1366 laptop, 236px on
// 1920) and spacing tightens on short screens via `short:`. Also rendered as
// the drawer behind the icon rail below 1200px (onNavigate closes it).
export default function Sidebar({
  userName = DEFAULT_PROFILE.userName,
  userRole = DEFAULT_PROFILE.userRole,
  avatarSrc = DEFAULT_PROFILE.avatarSrc,
  expiryLabel = DEFAULT_PROFILE.expiryLabel,
  onLogout,
  onNavigate,
  className,
}) {
  const [lang, setLang] = useState("en");

  return (
    <aside
      className={cn(
        "relative flex h-full w-[clamp(220px,15.5vw,236px)] flex-none flex-col overflow-hidden px-3 pb-[clamp(10px,1.6dvh,14px)] pt-[clamp(12px,1.8dvh,16px)] text-[#eaf1ff]",
        "shadow-[6px_0_24px_-8px_rgba(4,15,40,0.55)]",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_18%)]",
        className
      )}
      style={SIDEBAR_BG_STYLE}
    >
      {/* Brand row: glowing icon + EAZYCOUNT + bell */}
      <div className="z-10 mb-3 flex items-center gap-1.5 short:mb-2.5">
        <div
          className="flex size-[30px] flex-none items-center justify-center rounded-[11px] border border-white/25 p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_10px_-4px_rgba(0,10,40,0.5)] backdrop-blur-[10px]"
          style={{ backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0.04))" }}
        >
          <img src="/images/Logo-2.webp" alt="" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1 truncate text-[13px] font-extrabold tracking-[0.2px] text-white">
          EAZYCOUNT
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px] border border-[rgba(120,170,255,0.4)] bg-[rgba(30,58,120,0.55)] cursor-pointer"
        >
          <Bell size={14} className="stroke-[#cfe0ff]" />
          <span className="absolute -right-[5px] -top-[5px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-extrabold text-white shadow-[0_0_0_2px_#0c2452]">
            3
          </span>
        </button>
      </div>

      <div className="z-10 mx-1 mb-3 h-px bg-[linear-gradient(90deg,transparent_0%,rgba(103,232,249,0.7)_50%,transparent_100%)] shadow-[0_0_8px_1px_rgba(56,189,248,0.5)] short:mb-2.5" />

      {/* Profile card: avatar + name, language switch underneath */}
      <div className="z-10 mb-[clamp(10px,2dvh,16px)] flex flex-col gap-2.5 rounded-2xl border border-[rgba(90,160,255,0.3)] bg-[rgba(23,45,95,0.55)] p-3 short:gap-2 short:px-2.5 short:py-[9px]">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="relative size-11 flex-none rounded-full p-[2px] shadow-[0_0_10px_1px_rgba(56,189,248,0.5)] short:size-9"
            style={{ backgroundImage: "conic-gradient(from 180deg, #38bdf8, #0a3fc9, #38bdf8)" }}
          >
            <img
              src={avatarSrc}
              alt={`${userName} avatar`}
              className="h-full w-full rounded-full border-2 border-[#0c2452] object-cover"
            />
            <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[#12305f] bg-[#31d67a] short:size-2.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-extrabold leading-[1.25] text-white short:text-[13px]">{userName}</div>
            <div className="mt-0.5 text-[11px] font-medium text-[#9db8e8] short:mt-px">{userRole}</div>
          </div>
        </div>
        <div className="self-center">
          <PillSwitch options={LANG_OPTIONS} value={lang} onChange={setLang} itemWidth={59} size="sm" />
        </div>
      </div>

      {/* Menu: only this list scrolls when the screen is too short */}
      <nav className="scrollbar-sidebar z-10 -mr-1.5 flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto pr-1.5 short:gap-0.5">
        {MENU_ITEMS.map(({ index, label, icon: Icon, path, hasSubmenu }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex flex-none items-center gap-2.5 rounded-[11px] px-[11px] py-[9px] text-[13px] font-semibold no-underline cursor-pointer short:py-1.5 short:text-[12.5px]",
                isActive ? ACTIVE_ITEM_CLASS : IDLE_ITEM_CLASS
              )
            }
          >
            <Icon size={16} className="flex-none stroke-current" />
            <span className="min-w-0 truncate">
              {index}. {label}
            </span>
            {hasSubmenu && <ChevronRight size={14} className="ml-auto flex-none opacity-70" />}
          </NavLink>
        ))}
      </nav>

      {/* Footer: stacked normally, one row on short screens */}
      <div className="z-10 mt-3 flex flex-col gap-2 short:mt-2.5 short:flex-row short:items-stretch short:gap-2">
        <div className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[rgba(114,168,255,0.35)] bg-[rgba(79,141,255,0.16)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#bcd3ff] short:flex-1">
          <Clock size={13} className="flex-none stroke-[#bcd3ff]" />
          <span className="truncate">{expiryLabel}</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Logout"
          title="Logout"
          className="flex items-center justify-center gap-2 rounded-[11px] border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] py-2 text-[13px] font-bold text-white shadow-[0_10px_20px_-6px_rgba(20,90,220,0.6),inset_0_-3px_6px_rgba(0,0,0,0.1),inset_0_2px_3px_rgba(255,255,255,0.3)] cursor-pointer short:px-3"
        >
          <LogOut size={15} className="stroke-white" />
          <span className="short:sr-only">Logout</span>
        </button>
      </div>
    </aside>
  );
}
