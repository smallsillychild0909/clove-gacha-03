import { useEffect, useState } from "react";
import api from "../../api/client";

export default function AdminRecharge() {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState(1000);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.adminUsers().then(setUsers).catch(console.error);
  }, []);

  const doRecharge = async (isTest) => {
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const body = { user_id: Number(userId), amount: Number(amount), note };
      const res = isTest
        ? await api.adminTestRecharge(body)
        : await api.adminRecharge(body);
      setMsg(`成功！使用者新點數：${res.new_points.toLocaleString()} pt`);
      api.adminUsers().then(setUsers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-purple-300 mb-6">儲值管理</h1>

      <div className="bg-dark-800/60 rounded-2xl p-6 border border-purple-900/30 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">選擇會員</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2">
            <option value="">請選擇...</option>
            {users.filter(u => u.role === "member").map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} (目前 {u.points} pt)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">金額（正數儲值、負數扣點）</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">備註</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2" placeholder="選填" />
        </div>

        {msg && <div className="bg-green-900/40 text-green-300 px-3 py-2 rounded text-sm">{msg}</div>}
        {error && <div className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

        <div className="flex gap-3">
          <button onClick={() => doRecharge(false)} disabled={loading || !userId}
            className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition">
            手動儲值 / 扣點
          </button>
          <button onClick={() => doRecharge(true)} disabled={loading || !userId || amount <= 0}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition">
            系統測試儲值
          </button>
        </div>
      </div>
    </div>
  );
}
