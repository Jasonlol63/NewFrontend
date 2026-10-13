import { useRef, useState } from "react";
import { Popover } from "radix-ui";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { Bell, ChevronRight, Clock, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import PillSwitch from "@/components/shared/PillSwitch.jsx";
import {
  ACTIVE_ITEM_CLASS,
  DEFAULT_AVATAR,
  IDLE_ITEM_CLASS,
  SIDEBAR_BG_STYLE,
} from "./sidebarConfig";
import { unreadLabel } from "./notificationRules";
import { useSidebarData } from "./useSidebarData";

const ITEM_CLASS =
  "flex flex-none items-center gap-2 rounded-[11px] px-2 py-[9px] type-body font-semibold! tracking-[-0.01em] no-underline cursor-pointer short:py-1.5 short:text-[13px]";

const LANG_OPTIONS = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中" },
];

// Parent item with a submenu: opens a small panel beside the sidebar (hover or click) instead of expanding inline.
// The panel is portalled so the sidebar's overflow clipping does not cut it off. Which flyout is open is decided by
// the sidebar (one at a time, one shared close timer): pointing at another parent swaps the panel at once, and a
// pending close from the previous one can no longer shut the new one.
function SubmenuFlyout({ index, label, icon: Icon, items, holdsCurrent, pathname, onNavigate, open, onShow, onHideSoon, onClose }) {
  const isUnder = (p) => pathname === p || pathname.startsWith(`${p}/`);

  return (
    <Popover.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onPointerEnter={onShow}
          onPointerLeave={onHideSoon}
          onClick={(e) => {
            e.preventDefault(); // hover already opened it; a click (touch) must not toggle it shut
            onShow();
          }}
          className={cn(ITEM_CLASS, "w-full border-none bg-transparent text-left", open || holdsCurrent ? "bg-white/10 text-white" : IDLE_ITEM_CLASS)}
        >
          <Icon size={16} className="flex-none stroke-current" />
          <span className="min-w-0 truncate">
            {index}. {label}
          </span>
          <ChevronRight size={14} className="ml-auto flex-none opacity-70" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={8}
          onPointerEnter={onShow}
          onPointerLeave={onHideSoon}
          onOpenAutoFocus={(e) => e.preventDefault()}
          // Panels open and close by hover. When one closes Radix hands focus back to its trigger; the panel that is
          // opening would read that as focus leaving it and shut itself, so neither focus move is allowed to act.
          onCloseAutoFocus={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          className="z-[100] flex min-w-[200px] flex-col gap-[3px] rounded-xl border border-[rgba(114,168,255,0.35)] p-1.5 shadow-[0_14px_30px_-8px_rgba(4,15,40,0.7)] outline-none animate-in fade-in-0 slide-in-from-left-1"
          style={{ backgroundImage: "linear-gradient(160deg, #0f4a9a 0%, #0a3a80 100%)" }}
        >
          {items.map((child, i) => (
            <NavLink
              key={child.path}
              to={child.path}
              onClick={() => {
                onClose();
                onNavigate?.();
              }}
              className={cn(ITEM_CLASS, "justify-between", isUnder(child.path) ? ACTIVE_ITEM_CLASS : IDLE_ITEM_CLASS)}
            >
              <span className="min-w-0 truncate">
                {index}.{i + 1} {child.label}
              </span>
              <ChevronRight size={14} className="flex-none opacity-70" />
            </NavLink>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// Full sidebar. Width follows the viewport (220px on a 1366 laptop, 236px on
// 1920) and spacing tightens on short screens via `short:`. Also rendered as
// the drawer behind the icon rail below 1200px (onNavigate closes it). The bell opens the notification panel
// (onOpenNotifications) and shows how many announcements are unread.
// badges: { [menu key]: number } shown as a red count at the end of that menu item (Auto Renew: requests waiting).
export default function Sidebar({ avatarSrc = DEFAULT_AVATAR, onLogout, onNavigate, onOpenNotifications, unreadCount = 0, badges, className }) {
  const { loading, items, userName, userRole, expiryLabel } = useSidebarData();
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  // The submenu panel that is open (at most one) and the single timer that closes it.
  const [openKey, setOpenKey] = useState(null);
  const closeTimer = useRef(null);
  const showFlyout = (key) => {
    clearTimeout(closeTimer.current);
    setOpenKey(key);
  };
  const hideFlyoutSoon = (key) => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenKey((cur) => (cur === key ? null : cur)), 120);
  };
  const closeFlyout = (key) => setOpenKey((cur) => (cur === key ? null : cur));

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
          className="logo-ring flex size-[38px] flex-none items-center justify-center rounded-[14px] border border-white/25 p-[5px] short:size-8 short:rounded-xl short:p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_10px_-4px_rgba(0,10,40,0.5)] backdrop-blur-[10px]"
          style={{ backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0.04))" }}
        >
          <img src="/images/Logo-2.webp" alt="" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1 truncate type-card-title tracking-[0.2px] text-white">
          EAZYCOUNT
        </div>
        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label={unreadCount > 0 ? t("sidebar:notificationsUnread", { count: unreadCount }) : t("sidebar:notifications")}
          className="relative flex size-8 flex-none items-center short:size-7 justify-center rounded-[10px] border border-[rgba(120,170,255,0.4)] bg-[rgba(30,58,120,0.55)] cursor-pointer"
        >
          <Bell size={14} className="stroke-[#cfe0ff]" />
          {unreadCount > 0 && (
            <span className="absolute -right-[5px] -top-[5px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-extrabold text-white shadow-[0_0_0_2px_#0c2452]">
              {unreadLabel(unreadCount)}
            </span>
          )}
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
              alt={t("sidebar:avatarOf", { name: userName })}
              className="h-full w-full rounded-full border-2 border-[#0c2452] object-cover"
            />
            <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[#12305f] bg-[#31d67a] short:size-2.5" />
          </div>
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="flex animate-pulse flex-col gap-1.5">
                <div className="h-3.5 w-24 rounded bg-white/20" />
                <div className="h-2.5 w-16 rounded bg-white/15" />
              </div>
            ) : (
              <>
                <div className="truncate type-label leading-[1.25] text-white short:text-[13px]">{userName}</div>
                <div className="mt-0.5 truncate type-caption font-medium! text-[#9db8e8] short:mt-px">{userRole}</div>
              </>
            )}
          </div>
        </div>
        <div className="self-center">
          <PillSwitch options={LANG_OPTIONS} value={i18n.resolvedLanguage} onChange={(lng) => i18n.changeLanguage(lng)} itemWidth={59} size="sm" />
        </div>
      </div>

      {/* Menu: only this list scrolls when the screen is too short */}
      <nav className="scrollbar-sidebar z-10 -mr-1.5 flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto pr-1.5 short:gap-0.5">
        {loading && (
          <div className="flex animate-pulse flex-col gap-[3px]">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-[38px] flex-none rounded-[11px] bg-white/10 short:h-8" />
            ))}
          </div>
        )}
        {items.map(({ index, key, menu, label, icon: Icon, path, children }) => {
          if (!children) {
            return (
              <NavLink
                key={path}
                to={path}
                onClick={onNavigate}
                className={({ isActive }) => cn(ITEM_CLASS, isActive ? ACTIVE_ITEM_CLASS : IDLE_ITEM_CLASS)}
              >
                <Icon size={16} className="flex-none stroke-current" />
                <span className="min-w-0 truncate">
                  {index}. {label}
                </span>
                {badges?.[menu] > 0 && (
                  <span className="ml-auto flex h-[17px] min-w-[17px] flex-none items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[10px] font-extrabold text-white shadow-[0_0_0_2px_rgba(12,36,82,0.6)]">
                    {unreadLabel(badges[menu])}
                  </span>
                )}
              </NavLink>
            );
          }

          // The parent stays highlighted when the current page is one of its children.
          const holdsCurrent = children.some((c) => pathname === c.path || pathname.startsWith(`${c.path}/`));
          return (
            <SubmenuFlyout
              key={key}
              index={index}
              label={label}
              icon={Icon}
              items={children}
              holdsCurrent={holdsCurrent}
              pathname={pathname}
              onNavigate={onNavigate}
              open={openKey === key}
              onShow={() => showFlyout(key)}
              onHideSoon={() => hideFlyoutSoon(key)}
              onClose={() => closeFlyout(key)}
            />
          );
        })}
      </nav>

      {/* Footer: stacked normally, one row on short screens */}
      <div className="z-10 mt-3 flex flex-col gap-2 short:mt-2.5 short:flex-row short:items-stretch short:gap-2">
        <div className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[rgba(114,168,255,0.35)] bg-[rgba(79,141,255,0.16)] px-2.5 py-1.5 type-caption font-semibold! text-[#bcd3ff] short:flex-1">
          <Clock size={13} className="flex-none stroke-[#bcd3ff]" />
          <span className="truncate">{loading ? "…" : expiryLabel}</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label={t("logout")}
          title={t("logout")}
          className="flex items-center justify-center gap-2 rounded-[11px] border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] py-2 type-body font-semibold! text-white shadow-[0_10px_20px_-6px_rgba(20,90,220,0.6),inset_0_-3px_6px_rgba(0,0,0,0.1),inset_0_2px_3px_rgba(255,255,255,0.3)] cursor-pointer short:px-3"
        >
          <LogOut size={15} className="stroke-white" />
          <span className="short:sr-only">{t("logout")}</span>
        </button>
      </div>
    </aside>
  );
}
