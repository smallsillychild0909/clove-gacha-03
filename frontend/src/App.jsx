import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PoolDetail from "./pages/PoolDetail";
import MyRecords from "./pages/MyRecords";
import Recharge from "./pages/Recharge";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPools from "./pages/admin/AdminPools";
import AdminPoolCards from "./pages/admin/AdminPoolCards";
import AdminRecharge from "./pages/admin/AdminRecharge";
import AdminRecords from "./pages/admin/AdminRecords";
import AdminShipping from "./pages/admin/AdminShipping";
import AdminCardReturn from "./pages/admin/AdminCardReturn";

function Protected({ children, role }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="min-h-screen flex items-center justify-center text-pink-300">載入中...</div>;
    if (!user) return <Navigate to="/login" replace />;
    if (role === "admin" && user.role !== "admin") return <Navigate to="/" replace />;
    return children;
}

export default function App() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950">
            <Navbar />
            <main className="container mx-auto px-4 py-6 max-w-6xl">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/pool/:id" element={<PoolDetail />} />
                    <Route path="/records" element={<Protected><MyRecords /></Protected>} />
                    <Route path="/recharge" element={<Protected><Recharge /></Protected>} />

                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
                    <Route path="/admin/pools" element={<Protected role="admin"><AdminPools /></Protected>} />
                    <Route path="/admin/pools/:id/cards" element={<Protected role="admin"><AdminPoolCards /></Protected>} />
                    <Route path="/admin/recharge" element={<Protected role="admin"><AdminRecharge /></Protected>} />
                    <Route path="/admin/records" element={<Protected role="admin"><AdminRecords /></Protected>} />
                    <Route path="/admin/shipping" element={<Protected role="admin"><AdminShipping /></Protected>} />
                    <Route path="/admin/card-return" element={<Protected role="admin"><AdminCardReturn /></Protected>} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}