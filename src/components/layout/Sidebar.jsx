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
  Clock,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PillSwitch from "@/components/shared/PillSwitch.jsx";

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

  return (
    <aside
      className={cn(
        "relative flex h-screen w-[220px] min-w-[220px] flex-col overflow-hidden px-3.5 pb-4 pt-[18px] text-[#eaf1ff]",
        "bg-[radial-gradient(120%_90%_at_100%_0%,rgba(70,140,255,0.35)_0%,rgba(70,140,255,0)_45%),linear-gradient(160deg,#123064_0%,#0c2452_38%,#081a3d_70%,#061225_100%)]",
        "shadow-[6px_0_24px_-8px_rgba(4,15,40,0.55)]",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_18%)]"
      )}
    >
      {/* Brand row */}
      <div className="z-10 mb-[22px] flex items-center justify-between">
        <img src="/images/count_whitelogo.png" alt="EazyCount" className="block h-[34px]" />
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full border-none bg-[linear-gradient(145deg,#1f4d94,#0e2a5c)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_3px_8px_rgba(0,0,0,0.35)] cursor-pointer"
        >
          <Bell size={15} className="stroke-[#cfe0ff]" />
          <span className="absolute right-[5px] top-1 h-2 w-2 rounded-full bg-[#ff4d4d] shadow-[0_0_0_2px_#0c2452]" />
        </button>
      </div>

      {/* Profile row */}
      <div className="z-10 mb-4 flex items-center gap-3">
        <img
          src={avatarSrc}
          alt={`${userName} avatar`}
          className="h-[46px] w-[46px] rounded-full border-2 border-[#4f8dff] object-cover shadow-[0_4px_10px_-2px_rgba(20,90,220,0.65),inset_0_0_0_2px_rgba(255,255,255,0.08)]"
        />
        <div>
          <div className="text-[15px] font-extrabold tracking-[0.3px] text-white leading-[1.15]">
            {userName}
          </div>
          <div className="text-[11px] font-medium text-[#8fabd9]">{userRole}</div>
        </div>
      </div>

      {/* Language toggle */}
      <div className="z-10 mb-[22px] flex justify-center">
        <PillSwitch options={LANG_OPTIONS} value={lang} onChange={setLang} itemWidth={70} compact />
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
        <div className="flex items-center justify-center gap-1.5 rounded-full border border-[rgba(114,168,255,0.35)] bg-[rgba(79,141,255,0.16)] px-2.5 py-2 text-[11.5px] font-semibold text-[#bcd3ff]">
          <Clock size={13} className="stroke-[#bcd3ff]" />
          {expiryLabel}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center justify-center gap-2 rounded-full border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] py-[11px] text-[13.5px] font-bold text-white shadow-[0_10px_20px_-6px_rgba(20,90,220,0.6),inset_0_-3px_6px_rgba(0,0,0,0.1),inset_0_2px_3px_rgba(255,255,255,0.3)] cursor-pointer"
        >
          <LogOut size={15} className="stroke-white" />
          Logout
        </button>
      </div>
    </aside>
  );
}
