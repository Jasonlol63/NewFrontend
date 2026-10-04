import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/login/LoginPage.jsx";
import SecondaryPasswordPage from "./pages/login/SecondaryPasswordPage.jsx";
import ResetPasswordPage from "./pages/login/ResetPasswordPage.jsx";
import AuthenticatedLayout from "./layouts/AuthenticatedLayout.jsx";
import DashboardPage from "./pages/dashboard/DashboardPage.jsx";
import AdminPage from "./pages/admin/AdminPage.jsx";
import AccountPage from "./pages/account/AccountPage.jsx";
import ComingSoonPage from "./pages/placeholder/ComingSoonPage.jsx";
import { SUBMENU_PAGES } from "./components/layout/sidebarConfig";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/secondary-password" element={<SecondaryPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<AuthenticatedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/account" element={<AccountPage />} />
          {SUBMENU_PAGES.map(({ path, group, label }) => (
            <Route key={path} path={path} element={<ComingSoonPage group={group} title={label} />} />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
