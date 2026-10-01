import {
  Home,
  Shield,
  User,
  Users,
  CheckCircle2,
  BarChart2,
  CreditCard,
  FileText,
  Wrench,
} from "lucide-react";

// Shared by the full sidebar and the icon rail. Submenus live only in the
// full sidebar; the rail opens the full sidebar as a drawer for those items.
export const MENU_ITEMS = [
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

export const SIDEBAR_BG_STYLE = {
  // Dominant color of the background image, shown until it has loaded.
  backgroundColor: "#08285f",
  backgroundImage:
    "radial-gradient(120% 90% at 100% 0%, rgba(70,140,255,0.3) 0%, rgba(70,140,255,0) 45%), linear-gradient(160deg, rgba(18,48,100,0.45) 0%, rgba(12,36,82,0.4) 38%, rgba(8,26,61,0.35) 70%, rgba(6,18,37,0.35) 100%), url('/images/count-sidebar-bg.webp')",
  backgroundSize: "cover, cover, cover",
  backgroundPosition: "center, center, bottom",
  backgroundRepeat: "no-repeat, no-repeat, no-repeat",
};

export const ACTIVE_ITEM_CLASS =
  "text-white bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] shadow-[0_8px_18px_-6px_rgba(20,90,220,0.75),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-2px_6px_rgba(0,0,0,0.12)]";

export const IDLE_ITEM_CLASS = "text-[#b7c9ea] hover:bg-white/5 hover:text-[#e6edfb]";

export const DEFAULT_PROFILE = {
  userName: "BOSS",
  userRole: "Owner",
  avatarSrc: "/images/avatar1.webp",
  expiryLabel: "Exp: 3m 15d left",
};
