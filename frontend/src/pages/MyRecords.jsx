import { imgSrc } from "../utils/image";
import { useEffect, useState } from "react";
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
  const [tierInfo, setTierInfo] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [d, t, s, keys, tier] = await Promise.all([
        api.myDrawRecords(),
        api.myTransactions(),
        api.myShippings(),
        api.myRedeemedKeys(),
        api.myTierInfo().catch(() => null),
      ]);
      setDraws(d);
      setTxs(t);
      setShippings(s);
      setRedeemedKeys(new Set(keys || []));
      setTierInfo(tier);
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
      {tierInfo && (
        <div className="mb-8 mx-auto max-w-lg">
          <div className="relative p-5 rounded-2xl bg-gradient-to-br from-dark-800/90 to-dark-900 border border-white/10 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-400/50 to-transparent" />
            <div className="flex items-center gap-4">
              {(() => {
                const s = getLevelStyle(tierInfo.member_level);
                return (
                  <div className={`flex-shrink-0 w-[72px] h-[72px] rounded-2xl bg-gradient-to-br ${s.bg} ${s.text} flex flex-col items-center justify-center shadow-lg ${s.glow} relative`}>
                    <span className="text-sm">👑</span>
                    <span className="font-extrabold text-base tracking-wide">{tierInfo.member_level}</span>
                    <div className="absolute inset-px rounded-2xl border border-white/20 pointer-events-none" />
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div>
                    <div className="text-[11px] text-gray-500">累計儲值</div>
                    <div className="text-[22px] font-bold text-white tabular-nums leading-tight">{tierInfo.total_recharged?.toLocaleString() || 0}</div>
                  </div>
                  {tierInfo.draw_discount > 0 && (
                    <div className="px-2 py-0.5 rounded-md bg-green-500/15 text-green-400 text-xs font-semibold">
                      {100 - tierInfo.draw_discount} 折
                    </div>
                  )}
                </div>
                {tierInfo.next_tier && (
                  <>
                    <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
                      <span>→ {tierInfo.next_tier.name}</span>
                      <span className="text-pink-300">還差 {tierInfo.next_tier.remaining.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-purple-400 rounded-full"
                        style={{
                          width: `${Math.min(100, ((tierInfo.total_recharged || 0) / tierInfo.next_tier.min_recharge) * 100)}%`
                        }}
                      />
                    </div>
                  </>
                )}
                {!tierInfo.next_tier && (
                  <div className="text-xs text-green-400">已達最高等級</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}{/* 資訊 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3">
                  <div>
                    <div className="text-[10px] text-gray-500">累計儲值</div>
                    <div className="text-xl font-bold text-white tabular-nums">{tierInfo.total_recharged?.toLocaleString() || 0}</div>
                  </div>
                  {tierInfo.draw_discount > 0 && (
                    <div className="px-2 py-0.5 rounded-md bg-green-500/15 text-green-400 text-xs font-medium">
                      {100 - tierInfo.draw_discount} 折
                    </div>
                  )}
                </div>

                {tierInfo.next_tier && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                      <span>→ {tierInfo.next_tier.name}</span>
                      <span className="text-pink-300">還差 {tierInfo.next_tier.remaining.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-purple-400 rounded-full"
                        style={{
                          width: `${Math.min(100, ((tierInfo.total_recharged || 0) / tierInfo.next_tier.min_recharge) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                )}
                {!tierInfo.next_tier && (
                  <div className="mt-2 text-xs text-green-400">已達最高等級</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}<div className="mt-5 flex justify-center divide-x divide-white/10">
                <div className="px-5">
                  <div className="text-[11px] text-gray-500">累計儲值</div>
                  <div className="text-lg font-semibold text-amber-300 tabular-nums">{tierInfo.total_recharged?.toLocaleString() || 0}</div>
                </div>
                {tierInfo.draw_discount > 0 && (
                  <div className="px-5">
                    <div className="text-[11px] text-gray-500">抽卡優惠</div>
                    <div className="text-lg font-semibold text-green-400">{100 - tierInfo.draw_discount} 折</div>
                  </div>
                )}
              </div>
            </div>

            {tierInfo.next_tier && (
              <div className="relative mt-6">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>距離 {tierInfo.next_tier.name}</span>
                  <span className="text-amber-300 font-medium">還差 {tierInfo.next_tier.remaining.toLocaleString()}</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.6)] transition-all duration-700"
                    style={{
                      width: `${Math.min(100, ((tierInfo.total_recharged || 0) / tierInfo.next_tier.min_recharge) * 100)}%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>{tierInfo.total_recharged?.toLocaleString() || 0}</span>
                  <span>{tierInfo.next_tier.min_recharge.toLocaleString()}</span>
                </div>
              </div>
            )}
            {!tierInfo.next_tier && (
              <div className="relative mt-5 text-center">
                <span className="inline-flex items-center gap-1 text-sm text-green-400">
                  <span>✦</span> 已達最高等級
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      <h1 className="text-2xl font-bold text-pink-300 mb-6">我的功能</h1>
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
                <span>{r.created_at} · {r.draw_type === "single" ? "單抽" : "十連"} · -{r.cost_points} pt</span>
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
                <div className="text-sm text-gray-400 mb-2">{r.pool_name || `獎池 #${r.pool_id}`} · {r.created_at}</div>
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
                <th className="py-2 pr-4">時間</th><th className="py-2 pr-4">類型</th><th className="py-2 pr-4">金額</th><th className="py-2 pr-4">餘額</th><th className="py-2">備註</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-b border-gray-900">
                  <td className="py-2 pr-4 text-gray-500">{t.created_at}</td>
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
                  <td className="py-2 pr-4">{s.packaging_note || "—"}</td>
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
