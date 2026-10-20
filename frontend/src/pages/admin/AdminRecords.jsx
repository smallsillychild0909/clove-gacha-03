import { useEffect, useState, useMemo } from "react";
import api from "../../api/client";

export default function AdminRecords() {
  const [tab, setTab] = useState("tx");
  const [txs, setTxs] = useState([]);
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    Promise.all([api.adminTransactions(), api.adminDrawRecords()])
      .then(([t, d]) => { setTxs(t); setDraws(d); })
      .finally(() => setLoading(false));
  }, []);

  const inRange = (dateStr) => {
    if (!dateStr) return false;
    const d = String(dateStr).slice(0, 10);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  const filteredTxs = useMemo(
    () => txs.filter((t) => inRange(t.created_at)),
    [txs, startDate, endDate]
  );

  const filteredDraws = useMemo(
    () => draws.filter((r) => inRange(r.created_at)),
    [draws, startDate, endDate]
  );

  const generatePDF = () => {
    const isTx = tab === "tx";
    const data = isTx ? filteredTxs : filteredDraws;
    const title = isTx ? "消費紀錄報表" : "抽卡紀錄報表";
    const rangeText =
      startDate || endDate
        ? `日期範圍：${startDate || "不限"} ~ ${endDate || "不限"}`
        : "日期範圍：全部";

    let tableHtml = "";

    if (isTx) {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>時間</th><th>會員</th><th>類型</th><th>金額</th><th>餘額</th><th>備註</th>
            </tr>
          </thead>
          <tbody>
            ${data
              .map(
                (t) => `
              <tr>
                <td>${t.created_at || ""}</td>
                <td>${t.username || ""}</td>
                <td>${t.type || ""}</td>
                <td>${t.amount > 0 ? "+" : ""}${t.amount}</td>
                <td>${t.balance_after ?? ""}</td>
                <td>${t.note || ""}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>`;
    } else {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>時間</th><th>會員</th><th>卡池</th><th>類型</th><th>消耗點數</th><th>抽中卡片</th>
            </tr>
          </thead>
          <tbody>
            ${data
              .map((r) => {
                const cards = (r.results || []).map((c) => c.name).join("、");
                return `
              <tr>
                <td>${r.created_at || ""}</td>
                <td>${r.username || ""}</td>
                <td>${r.pool_name || ""}</td>
                <td>${r.draw_type === "single" ? "單抽" : "十連"}</td>
                <td>-${r.cost_points} pt</td>
                <td>${cards}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>`;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: "Microsoft JhengHei", "PingFang TC", sans-serif; padding: 20px; color: #222; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
          th { background: #f4f4f4; }
          .empty { color: #888; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">${rangeText}　|　共 ${data.length} 筆　|　產生時間：${new Date().toLocaleString("zh-TW")}</div>
        ${data.length ? tableHtml : '<p class="empty">此日期範圍內無資料</p>'}
      </body>
      </html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("請允許彈出視窗以產生報表");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  if (loading) return <div className="text-center py-20 text-purple-300">載入中...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-purple-300 mb-6">會員紀錄</h1>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("tx")}
          className={`px-4 py-2 rounded-lg ${tab === "tx" ? "bg-purple-600" : "bg-dark-800"}`}
        >
          消費紀錄
        </button>
        <button
          onClick={() => setTab("draw")}
          className={`px-4 py-2 rounded-lg ${tab === "draw" ? "bg-purple-600" : "bg-dark-800"}`}
        >
          抽卡紀錄
        </button>
      </div>

      {/* 日期範圍 + 產生報表 */}
      <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-dark-800/40 rounded-xl border border-purple-900/20">
        <div>
          <label className="block text-xs text-gray-400 mb-1">開始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-dark-900 border border-gray-700 rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">結束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-dark-900 border border-gray-700 rounded px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={() => {
            setStartDate("");
            setEndDate("");
          }}
          className="px-3 py-1.5 text-sm bg-dark-700 hover:bg-dark-600 rounded"
        >
          清除
        </button>
        <button
          onClick={generatePDF}
          className="px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 rounded font-medium"
        >
          產生報表 PDF
        </button>
        <span className="text-xs text-gray-500 ml-auto">
          目前顯示 {tab === "tx" ? filteredTxs.length : filteredDraws.length} 筆
        </span>
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
              {filteredTxs.map((t) => (
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
          {filteredTxs.length === 0 && <p className="text-gray-500 py-8 text-center">此日期範圍內無消費紀錄</p>}
        </div>
      )}

      {tab === "draw" && (
        <div className="space-y-3">
          {filteredDraws.map((r) => (
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
          {filteredDraws.length === 0 && <p className="text-gray-500">此日期範圍內無抽卡紀錄</p>}
        </div>
      )}
    </div>
  );
}
