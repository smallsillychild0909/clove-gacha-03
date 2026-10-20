import { imgSrc } from "../utils/image";
import { useEffect, useState } from "react";
import api from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// 將時間字串轉成 UTC+8 顯示（YYYY-MM-DD HH:mm:ss）
const formatDateTime = (dateStr) => {
  if (!dateStr) return "";
  let s = String(dateStr).trim();
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    s = s.includes("T") ? s + "Z" : s.replace(" ", "T") + "Z";
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(dateStr);
  const utc8 = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${utc8.getUTCFullYear()}-${pad(utc8.getUTCMonth() + 1)}-${pad(utc8.getUTCDate())} ${pad(utc8.getUTCHours())}:${pad(utc8.getUTCMinutes())}:${pad(utc8.getUTCSeconds())}`;
};

export default function MyRecords() {
  const [draws, setDraws] = useState([]);
  const [txs, setTxs] = useState([]);
  const [shippings, setShippings] = useState([]);
  const [redeemedKeys, setRedeemedKeys] = useState(new Set());
  const [tab, setTab] = useState("draw");
  const [loading, setLoading] = useState(true);
  const [selectedCards, setSelectedCards] = useState([]);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractForm, setExtractForm] = useState({ address: "", recipient: "", phone: "", shippingMethod: "cod" });
  const [submitting, setSubmitting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [d, t, s, keys] = await Promise.all([
        api.myDrawRecords(),
        api.myTransactions(),
        api.myShippings(),
        api.myRedeemedKeys(),
      ]);
      setDraws(d);
      setTxs(t);
      setShippings(s);
      setRedeemedKeys(new Set(keys || []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const toggleCardSelect = (draw, card, idx) => {
    const key = `${draw.id}-${idx}`;
    if (redeemedKeys.has(key)) return;
    setSelectedCards((prev) => {
      const exists = prev.find((s) => s.key === key);
      if (exists) return prev.filter((s) => s.key !== key);
      return [...prev, {
        key,
        card_id: card.card_id,
        name: card.name,
        image_url: card.image_url,
        pool_id: draw.pool_id,
        pool_name: draw.pool_name,
      }];
    });
  };

  const handleRedeemToCoins = async () => {
    if (selectedCards.length === 0) return alert("請先選擇卡片");
    setSubmitting(true);
    try {
      const res = await api.redeemToCoins({ cards: selectedCards });
      alert(`成功兌換，獲得 ${res.added_points} 點`);
      setSelectedCards([]);
      loadAll();
    } catch (e) {
      alert(e.message || "兌換失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExtractSubmit = async () => {
    if (!extractForm.address || !extractForm.recipient || !extractForm.phone) {
      return alert("請填寫完整出貨資訊");
    }
    setSubmitting(true);
    try {
      const res = await api.extractCards({
        cards: selectedCards,
        recipient: extractForm.recipient,
        phone: extractForm.phone,
        address: extractForm.address,
        shipping_method: extractForm.shippingMethod,
      });
      alert(`提卡申請已送出，訂單編號：${res.order_no}`);
      setShowExtractModal(false);
      setSelectedCards([]);
      setExtractForm({ address: "", recipient: "", phone: "", shippingMethod: "cod" });
      loadAll();
    } catch (e) {
      alert(e.message || "送出失敗");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-pink-300">載入中...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-pink-300 mb-6">我的紀錄</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setTab("draw")} className={`px-4 py-2 rounded-lg ${tab === "draw" ? "bg-pink-600" : "bg-dark-800"}`}>抽卡紀錄</button>
        <button onClick={() => setTab("redeem")} className={`px-4 py-2 rounded-lg ${tab === "redeem" ? "bg-pink-600" : "bg-dark-800"}`}>獎品兌換</button>
        <button onClick={() => setTab("tx")} className={`px-4 py-2 rounded-lg ${tab === "tx" ? "bg-pink-600" : "bg-dark-800"}`}>消費紀錄</button>
        <button onClick={() => setTab("shipping")} className={`px-4 py-2 rounded-lg ${tab === "shipping" ? "bg-pink-600" : "bg-dark-800"}`}>出貨資訊</button>
      </div>

      {tab === "draw" && (
        <div className="space-y-4">
          {draws.length === 0 && <p className="text-gray-500">尚無抽卡紀錄</p>}
          {draws.map((r) => (
            <div key={r.id} className="bg-dark-800/60 rounded-xl p-4 border border-pink-900/20">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>{r.pool_name || `獎池 #${r.pool_id}`}</span>
                <span>{formatDateTime(r.created_at)} · {r.draw_type === "single" ? "單抽" : "十連"} · -{r.cost_points} pt</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(r.results || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 bg-dark-900 rounded-lg px-2 py-1 text-sm">
                    {c.image_url && <img src={imgSrc(c.image_url)} alt="" className="w-8 h-8 object-cover rounded" />}
                    <span>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "redeem" && (
        <div>
          <p className="text-gray-400 mb-4">點選卡片後可選擇兌換方式</p>
          <div className="space-y-4 mb-6">
            {draws.map((r) => (
              <div key={r.id} className="bg-dark-800/60 rounded-xl p-4 border border-pink-900/20">
                <div className="text-sm text-gray-400 mb-2">{r.pool_name || `獎池 #${r.pool_id}`} · {formatDateTime(r.created_at)}</div>
                <div className="flex flex-wrap gap-2">
                  {(r.results || []).map((c, i) => {
                    const key = `${r.id}-${i}`;
                    const isSelected = selectedCards.some((s) => s.key === key);
                    const isRedeemed = redeemedKeys.has(key);
                    return (
                      <div key={i}
                        onClick={() => !isRedeemed && toggleCardSelect(r, c, i)}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm border ${
                          isRedeemed
                            ? "bg-gray-800/60 border-gray-700 text-gray-500 opacity-50 cursor-not-allowed"
                            : isSelected
                            ? "bg-pink-900/40 border-pink-500 cursor-pointer"
                            : "bg-dark-900 border-transparent cursor-pointer"
                        }`}>
                        {c.image_url && <img src={imgSrc(c.image_url)} alt="" className={`w-8 h-8 object-cover rounded ${isRedeemed ? "grayscale" : ""}`} />}
                        <span>{c.name}</span>
                        {isRedeemed && <span className="text-gray-500 text-xs">已兌換</span>}
                        {isSelected && !isRedeemed && <span className="text-pink-400">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {selectedCards.length > 0 && (
            <div className="bg-dark-800 rounded-xl p-4 border border-pink-700/40">
              <p className="mb-3">已選 {selectedCards.length} 張卡片</p>
              <div className="flex gap-3">
                <button disabled={submitting} onClick={handleRedeemToCoins} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg disabled:opacity-50">換成抽獎幣</button>
                <button disabled={submitting} onClick={() => setShowExtractModal(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50">提卡真實卡片</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "tx" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="py-2 pr-4">時間 (UTC+8)</th><th className="py-2 pr-4">類型</th><th className="py-2 pr-4">金額</th><th className="py-2 pr-4">餘額</th><th className="py-2">備註</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-b border-gray-900">
                  <td className="py-2 pr-4 text-gray-500">{formatDateTime(t.created_at)}</td>
                  <td className="py-2 pr-4">{t.type}</td>
                  <td className={`py-2 pr-4 font-medium ${t.amount > 0 ? "text-green-400" : "text-red-400"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</td>
                  <td className="py-2 pr-4">{t.balance_after}</td>
                  <td className="py-2 text-gray-400">{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {txs.length === 0 && <p className="text-gray-500 mt-4">尚無消費紀錄</p>}
        </div>
      )}

      {tab === "shipping" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="py-2 pr-4">訂單編號</th><th className="py-2 pr-4">填單日期</th><th className="py-2 pr-4">填單時間</th>
                <th className="py-2 pr-4">獎池名稱</th><th className="py-2 pr-4">獎池物品</th><th className="py-2 pr-4">出貨狀態</th>
                <th className="py-2 pr-4">出貨時間</th>
                <th className="py-2 pr-4">貨運公司</th><th className="py-2">貨運單號</th>
              </tr>
            </thead>
            <tbody>
              {shippings.map((s) => (
                <tr key={s.order_no} className="border-b border-gray-900">
                  <td className="py-2 pr-4">{s.order_no}</td>
                  <td className="py-2 pr-4">{s.fillDate}</td>
                  <td className="py-2 pr-4">{s.fillTime}</td>
                  <td className="py-2 pr-4">{s.pool_name}</td>
                  <td className="py-2 pr-4">{s.items}</td>
                  <td className="py-2 pr-4">{s.status === "received" ? "接收訂單" : s.status === "shipping" ? "出貨中" : "已出貨"}</td>
                  <td className="py-2 pr-4">{s.packaging_note ? formatDateTime(s.packaging_note) : "—"}</td>
                  <td className={`py-2 pr-4 ${s.status !== "shipped" ? "text-gray-600" : ""}`}>{s.status === "shipped" ? (s.company || "—") : "—"}</td>
                  <td className={`py-2 ${s.status !== "shipped" ? "text-gray-600" : ""}`}>{s.status === "shipped" ? (s.tracking || "—") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shippings.length === 0 && <p className="text-gray-500 mt-4">尚無出貨資訊</p>}
        </div>
      )}

      {showExtractModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-2xl p-6 max-w-md w-full border border-pink-800/40">
            <h2 className="text-xl font-bold text-pink-300 mb-4">提卡真實卡片</h2>
            <p className="text-sm text-gray-400 mb-4">已選 {selectedCards.length} 張卡片</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400">收件者</label>
                <input value={extractForm.recipient} onChange={(e) => setExtractForm({ ...extractForm, recipient: e.target.value })} className="w-full mt-1 px-3 py-2 bg-dark-800 rounded-lg border border-gray-700" placeholder="姓名" />
              </div>
              <div>
                <label className="text-sm text-gray-400">連絡電話</label>
                <input value={extractForm.phone} onChange={(e) => setExtractForm({ ...extractForm, phone: e.target.value })} className="w-full mt-1 px-3 py-2 bg-dark-800 rounded-lg border border-gray-700" placeholder="手機號碼" />
              </div>
              <div>
                <label className="text-sm text-gray-400">出貨地址</label>
                <textarea value={extractForm.address} onChange={(e) => setExtractForm({ ...extractForm, address: e.target.value })} className="w-full mt-1 px-3 py-2 bg-dark-800 rounded-lg border border-gray-700" rows={3} placeholder="完整地址" />
              </div>
              <div className="text-xs text-gray-500 bg-dark-800/50 p-3 rounded-lg">運費說明：可選擇貨到付款，或扣除遊戲幣作為運費。</div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowExtractModal(false)} className="flex-1 py-2 bg-gray-700 rounded-lg">取消</button>
              <button disabled={submitting} onClick={handleExtractSubmit} className="flex-1 py-2 bg-pink-600 rounded-lg disabled:opacity-50">送出</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
