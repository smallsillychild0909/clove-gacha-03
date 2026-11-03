import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

function getLevelStyle(level) {
  const map = {
    "普通會員": { bg: "from-gray-500 to-gray-600", text: "text-white" },
    "VIP1":     { bg: "from-blue-400 to-cyan-400", text: "text-white" },
    "VIP2":     { bg: "from-cyan-400 to-teal-400", text: "text-black" },
    "VIP3":     { bg: "from-green-400 to-emerald-400", text: "text-black" },
    "VIP4":     { bg: "from-purple-400 to-fuchsia-400", text: "text-white" },
    "VIP5":     { bg: "from-pink-400 to-rose-400", text: "text-white" },
    "VVIP":     { bg: "from-amber-400 to-yellow-400", text: "text-black" },
    "SVIP":     { bg: "from-yellow-300 via-amber-200 to-yellow-400", text: "text-black" },
  };
  return map[level] || map["普通會員"];
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [level, setLevel] = useState("");

  useEffect(() => {
    if (user && user.role === "member") {
      api.myTierInfo()
        .then((info) => setLevel(info?.member_level || ""))
        .catch(() => {});
    } else {
      setLevel("");
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const s = getLevelStyle(level);

  return (
    <nav className="bg-dark-900/90 backdrop-blur border-b border-pink-900/30 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between h-14">
        <Link to="/" className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
          Clove 抽卡
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              {level && level !== "普通會員" && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-bold bg-gradient-to-r ${s.bg} ${s.text}`}>
                  👑 {level}
                </span>
              )}
              <span className="text-pink-300">
                {user.username} · <span className="text-yellow-300 font-semibold">{user.points?.toLocaleString()} pt</span>
              </span>
              <Link to="/recharge" className="hover:text-pink-400 transition">儲值</Link>
              <Link to="/records" className="hover:text-pink-400 transition">功能</Link>
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
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
