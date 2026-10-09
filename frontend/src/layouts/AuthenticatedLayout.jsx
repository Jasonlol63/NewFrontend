import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar.jsx";
import SidebarRail from "@/components/layout/SidebarRail.jsx";
import { menuKeyForPath } from "@/components/layout/sidebarConfig";
import { SessionProvider, useSession } from "@/context/session";
import { clearSession } from "@/hooks/useSavedState";
import { cn } from "@/lib/utils";

export default function AuthenticatedLayout() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

function Shell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, ready } = useSession();
  // Drawer only exists below 1200px, where the icon rail replaces the sidebar.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);
  const onLogout = async () => {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // offline: still leave; the session expires on its own
    }
    clearSession();
    navigate("/login");
  };

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  // A page whose menu key is not true for this user (wrong role or company type) goes back home.
  const menuKey = menuKeyForPath(pathname);
  if (ready && user && menuKey && user.menu?.[menuKey] !== true) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[#eaf3fd] bg-[url('/images/Count-Inside-Bg.webp')] bg-cover bg-center bg-no-repeat bg-fixed">
      <div className="hidden h-full nav:flex">
        <Sidebar onLogout={onLogout} />
      </div>
      <div className="flex h-full nav:hidden">
        <SidebarRail onOpenMenu={() => setDrawerOpen(true)} onLogout={onLogout} />
      </div>

      {/* Pages render full-area modals into #main-overlay (see MainOverlay) so they cover the
          content area but never the sidebar. */}
      <div className="relative min-w-0 flex-1">
        <main className="h-full overflow-y-auto">
          <Outlet />
        </main>
        <div id="main-overlay" />
      </div>

      {/* Drawer: full sidebar floating over the page */}
      <div
        className={cn("fixed inset-0 z-40 nav:hidden", !drawerOpen && "pointer-events-none")}
        inert={!drawerOpen}
      >
        <div
          aria-hidden="true"
          onClick={closeDrawer}
          className={cn(
            "absolute inset-0 bg-[rgba(6,18,37,0.45)] backdrop-blur-[2px] transition-opacity duration-300",
            drawerOpen ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-transform duration-300 ease-out",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar className="w-[236px]" onLogout={onLogout} onNavigate={closeDrawer} />
        </div>
      </div>
    </div>
  );
}
