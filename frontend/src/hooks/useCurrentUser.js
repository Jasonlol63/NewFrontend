import { useMemo } from "react";
import { useSession } from "@/context/session";

const normRole = (value) => String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "_");

// The logged-in account ({ id, isOwner, role, readOnly }), or null until the session has loaded.
// Owner ids come from the owner table and staff ids from the user table, so compare `id` together
// with `isOwner`.
export function useCurrentUser() {
  const { user } = useSession();
  return useMemo(() => {
    if (!user) return null;
    const isOwner = normRole(user.user_type) === "owner";
    return {
      id: user.user_id,
      isOwner,
      role: isOwner ? "owner" : normRole(user.role),
      readOnly: Number(user.read_only) === 1,
    };
  }, [user]);
}
