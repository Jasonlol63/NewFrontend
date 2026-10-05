import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/login/LoginPage.jsx";
import SecondaryPasswordPage from "./pages/login/SecondaryPasswordPage.jsx";
import ResetPasswordPage from "./pages/login/ResetPasswordPage.jsx";
import AuthenticatedLayout from "./layouts/AuthenticatedLayout.jsx";
import DashboardPage from "./pages/dashboard/DashboardPage.jsx";
import AdminPage from "./pages/admin/AdminPage.jsx";
import AccountPage from "./pages/account/AccountPage.jsx";
import CustomerReportPage from "./pages/report/customer/CustomerReportPage.jsx";
import DomainReportPage from "./pages/report/domain/DomainReportPage.jsx";
import DomainPage from "./pages/domain/DomainPage.jsx";
import CaptureMaintenancePage from "./pages/maintenance/capture/CaptureMaintenancePage.jsx";
import TransactionMaintenancePage from "./pages/maintenance/transaction/TransactionMaintenancePage.jsx";
import PaymentMaintenancePage from "./pages/maintenance/payment/PaymentMaintenancePage.jsx";
import FormulaMaintenancePage from "./pages/maintenance/formula/FormulaMaintenancePage.jsx";
import BankProcessMaintenancePage from "./pages/maintenance/bankprocess/BankProcessMaintenancePage.jsx";
import AutoRenewPage from "./pages/auto-renew/AutoRenewPage.jsx";
import ComingSoonPage from "./pages/placeholder/ComingSoonPage.jsx";
import { SUBMENU_PAGES } from "./components/layout/sidebarConfig";

// Submenu pages that have a real page; the rest still show the placeholder.
const BUILT_PAGES = new Set(["/report/customer", "/report/domain", "/maintenance/data-capture", "/maintenance/transaction", "/maintenance/payment", "/maintenance/formula", "/maintenance/bank-process"]);

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
          <Route path="/domain" element={<DomainPage />} />
          <Route path="/announcement" element={<ComingSoonPage group="Home" title="Announcement" />} />
          <Route path="/auto-renew" element={<AutoRenewPage />} />
          <Route path="/admin"element={<AdminPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/report/customer" element={<CustomerReportPage />} />
          <Route path="/report/domain" element={<DomainReportPage />} />
          <Route path="/maintenance/data-capture" element={<CaptureMaintenancePage />} />
          <Route path="/maintenance/transaction" element={<TransactionMaintenancePage />} />
          <Route path="/maintenance/payment" element={<PaymentMaintenancePage />} />
          <Route path="/maintenance/formula" element={<FormulaMaintenancePage />} />
          <Route path="/maintenance/bank-process" element={<BankProcessMaintenancePage />} />
          {SUBMENU_PAGES.filter(({ path }) => !BUILT_PAGES.has(path)).map(({ path, group, label }) => (
            <Route key={path} path={path} element={<ComingSoonPage group={group} title={label} />} />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
