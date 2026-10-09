import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { postForm } from "@/lib/api";
import { clearSession, loadSessionUser } from "@/hooks/useSavedState";

// The logged-in session from /auth/current-user. It always describes the company you are in right
// now: `user.menu` is the backend's sidebar visibility for this role in this company, and
// switching company rebuilds it (switchCompany), so the sidebar follows the company.
const SessionContext = createContext({ user: null, ready: false, switchCompany: async () => {} });

export function SessionProvider({ children }) {
  const [state, setState] = useState({ user: null, ready: false });

  useEffect(() => {
    let cancelled = false;
    loadSessionUser().then((user) => {
      if (!cancelled) setState({ user, ready: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Switch the session to another company, then reload it so the sidebar and page guard follow.
  const switchCompany = useCallback(async (tenantId) => {
    await postForm("/auth/switch-tenant", { tenant_id: tenantId });
    clearSession();
    setState({ user: await loadSessionUser(), ready: true });
  }, []);

  const value = useMemo(() => ({ ...state, switchCompany }), [state, switchCompany]);

  // No session, or one saved before `menu` existed (no `home` key): log in again.
  if (state.ready && !(state.user?.menu && "home" in state.user.menu)) {
    return <Navigate to="/login" replace />;
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
