import { imgSrc } from "../utils/image";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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


const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function Home() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tierInfo, setTierInfo] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    api.listPools()
      .then(setPools)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user && user.role === "member") {
      api.myTierInfo().then(setTierInfo).catch(() => {});
    }
  }, [user]);

  if (loading) return <div className="text-center py-20 text-pink-300">載入獎池中...</div>;
  if (error) return <div className="text-center py-20 text-red-400">錯誤：{error}</div>;

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          抽獎池
        </h1>
        <p className="text-gray-400">選擇你想挑戰的卡池，試試手氣！</p>
      </div>

      {tierInfo && (
        <div className="max-w-xl mx-auto mb-10 p-8 rounded-3xl bg-gradient-to-br from-yellow-900/80 via-amber-700/60 to-orange-900/70 border-4 border-yellow-300/80 shadow-[0_0_40px_rgba(250,204,21,0.6)] text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent animate-pulse pointer-events-none" />
          <div className="relative">
            <div className="text-sm text-yellow-200 tracking-[0.3em] mb-3 font-semibold">目前會員等級</div>
            {(() => {
              const s = getLevelStyle(tierInfo.member_level);
              return (
                <div className={`inline-flex items-center gap-3 px-8 py-3 rounded-full bg-gradient-to-r ${s.bg} ${s.text} font-black text-4xl shadow-2xl ${s.glow} mb-4 border-2 ${s.border}`}>
                  👑 {tierInfo.member_level}
                </div>
              );
            })()}
            {tierInfo.next_tier ? (
              <>
                <p className="text-lg text-yellow-50 mb-3">
                  再儲值 <span className="text-3xl font-black text-amber-200 drop-shadow">{tierInfo.next_tier.remaining.toLocaleString()}</span> 可升級至{" "}
                  <span className="font-black text-yellow-200">{tierInfo.next_tier.name}</span>
                </p>
                <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-yellow-500/50">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-amber-300 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((tierInfo.total_recharged || 0) / tierInfo.next_tier.min_recharge) * 100)}%`
                    }}
                  />
                </div>
                <p className="text-xs text-yellow-200/80 mt-1">
                  {tierInfo.total_recharged?.toLocaleString() || 0} / {tierInfo.next_tier.min_recharge.toLocaleString()}
                </p>
              </>
            ) : (
              <p className="text-lg text-green-300 font-bold">已達最高等級</p>
            )}
            {tierInfo.draw_discount > 0 && (
              <p className="text-base text-green-300 mt-3 font-semibold">抽卡享 {100 - tierInfo.draw_discount} 折優惠</p>
            )}
          </div>
        </div>
      )}

      {pools.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          目前沒有開放的獎池，請稍後再來或通知管理員新增。
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pools.map((pool) => (
            <Link
              key={pool.id}
              to={`/pool/${pool.id}`}
              className="group bg-dark-800/60 rounded-2xl overflow-hidden border border-pink-900/20 hover:border-pink-500/50 transition-all hover:shadow-lg hover:shadow-pink-900/20"
            >
              <div className="aspect-[4/3] bg-dark-900 relative overflow-hidden">
                {pool.image_url ? (
                  <img
                    src={imgSrc(pool.image_url)}
                    alt={pool.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-4xl">🎴</div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <div className="text-sm text-yellow-300 font-medium">
                    剩餘 {pool.remaining_quantity} / {pool.total_quantity}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h2 className="font-semibold text-lg truncate group-hover:text-pink-300 transition">{pool.name}</h2>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{pool.description || "暫無介紹"}</p>
                <div className="flex justify-between mt-3 text-xs text-gray-500">
                  <span>單抽 {pool.cost_single} pt</span>
                  <span>十連 {pool.cost_ten} pt</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
