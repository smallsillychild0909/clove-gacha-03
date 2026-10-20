import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export default function Recharge() {
  const { user, refreshUser } = useAuth();
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const presets = [500, 1000, 3000, 5000, 10000];

  const handleRecharge = async () => {
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const res = await api.recharge({ amount: Number(amount), note: "會員自行儲值" });
      setMsg(`儲值成功！目前點數：${res.new_points.toLocaleString()} pt`);
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-pink-300 mb-2 text-center">儲值遊戲幣</h1>
      <p className="text-center text-gray-400 mb-6">目前點數：<span className="text-yellow-300 font-semibold">{user?.points?.toLocaleString()} pt</span></p>

      <div className="bg-dark-800/60 rounded-2xl p-6 border border-pink-900/30 space-y-4">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p} onClick={() => setAmount(p)}
              className={`px-3 py-1.5 rounded-lg text-sm ${amount === p ? "bg-pink-600" : "bg-dark-900 hover:bg-dark-800"}`}>
              {p.toLocaleString()}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">自訂金額</label>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500" />
        </div>
        {msg && <div className="bg-green-900/40 text-green-300 px-3 py-2 rounded text-sm">{msg}</div>}
        {error && <div className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm">{error}</div>}
        <button onClick={handleRecharge} disabled={loading || amount < 1}
          className="w-full py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 font-medium transition">
          {loading ? "處理中..." : `儲值 ${Number(amount).toLocaleString()} pt`}
        </button>
        <p className="text-xs text-gray-500 text-center">此為模擬儲值，正式環境需串接金流</p>
      </div>
    </div>
  );
}
