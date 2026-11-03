import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

// 依等級回傳顏色樣式
function getLevelStyle(level) {
  const map = {
    "普通會員": { bg: "from-gray-500 to-gray-600", text: "text-white", border: "border-gray-400", glow: "shadow-gray-500/40" },
    "VIP1":     { bg: "from-blue-400 to-cyan-400", text: "text-white", border: "border-blue-200", glow: "shadow-blue-400/60" },
    "VIP2":     { bg: "from-cyan-400 to-teal-400", text: "text-black", border: "border-cyan-200", glow: "shadow-cyan-400/60" },
    "VIP3":     { bg: "from-green-400 to-emerald-400", text: "text-black", border: "border-green-200", glow: "shadow-green-400/60" },
    "VIP4":     { bg: "from-purple-400 to-fuchsia-400", text: "text-white", border: "border-purple-200", glow: "shadow-purple-400/60" },
    "VIP5":     { bg: "from-pink-400 to-rose-400", text: "text-white", border: "border-pink-200", glow: "shadow-pink-400/60" },
    "VVIP":     { bg: "from-amber-400 to-yellow-400", text: "text-black", border: "border-amber-200", glow: "shadow-amber-400/70" },
    "SVIP":     { bg: "from-yellow-300 via-amber-200 to-yellow-400", text: "text-black", border: "border-yellow-100", glow: "shadow-yellow-400/80" },
  };
  return map[level] || map["普通會員"];
}


export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tierInfo, setTierInfo] = useState(null);

  useEffect(() => {
    if (user && user.role === "member") {
      api.myTierInfo().then(setTierInfo).catch(() => {});
    } else {
      setTierInfo(null);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const level = tierInfo?.member_level || user?.member_level || "普通會員";
  const next = tierInfo?.next_tier;

  return (
    <nav className="bg-dark-900/90 backdrop-blur border-b border-pink-900/30 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between h-14">
        <Link to="/" className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
          Clove 抽卡
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <div className="flex flex-col items-end leading-tight">
                <span className="text-pink-300 flex items-center gap-2">
                  {user.username}
                  {(() => {
                    const s = getLevelStyle(level);
                    return (
                      <span className={`inline-flex items-center gap-1 px-3 py-1 text-base rounded-full font-black shadow-xl bg-gradient-to-r ${s.bg} ${s.text} border ${s.border} ${s.glow}`}>
                        {level !== "普通會員" && "👑"} {level}
                      </span>
                    );
                  })()}
                  · <span className="text-yellow-300 font-semibold">{user.points?.toLocaleString()} pt</span>
                </span>
                {next && (
                  <span className="text-xs text-gray-400">
                    再儲值 <span className="text-amber-300">{next.remaining.toLocaleString()}</span> 可達 {next.name}
                  </span>
                )}
                {tierInfo?.draw_discount > 0 && (
                  <span className="text-xs text-green-400">抽卡 {100 - tierInfo.draw_discount} 折</span>
                )}
              </div>
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
