import { useEffect, useState, useMemo, useRef } from "react";
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

export default function AdminMembers() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // 詳情彈窗
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [detailTxs, setDetailTxs] = useState([]);
  const [detailDraws, setDetailDraws] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // 密碼變更紀錄
  const [passwordLogs, setPasswordLogs] = useState([]);

  // 重設密碼彈窗
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // 點數調整彈窗
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustUser, setAdjustUser] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustMsg, setAdjustMsg] = useState("");
  const [adjustError, setAdjustError] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  const members = useMemo(
    () => users.filter((u) => u.role === "member"),
    [users]
  );

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.trim().toLowerCase();
    return members.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  const loadUsers = async () => {
    try {
      const data = await api.adminUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openDetail = async (user) => {
    setDetailUser(user);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailTxs([]);
    setDetailDraws([]);
    setPasswordLogs([]);
    try {
      const [txs, draws, logs] = await Promise.all([
        api.adminTransactions(user.id),
        api.adminDrawRecords(user.id),
        api.adminPasswordLogs(user.id),
      ]);
      setDetailTxs(txs || []);
      setDetailDraws(draws || []);
      setPasswordLogs(logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const openAdjust = (user) => {
    setAdjustUser(user);
    setAdjustAmount(0);
    setAdjustNote("");
    setAdjustMsg("");
    setAdjustError("");
    setAdjustOpen(true);
  };

  const toggleActive = async (user) => {
    if (!confirm(`確定要${user.is_active ? "停用" : "啟用"}帳號 ${user.username} 嗎？`)) return;
    try {
      await api.adminToggleActive(user.id);
      await loadUsers();
    } catch (e) {
      alert(e.message || "操作失敗");
    }
  };

  const openReset = (user) => {
    setResetUser(user);
    setResetPwd("");
    setResetMsg("");
    setResetError("");
    setResetOpen(true);
  };

  const doReset = async () => {
    if (!resetUser || resetPwd.length < 6) {
      setResetError("新密碼至少 6 個字元");
      return;
    }
    setResetLoading(true);
    setResetMsg("");
    setResetError("");
    try {
      const res = await api.adminResetPassword(resetUser.id, { new_password: resetPwd });
      setResetMsg(res.message || "已重設密碼");
      await loadUsers();
    } catch (e) {
      setResetError(e.message || "重設失敗");
    } finally {
      setResetLoading(false);
    }
  };

  const doAdjust = async () => {
    if (!adjustUser) return;
    setAdjustLoading(true);
    setAdjustMsg("");
    setAdjustError("");
    try {
      const res = await api.adminRecharge({
        user_id: adjustUser.id,
        amount: Number(adjustAmount),
        note: adjustNote,
      });
      setAdjustMsg(`成功！新點數：${res.new_points.toLocaleString()} pt`);
      await loadUsers();
      // 若詳情開著，也更新顯示的點數
      if (detailUser && detailUser.id === adjustUser.id) {
        setDetailUser({ ...detailUser, points: res.new_points });
      }
    } catch (err) {
      setAdjustError(err.message || "操作失敗");
    } finally {
      setAdjustLoading(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-purple-300 mb-6">會員管理</h1>

      {/* 搜尋列 */}
      <div className="bg-dark-800/60 rounded-2xl p-6 border border-purple-900/30 mb-6 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1">搜尋會員（帳號或 Email）</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="輸入帳號名稱或 Email..."
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
          />
        </div>
        <div className="text-sm text-gray-400 pb-2">
          符合 <span className="text-purple-300 font-medium">{filteredMembers.length}</span> / {members.length} 位會員
        </div>
      </div>

      {/* 會員列表 */}
      <div className="bg-dark-800/60 rounded-2xl border border-purple-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-purple-900/30">
          <h2 className="text-lg font-semibold text-purple-200">會員列表</h2>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-500">載入中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-900/80 text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">帳號</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">狀態</th>
                  <th className="px-4 py-3 text-left">申請日期 (UTC+8)</th>
                  <th className="px-4 py-3 text-right">點數</th>
                  <th className="px-4 py-3 text-center">改密次數</th>
                  <th className="px-4 py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      沒有符合的會員
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((u) => (
                    <tr key={u.id} className="border-t border-gray-800 hover:bg-purple-900/20 transition">
                      <td className="px-4 py-3 font-medium text-gray-200">{u.username}</td>
                      <td className="px-4 py-3 text-gray-400">{u.email || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${u.is_active ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"}`}>
                          {u.is_active ? "啟用" : "停用"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{formatDateTime(u.created_at)}</td>
                      <td className="px-4 py-3 text-right text-green-300">
                        {u.points.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-300">
                        {u.password_change_count || 0}
                      </td>
                      <td className="px-4 py-3 text-center space-x-1">
                        <button onClick={() => openDetail(u)} className="px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-xs transition">詳情</button>
                        <button onClick={() => openAdjust(u)} className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-xs transition">點數</button>
                        <button onClick={() => openReset(u)} className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-xs transition">重設密碼</button>
                        <button onClick={() => toggleActive(u)} className={`px-2 py-1 rounded text-xs transition ${u.is_active ? "bg-red-700 hover:bg-red-600" : "bg-green-700 hover:bg-green-600"}`}>
                          {u.is_active ? "停用" : "啟用"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 詳情彈窗 */}
      {detailOpen && detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-dark-800 rounded-2xl border border-purple-900/50 w-full max-w-4xl p-6 shadow-2xl my-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-purple-300">會員詳情</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {detailUser.username} · {detailUser.email || "無 Email"} · 目前點數{" "}
                  <span className="text-green-300">{detailUser.points.toLocaleString()} pt</span>
                </p>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center text-gray-500">載入紀錄中...</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* 點數紀錄 */}
                <div>
                  <h4 className="font-semibold text-purple-200 mb-2">最近點數紀錄</h4>
                  <div className="max-h-80 overflow-y-auto border border-gray-800 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-dark-900 sticky top-0 text-gray-400">
                        <tr>
                          <th className="px-2 py-1.5 text-left">時間</th>
                          <th className="px-2 py-1.5 text-left">類型</th>
                          <th className="px-2 py-1.5 text-right">金額</th>
                          <th className="px-2 py-1.5 text-right">餘額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailTxs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-2 py-4 text-center text-gray-500">
                              無紀錄
                            </td>
                          </tr>
                        ) : (
                          detailTxs.slice(0, 30).map((t) => (
                            <tr key={t.id} className="border-t border-gray-800">
                              <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap">
                                {formatDateTime(t.created_at).slice(5, 16)}
                              </td>
                              <td className="px-2 py-1.5 text-gray-300">{t.type}</td>
                              <td className={`px-2 py-1.5 text-right ${t.amount >= 0 ? "text-green-300" : "text-red-300"}`}>
                                {t.amount > 0 ? "+" : ""}{t.amount}
                              </td>
                              <td className="px-2 py-1.5 text-right text-gray-300">{t.balance_after}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 抽卡紀錄 */}
                <div>
                  <h4 className="font-semibold text-purple-200 mb-2">最近抽卡紀錄</h4>
                  <div className="max-h-80 overflow-y-auto border border-gray-800 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-dark-900 sticky top-0 text-gray-400">
                        <tr>
                          <th className="px-2 py-1.5 text-left">時間</th>
                          <th className="px-2 py-1.5 text-left">卡池</th>
                          <th className="px-2 py-1.5 text-left">類型</th>
                          <th className="px-2 py-1.5 text-right">消耗</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailDraws.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-2 py-4 text-center text-gray-500">
                              無紀錄
                            </td>
                          </tr>
                        ) : (
                          detailDraws.slice(0, 30).map((d) => (
                            <tr key={d.id} className="border-t border-gray-800">
                              <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap">
                                {formatDateTime(d.created_at).slice(5, 16)}
                              </td>
                              <td className="px-2 py-1.5 text-gray-300">{d.pool_name || "—"}</td>
                              <td className="px-2 py-1.5 text-gray-300">{d.draw_type === "ten" ? "十連" : "單抽"}</td>
                              <td className="px-2 py-1.5 text-right text-red-300">{d.cost_points}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 密碼變更紀錄 */}
            {!detailLoading && (
              <div className="mt-6">
                <h4 className="font-semibold text-purple-200 mb-2">
                  密碼變更紀錄（共 {passwordLogs.length} 次）
                </h4>
                <div className="max-h-48 overflow-y-auto border border-gray-800 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-dark-900 sticky top-0 text-gray-400">
                      <tr>
                        <th className="px-2 py-1.5 text-left">時間 (UTC+8)</th>
                        <th className="px-2 py-1.5 text-left">帳號</th>
                        <th className="px-2 py-1.5 text-left">Email</th>
                        <th className="px-2 py-1.5 text-left">類型</th>
                      </tr>
                    </thead>
                    <tbody>
                      {passwordLogs.length === 0 ? (
                        <tr><td colSpan={4} className="px-2 py-4 text-center text-gray-500">尚無變更紀錄</td></tr>
                      ) : passwordLogs.map((l) => (
                        <tr key={l.id} className="border-t border-gray-800">
                          <td className="px-2 py-1.5 text-gray-400">{formatDateTime(l.changed_at)}</td>
                          <td className="px-2 py-1.5 text-gray-300">{l.username}</td>
                          <td className="px-2 py-1.5 text-gray-300">{l.email}</td>
                          <td className="px-2 py-1.5">
                            {l.change_type === "admin_reset" ? "管理員重設" : "自行重設"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDetailOpen(false);
                  openAdjust(detailUser);
                }}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm transition"
              >
                調整此會員點數
              </button>
              <button
                onClick={() => setDetailOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-dark-700 text-sm transition"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 調整點數彈窗 */}
      {adjustOpen && adjustUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 rounded-2xl border border-purple-900/50 w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-purple-300">調整點數</h3>
              <button
                onClick={() => setAdjustOpen(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">帳號</label>
                <div className="bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-200">
                  {adjustUser.username}（目前 {adjustUser.points.toLocaleString()} pt）
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  金額（正數加點、負數扣點）
                </label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">備註</label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="選填"
                  className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                />
              </div>
              {adjustMsg && (
                <div className="bg-green-900/40 text-green-300 px-3 py-2 rounded text-sm">{adjustMsg}</div>
              )}
              {adjustError && (
                <div className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm">{adjustError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={doAdjust}
                  disabled={adjustLoading}
                  className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
                >
                  {adjustLoading ? "處理中..." : "確認調整"}
                </button>
                <button
                  onClick={() => setAdjustOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:bg-dark-700 transition"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 重設密碼彈窗 */}
      {resetOpen && resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 rounded-2xl border border-purple-900/50 w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-purple-300">重設密碼</h3>
              <button onClick={() => setResetOpen(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">帳號</label>
                <div className="bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-200">
                  {resetUser.username}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">新密碼（至少 6 字元）</label>
                <input
                  type="text"
                  value={resetPwd}
                  onChange={(e) => setResetPwd(e.target.value)}
                  placeholder="輸入新密碼"
                  className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                />
              </div>
              {resetMsg && <div className="bg-green-900/40 text-green-300 px-3 py-2 rounded text-sm">{resetMsg}</div>}
              {resetError && <div className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm">{resetError}</div>}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={doReset}
                  disabled={resetLoading}
                  className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition"
                >
                  {resetLoading ? "處理中..." : "確認重設"}
                </button>
                <button
                  onClick={() => setResetOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:bg-dark-700 transition"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
