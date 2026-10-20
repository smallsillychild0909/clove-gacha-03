import { useEffect, useState } from "react";
import api from "../../api/client";

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

const formatTimeOnly = (dateStr) => {
  const full = formatDateTime(dateStr);
  return full ? full.slice(11, 16) : "";
};

export default function AdminShipping() {
  const [tab, setTab] = useState("today");
  const [todayOrders, setTodayOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState({ status: "received", packaging_note: "", company: "", tracking: "" });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pendingStart, setPendingStart] = useState("");
  const [pendingEnd, setPendingEnd] = useState("");
  const [loading, setLoading] = useState(false);

  const loadToday = async () => {
    setLoading(true);
    try { setTodayOrders(await api.adminShippingsToday()); } catch (e) { alert(e.message); } finally { setLoading(false); }
  };

  const loadPending = async () => {
    setLoading(true);
    try {
      const params = {};
      if (pendingStart) params.start = pendingStart;
      if (pendingEnd) params.end = pendingEnd;
      const data = await api.adminShippings(params);
      setPendingOrders(data.filter(o => o.status !== "shipped"));
    } catch (e) { alert(e.message); } finally { setLoading(false); }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start = startDate;
      if (endDate) params.end = endDate;
      setAllOrders(await api.adminShippings(params));
    } catch (e) { alert(e.message); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === "today") loadToday();
    else if (tab === "pending") loadPending();
    else loadAll();
  }, [tab]);

  const openEdit = (order) => {
    setSelected(order);
    setEditForm({
      status: order.status || "received",
      packaging_note: order.packaging_note || "",
      company: order.company || "",
      tracking: order.tracking || "",
    });
  };

  const save = async () => {
    try {
      await api.adminUpdateShipping(selected.order_no, editForm);
      alert("已更新");
      setSelected(null);
      if (tab === "today") loadToday();
      else if (tab === "pending") loadPending();
      else loadAll();
    } catch (e) { alert(e.message); }
  };

  const exportCSV = (list, filename) => {
    if (!list.length) return alert("沒有資料");
    const headers = ["訂單編號","填單日期","填單時間","獎池名稱","獎池物品","出貨狀態","貨運公司","貨運單號"];
    const rows = list.map(o => {
      const ft = formatDateTime(o.created_at);
      return [o.order_no, ft.slice(0, 10) || o.fillDate, ft.slice(11, 16) || o.fillTime, o.pool_name, o.items, o.status, o.company||"", o.tracking||""];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-purple-300 mb-6">出貨管理</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setTab("today")} className={`px-4 py-2 rounded-lg ${tab === "today" ? "bg-purple-600" : "bg-dark-800"}`}>今日出貨</button>
        <button onClick={() => setTab("pending")} className={`px-4 py-2 rounded-lg ${tab === "pending" ? "bg-purple-600" : "bg-dark-800"}`}>未出貨訂單</button>
        <button onClick={() => setTab("all")} className={`px-4 py-2 rounded-lg ${tab === "all" ? "bg-purple-600" : "bg-dark-800"}`}>出貨資訊總覽</button>
      </div>

      {loading && <div className="text-purple-300">載入中...</div>}

      {/* 今日出貨 */}
      {tab === "today" && !loading && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="py-2">訂單編號</th>
              <th className="py-2">會員</th>
              <th className="py-2">時間</th>
              <th className="py-2">獎池</th>
              <th className="py-2">狀態</th>
              <th className="py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {todayOrders.map(o => (
              <tr key={o.order_no} className="border-b border-gray-900 hover:bg-dark-800/40 cursor-pointer" onClick={() => openEdit(o)}>
                <td className="py-2">{o.order_no}</td>
                <td className="py-2">{o.username}</td>
                <td className="py-2">{formatTimeOnly(o.created_at)}</td>
                <td className="py-2">{o.pool_name}</td>
                <td className="py-2">{o.status}</td>
                <td className="py-2 text-purple-400">編輯</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 未出貨訂單（新頁） */}
      {tab === "pending" && !loading && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <label className="text-sm text-gray-400">日期區間：</label>
            <input type="date" value={pendingStart} onChange={e => setPendingStart(e.target.value)} className="bg-dark-800 px-2 py-1 rounded" />
            <span>至</span>
            <input type="date" value={pendingEnd} onChange={e => setPendingEnd(e.target.value)} className="bg-dark-800 px-2 py-1 rounded" />
            <button onClick={loadPending} className="px-3 py-1 bg-purple-600 rounded text-sm">查詢</button>
            <button onClick={() => exportCSV(pendingOrders, `未出貨_${new Date().toISOString().slice(0,10)}.csv`)} className="px-3 py-1 bg-green-700 rounded text-sm">匯出 CSV</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="py-2 pr-3">訂單編號</th>
                <th className="py-2 pr-3">填單日期</th>
                <th className="py-2 pr-3">填單時間</th>
                <th className="py-2 pr-3">會員</th>
                <th className="py-2 pr-3">獎池</th>
                <th className="py-2 pr-3">物品</th>
                <th className="py-2 pr-3">狀態</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map(o => (
                <tr key={o.order_no} className="border-b border-gray-900 hover:bg-dark-800/40 cursor-pointer" onClick={() => openEdit(o)}>
                  <td className="py-2 pr-3">{o.order_no}</td>
                  <td className="py-2 pr-3">{formatDateTime(o.created_at).slice(0, 10) || o.fillDate}</td>
                  <td className="py-2 pr-3">{formatDateTime(o.created_at).slice(11, 16) || o.fillTime}</td>
                  <td className="py-2 pr-3">{o.username}</td>
                  <td className="py-2 pr-3">{o.pool_name}</td>
                  <td className="py-2 pr-3">{o.items}</td>
                  <td className="py-2 pr-3">{o.status === "received" ? "接收訂單" : "出貨中"}</td>
                  <td className="py-2 text-purple-400">編輯</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pendingOrders.length === 0 && <p className="text-gray-500 mt-4">此區間無未出貨訂單</p>}
        </div>
      )}

      {/* 出貨資訊總覽 */}
      {tab === "all" && !loading && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <label className="text-sm text-gray-400">日期區間：</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-dark-800 px-2 py-1 rounded" />
            <span>至</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-dark-800 px-2 py-1 rounded" />
            <button onClick={loadAll} className="px-3 py-1 bg-purple-600 rounded text-sm">查詢</button>
            <button onClick={() => exportCSV(allOrders, `出貨報表_${new Date().toISOString().slice(0,10)}.csv`)} className="px-3 py-1 bg-green-700 rounded text-sm">匯出 CSV</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="py-2 pr-3">訂單編號</th>
                <th className="py-2 pr-3">填單日期</th>
                <th className="py-2 pr-3">填單時間</th>
                <th className="py-2 pr-3">獎池名稱</th>
                <th className="py-2 pr-3">獎池物品</th>
                <th className="py-2 pr-3">出貨狀態</th>
                <th className="py-2 pr-3">貨運公司</th>
                <th className="py-2">貨運單號</th>
              </tr>
            </thead>
            <tbody>
              {allOrders.map(o => (
                <tr key={o.order_no} className="border-b border-gray-900">
                  <td className="py-2 pr-3">{o.order_no}</td>
                  <td className="py-2 pr-3">{formatDateTime(o.created_at).slice(0, 10) || o.fillDate}</td>
                  <td className="py-2 pr-3">{formatDateTime(o.created_at).slice(11, 16) || o.fillTime}</td>
                  <td className="py-2 pr-3">{o.pool_name}</td>
                  <td className="py-2 pr-3">{o.items}</td>
                  <td className="py-2 pr-3">{o.status}</td>
                  <td className={`py-2 pr-3 ${o.status !== "shipped" ? "text-gray-600" : ""}`}>{o.company || "—"}</td>
                  <td className={`py-2 ${o.status !== "shipped" ? "text-gray-600" : ""}`}>{o.tracking || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {allOrders.length === 0 && <p className="text-gray-500 mt-4">無資料</p>}
        </div>
      )}

      {/* 編輯視窗 */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-2xl p-6 max-w-md w-full border border-purple-800/40">
            <h2 className="text-xl font-bold mb-4">編輯出貨 - {selected.order_no}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400">出貨狀態</label>
                <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full mt-1 bg-dark-800 px-3 py-2 rounded">
                  <option value="received">接收訂單</option>
                  <option value="shipping">出貨中</option>
                  <option value="shipped">已出貨</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400">包裝時程</label>
                <input
                  type="date"
                  value={(editForm.packaging_note || "").slice(0, 10)}
                  onChange={e => {
                    const date = e.target.value;
                    if (!date) {
                      setEditForm({ ...editForm, packaging_note: "" });
                      return;
                    }
                    const now = new Date();
                    const hh = String(now.getHours()).padStart(2, "0");
                    const mm = String(now.getMinutes()).padStart(2, "0");
                    setEditForm({ ...editForm, packaging_note: `${date} ${hh}:${mm}` });
                  }}
                  className="w-full mt-1 bg-dark-800 px-3 py-2 rounded"
                />
                {editForm.packaging_note && (
                  <p className="text-xs text-gray-500 mt-1">將儲存為：{editForm.packaging_note}</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-400">貨運公司</label>
                <input value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})} className="w-full mt-1 bg-dark-800 px-3 py-2 rounded" />
              </div>
              <div>
                <label className="text-sm text-gray-400">貨運單號</label>
                <input value={editForm.tracking} onChange={e => setEditForm({...editForm, tracking: e.target.value})} className="w-full mt-1 bg-dark-800 px-3 py-2 rounded" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setSelected(null)} className="flex-1 py-2 bg-gray-700 rounded-lg">取消</button>
              <button onClick={save} className="flex-1 py-2 bg-purple-600 rounded-lg">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
