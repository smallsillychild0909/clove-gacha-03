import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="bg-dark-900/90 backdrop-blur border-b border-pink-900/30 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between h-14">
        <Link to="/" className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
          Clove 抽卡
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="text-pink-300 hidden sm:inline">
                {user.username} · <span className="text-yellow-300 font-semibold">{user.points?.toLocaleString()} pt</span>
              </span>
              <Link to="/recharge" className="hover:text-pink-400 transition">儲值</Link>
              <Link to="/records" className="hover:text-pink-400 transition">紀錄</Link>
              {user.role === "admin" && (
                <Link to="/admin" className="text-purple-400 hover:text-purple-300 transition">管理控台</Link>
              )}
              <button onClick={handleLogout} className="px-3 py-1 rounded bg-pink-900/50 hover:bg-pink-800 transition">
                登出
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-pink-400 transition">登入</Link>
              <Link to="/register" className="px-3 py-1 rounded bg-pink-600 hover:bg-pink-500 transition">
                註冊
              </Link>
              {/* 已移除「管理員」連結 */}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}