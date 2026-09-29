import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/login/LoginPage.jsx";
import SecondaryPasswordPage from "./pages/login/SecondaryPasswordPage.jsx";
import ResetPasswordPage from "./pages/login/ResetPasswordPage.jsx";
import AuthenticatedLayout from "./layouts/AuthenticatedLayout.jsx";
import DashboardPage from "./pages/dashboard/DashboardPage.jsx";

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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
