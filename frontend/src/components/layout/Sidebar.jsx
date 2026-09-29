import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Bell,
  Home,
  Shield,
  User,
  Users,
  CheckCircle2,
  BarChart2,
  CreditCard,
  FileText,
  Wrench,
  ChevronRight,
  ChevronDown,
  Clock,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LANG_OPTIONS = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中" },
];

const MENU_ITEMS = [
  { index: 1, label: "Home", icon: Home, path: "/dashboard" },
  { index: 2, label: "Admin", icon: Shield, path: "/admin" },
  { index: 3, label: "Account", icon: User, path: "/account" },
  { index: 4, label: "Ownership", icon: Users, path: "/ownership" },
  { index: 5, label: "Process", icon: CheckCircle2, path: "/process" },
  { index: 6, label: "Data Capture", icon: BarChart2, path: "/data-capture" },
  { index: 7, label: "Transaction Payment", icon: CreditCard, path: "/transaction-payment" },
  { index: 8, label: "Report", icon: FileText, path: "/report", hasSubmenu: true },
  { index: 9, label: "Maintenance", icon: Wrench, path: "/maintenance", hasSubmenu: true },
];

export default function Sidebar({
  userName = "BOSS",
  userRole = "Owner",
  avatarSrc = "/images/avatar1.png",
  expiryLabel = "Exp: 3m 15d left",
  onLogout,
}) {
  const [lang, setLang] = useState("en");
  const activeLang = LANG_OPTIONS.find((opt) => opt.value === lang) ?? LANG_OPTIONS[0];
  const cycleLang = () => {
    const idx = LANG_OPTIONS.findIndex((opt) => opt.value === lang);
    setLang(LANG_OPTIONS[(idx + 1) % LANG_OPTIONS.length].value);
  };

  return (
    <aside
      className={cn(
        "relative flex h-screen w-[260px] min-w-[260px] flex-col overflow-hidden px-3.5 pb-4 pt-[18px] text-[#eaf1ff]",
        "shadow-[6px_0_24px_-8px_rgba(4,15,40,0.55)]",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_18%)]"
      )}
      style={{
        backgroundImage:
          "radial-gradient(120% 90% at 100% 0%, rgba(70,140,255,0.3) 0%, rgba(70,140,255,0) 45%), linear-gradient(160deg, rgba(18,48,100,0.45) 0%, rgba(12,36,82,0.4) 38%, rgba(8,26,61,0.35) 70%, rgba(6,18,37,0.35) 100%), url('/images/count-sidebar-bg-2-crop.png')",
        backgroundSize: "cover, cover, cover",
        backgroundPosition: "center, center, bottom",
        backgroundRepeat: "no-repeat, no-repeat, no-repeat",
      }}
    >
      {/* Brand row: glowing icon + EAZYCOUNT + EN dropdown + bell */}
      <div className="z-10 mb-3.5 flex items-center gap-1.5">
        <div
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[11px] border border-white/25 p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_10px_-4px_rgba(0,10,40,0.5)] backdrop-blur-[10px]"
          style={{ backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0.04))" }}
        >
          <img src="/images/Logo-2.png" alt="" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold tracking-[0.2px] text-white">
          EAZYCOUNT
        </div>
        <button
          type="button"
          onClick={cycleLang}
          className="flex flex-none items-center gap-0.5 rounded-[9px] border border-[rgba(120,170,255,0.4)] bg-[rgba(30,58,120,0.55)] px-1.5 py-[6px] text-[10.5px] font-bold text-white cursor-pointer"
        >
          {activeLang.label}
          <ChevronDown size={10} className="stroke-[#b7c9ea]" />
        </button>
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

      <div className="z-10 mx-1 mb-4 h-px bg-[linear-gradient(90deg,transparent_0%,rgba(103,232,249,0.7)_50%,transparent_100%)] shadow-[0_0_8px_1px_rgba(56,189,248,0.5)]" />

      {/* Profile card */}
      <div className="z-10 mb-[22px] flex items-center gap-3 rounded-2xl border border-[rgba(90,160,255,0.3)] bg-[rgba(23,45,95,0.55)] px-3.5 py-3.5">
        <div
          className="relative h-[50px] w-[50px] flex-none rounded-full p-[2px] shadow-[0_0_10px_1px_rgba(56,189,248,0.5)]"
          style={{ backgroundImage: "conic-gradient(from 180deg, #38bdf8, #0a3fc9, #38bdf8)" }}
        >
          <img
            src={avatarSrc}
            alt={`${userName} avatar`}
            className="h-full w-full rounded-full border-2 border-[#0c2452] object-cover"
          />
          <span className="absolute bottom-0 right-0 h-[13px] w-[13px] rounded-full border-2 border-[#12305f] bg-[#31d67a]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-extrabold leading-[1.25] text-white">{userName}</div>
          <div className="mt-[3px] text-[11.5px] font-medium text-[#9db8e8]">{userRole}</div>
        </div>
        <ChevronRight size={18} className="flex-none stroke-[#7c93c4]" />
      </div>

      {/* Menu */}
      <nav className="z-10 flex flex-1 flex-col gap-1 overflow-y-auto">
        {MENU_ITEMS.map(({ index, label, icon: Icon, path, hasSubmenu }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-[11px] rounded-xl px-3 py-2.5 text-[13.5px] font-semibold no-underline cursor-pointer",
                isActive
                  ? "text-white bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] shadow-[0_8px_18px_-6px_rgba(20,90,220,0.75),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-2px_6px_rgba(0,0,0,0.12)]"
                  : "text-[#b7c9ea] hover:bg-white/5 hover:text-[#e6edfb]"
              )
            }
          >
            <Icon size={17} className="flex-none stroke-current" />
            {index}. {label}
            {hasSubmenu && <ChevronRight size={14} className="ml-auto opacity-70" />}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="z-10 mt-3.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(114,168,255,0.35)] bg-[rgba(79,141,255,0.16)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#bcd3ff]">
          <Clock size={13} className="stroke-[#bcd3ff]" />
          {expiryLabel}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center justify-center gap-2 rounded-xl border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] py-2 text-[13.5px] font-bold text-white shadow-[0_10px_20px_-6px_rgba(20,90,220,0.6),inset_0_-3px_6px_rgba(0,0,0,0.1),inset_0_2px_3px_rgba(255,255,255,0.3)] cursor-pointer"
        >
          <LogOut size={15} className="stroke-white" />
          Logout
        </button>
      </div>
    </aside>
  );
}
