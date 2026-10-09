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
  Globe,
  Megaphone,
  RefreshCw,
} from "lucide-react";

// Shared by the full sidebar and the icon rail. Submenus live only in the
// full sidebar; the rail opens the full sidebar as a drawer for those items.
// `menu` is the key in the backend's `menu` map (SessionUser.buildMenu); an item shows only when
// that key is true. A parent with `children` shows when at least one child does. Numbers are
// assigned from what is visible (see buildSidebarMenu).
export const MENU_ITEMS = [
  { menu: "home", label: "Home", icon: Home, path: "/dashboard" },
  { menu: "domain", label: "Domain", icon: Globe, path: "/domain" },
  { menu: "announcement", label: "Announcement", icon: Megaphone, path: "/announcement" },
  { menu: "autoRenew", label: "Auto Renew", icon: RefreshCw, path: "/auto-renew" },
  { menu: "admin", label: "Admin", icon: Shield, path: "/admin" },
  { menu: "account", label: "Account", icon: User, path: "/account" },
  { menu: "ownership", label: "Ownership", icon: Users, path: "/ownership" },
  { menu: "process", label: "Process", icon: CheckCircle2, path: "/process" },
  { menu: "dataCapture", label: "Data Capture", icon: BarChart2, path: "/data-capture" },
  { menu: "transactionPayment", label: "Transaction Payment", icon: CreditCard, path: "/transaction-payment" },
  {
    key: "report",
    label: "Report",
    icon: FileText,
    children: [
      { label: "Customer", path: "/report/customer", menu: "reportCustomer" },
      { label: "Domain", path: "/report/domain", menu: "reportDomain" },
    ],
  },
  {
    key: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    children: [
      { label: "Data Capture", path: "/maintenance/data-capture", menu: "maintenanceDataCapture" },
      { label: "Transaction", path: "/maintenance/transaction", menu: "maintenanceTransaction" },
      { label: "Payment", path: "/maintenance/payment", menu: "maintenancePayment" },
      { label: "Formula", path: "/maintenance/formula", menu: "maintenanceFormula" },
      { label: "Bank Process", path: "/maintenance/bank-process", menu: "maintenanceBankProcess" },
    ],
  },
];

// The menu the user may see, numbered 1..n. `menu` is user.menu from /auth/current-user; a missing
// key counts as hidden, so an incomplete session never shows more than it should.
export function buildSidebarMenu(menu) {
  if (!menu) return [];
  const visible = [];
  for (const item of MENU_ITEMS) {
    if (item.children) {
      const children = item.children.filter((child) => menu[child.menu] === true);
      if (children.length) visible.push({ ...item, children });
    } else if (menu[item.menu] === true) {
      visible.push(item);
    }
  }
  return visible.map((item, i) => ({ ...item, index: i + 1 }));
}

const ROUTES = MENU_ITEMS.flatMap((item) => (item.children ?? [item]).map(({ path, menu }) => ({ path, menu })));

// The menu key guarding a URL (the page itself or anything below it), or null for unguarded pages.
export function menuKeyForPath(pathname) {
  return ROUTES.find(({ path }) => pathname === path || pathname.startsWith(path + "/"))?.menu ?? null;
}

// Every routable page under the submenus, for the placeholder routes.
export const SUBMENU_PAGES = MENU_ITEMS.flatMap((item) =>
  (item.children ?? []).map((child) => ({ ...child, group: item.label }))
);

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

export const DEFAULT_AVATAR = "/images/avatar1.webp";
