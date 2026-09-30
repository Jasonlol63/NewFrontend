import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";

const normRole = (value) => String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "_");

// The logged-in account ({ id, isOwner, role, readOnly }), or null until /auth/current-user answers.
// Owner ids come from the owner table and staff ids from the user table, so compare `id` together
// with `isOwner`.
export function useCurrentUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getJson("/auth/current-user", null, { signal: controller.signal })
      .then(({ data }) => {
        const isOwner = normRole(data?.user_type) === "owner";
        setUser({
          id: data?.user_id,
          isOwner,
          role: isOwner ? "owner" : normRole(data?.role),
          readOnly: Number(data?.read_only) === 1,
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return user;
}
