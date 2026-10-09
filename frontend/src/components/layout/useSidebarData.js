import { useMemo } from "react";
import { useSession } from "@/context/session";
import { buildSidebarMenu } from "./sidebarConfig";
import { formatExpiry, formatRole } from "./sidebarProfile";

// What the sidebar shows for the logged-in user: the visible menu (numbered), name, role, expiry.
export function useSidebarData() {
  const { user, ready } = useSession();
  const items = useMemo(() => buildSidebarMenu(user?.menu), [user]);
  return {
    loading: !ready,
    items,
    userName: user?.name ?? "",
    userRole: formatRole(user?.role),
    expiryLabel: user ? formatExpiry(user.expiration_date) : "",
  };
}
