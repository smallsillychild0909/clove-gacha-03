import { useEffect, useState } from "react";
import api from "../../api/client";

export default function AdminRecords() {
  const [tab, setTab] = useState("tx");
  const [txs, setTxs] = useState([]);
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.adminTransactions(), api.adminDrawRecords()])
      .then(([t, d]) => { setTxs(t); setDraws(d); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-purple-300">載入中...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-purple-300 mb-6">會員紀錄</h1>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("tx")} className={`px-4 py-2 rounded-lg ${tab === "tx" ? "bg-purple-600" : "bg-dark-800"}`}>
          消費紀錄
        </button>
        <button onClick={() => setTab("draw")} className={`px-4 py-2 rounded-lg ${tab === "draw" ? "bg-purple-600" : "bg-dark-800"}`}>
          抽卡紀錄
        </button>
      </div>

      {tab === "tx" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="py-2 pr-3">時間</th>
                <th className="py-2 pr-3">會員</th>
                <th className="py-2 pr-3">類型</th>
                <th className="py-2 pr-3">金額</th>
                <th className="py-2 pr-3">餘額</th>
                <th className="py-2">備註</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-b border-gray-900">
                  <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{t.created_at}</td>
                  <td className="py-2 pr-3">{t.username}</td>
                  <td className="py-2 pr-3">{t.type}</td>
                  <td className={`py-2 pr-3 font-medium ${t.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                    {t.amount > 0 ? "+" : ""}{t.amount}
                  </td>
                  <td className="py-2 pr-3">{t.balance_after}</td>
                  <td className="py-2 text-gray-400">{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "draw" && (
        <div className="space-y-3">
          {draws.map((r) => (
            <div key={r.id} className="bg-dark-800/60 rounded-xl p-4 border border-purple-900/20 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-400 mb-2">
                <span>{r.created_at}</span>
                <span className="text-white">{r.username}</span>
                <span>{r.pool_name}</span>
                <span>{r.draw_type === "single" ? "單抽" : "十連"}</span>
                <span className="text-red-400">-{r.cost_points} pt</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(r.results || []).map((c, i) => (
                  <span key={i} className="bg-dark-900 px-2 py-0.5 rounded text-xs">{c.name}</span>
                ))}
              </div>
            </div>
          ))}
          {draws.length === 0 && <p className="text-gray-500">尚無抽卡紀錄</p>}
        </div>
      )}
    </div>
  );
}
