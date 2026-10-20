import { useEffect, useState } from "react";
import api from "../../api/client";

export default function AdminCardReturn() {
  const [pools, setPools] = useState([]);
  const [selectedPool, setSelectedPool] = useState("");
  const [mode, setMode] = useState("per_card");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.listAllPools().then(setPools).catch(console.error); }, []);

  const load = async () => {
    if (!selectedPool) return;
    setLoading(true);
    try { setItems(await api.adminGetReturnSettings(selectedPool, mode)); }
    catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selectedPool) load(); }, [selectedPool, mode]);

  const save = async () => {
    try {
      await api.adminSaveReturnSettings(selectedPool, {
        mode,
        items: items.map(it => ({
          target_key: String(it.target_key),
          target_name: String(it.name ?? it.prob ?? it.target_key ?? ""),
          return_coins: Number(it.return_coins) || 0,
        })),
      });
      alert("已儲存");
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-purple-300 mb-6">卡片返還設定</h1>
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <label>獎池：</label>
        <select value={selectedPool} onChange={e => setSelectedPool(e.target.value)} className="bg-dark-800 px-3 py-2 rounded">
          <option value="">請選擇</option>
          {pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={load} className="px-4 py-2 bg-purple-600 rounded">重新載入</button>
      </div>
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2"><input type="radio" checked={mode === "per_card"} onChange={() => setMode("per_card")} />每張卡片</label>
        <label className="flex items-center gap-2"><input type="radio" checked={mode === "by_prob"} onChange={() => setMode("by_prob")} />原始概率</label>
      </div>
      {loading && <div className="text-purple-300">載入中...</div>}
      {!loading && items.length > 0 && mode === "per_card" && (
        <table className="w-full text-sm mb-4">
          <thead><tr className="text-left text-gray-400 border-b border-gray-800"><th className="py-2">卡片名稱</th><th className="py-2">原始概率</th><th className="py-2">返還遊戲幣</th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.target_key} className="border-b border-gray-900">
                <td className="py-2">{it.name}</td>
                <td className="py-2">{(it.original_prob * 100).toFixed(2)}%</td>
                <td className="py-2"><input type="number" value={it.return_coins} onChange={e => { const n = [...items]; n[i].return_coins = e.target.value; setItems(n); }} className="bg-dark-800 px-2 py-1 rounded w-24" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && items.length > 0 && mode === "by_prob" && (
        <table className="w-full text-sm mb-4">
          <thead><tr className="text-left text-gray-400 border-b border-gray-800"><th className="py-2">原始概率</th><th className="py-2">返還遊戲幣</th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.target_key} className="border-b border-gray-900">
                <td className="py-2">{(it.prob * 100).toFixed(2)}%</td>
                <td className="py-2"><input type="number" value={it.return_coins} onChange={e => { const n = [...items]; n[i].return_coins = e.target.value; setItems(n); }} className="bg-dark-800 px-2 py-1 rounded w-24" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {items.length > 0 && <button onClick={save} className="px-6 py-2 bg-purple-600 rounded-lg">儲存返還設定</button>}
    </div>
  );
}
