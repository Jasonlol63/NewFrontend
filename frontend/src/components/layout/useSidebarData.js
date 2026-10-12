import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/context/session";
import { buildSidebarMenu } from "./sidebarConfig";
import { formatExpiry, formatRole } from "./sidebarProfile";

// What the sidebar shows for the logged-in user: the visible menu (numbered, labels in the current language), name, role, expiry.
export function useSidebarData() {
  const { user, ready } = useSession();
  const { t } = useTranslation();
  const items = useMemo(
    () =>
      buildSidebarMenu(user?.menu).map((item) => ({
        ...item,
        label: t(`sidebar:menu.${item.menu ?? item.key}`, { defaultValue: item.label }),
        children: item.children?.map((child) => ({ ...child, label: t(`sidebar:menu.${child.menu}`, { defaultValue: child.label }) })),
      })),
    [user, t]
  );
  return {
    loading: !ready,
    items,
    userName: user?.name ?? "",
    userRole: formatRole(user?.role, t),
    expiryLabel: user ? formatExpiry(user.expiration_date, t) : "",
  };
}
