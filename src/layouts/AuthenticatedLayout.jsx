import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar.jsx";

export default function AuthenticatedLayout() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-[#eaf3fd] bg-[url('/images/Count-Inside-Bg.png')] bg-cover bg-center bg-no-repeat bg-fixed">
      <Sidebar onLogout={() => navigate("/login")} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
