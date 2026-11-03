import { imgSrc } from "../utils/image";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function Home() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listPools()
      .then(setPools)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
