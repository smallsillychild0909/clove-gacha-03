import { useEffect, useState, useMemo, useRef } from "react";
import api from "../../api/client";

// 將時間字串轉成 UTC+8 顯示（YYYY-MM-DD HH:mm:ss）
const formatDateTime = (dateStr) => {
  if (!dateStr) return "";
  let s = String(dateStr).trim();
  // 若沒有時區資訊，視為 UTC
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    s = s.includes("T") ? s + "Z" : s.replace(" ", "T") + "Z";
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(dateStr);
  const utc8 = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${utc8.getUTCFullYear()}-${pad(utc8.getUTCMonth() + 1)}-${pad(utc8.getUTCDate())} ${pad(utc8.getUTCHours())}:${pad(utc8.getUTCMinutes())}:${pad(utc8.getUTCSeconds())}`;
};

export default function AdminRecharge() {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState(1000);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 搜尋與表格
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState(null);
  const rowRefs = useRef({});

  // 彈窗
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUserId, setModalUserId] = useState("");
  const [modalAmount, setModalAmount] = useState(1000);
  const [modalNote, setModalNote] = useState("");
  const [modalMsg, setModalMsg] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  const members = useMemo(
    () => users.filter((u) => u.role === "member"),
    [users]
  );

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.trim().toLowerCase();
    return members.filter((u) => u.username.toLowerCase().includes(q));
  }, [members, searchQuery]);

  useEffect(() => {
    api.adminUsers().then(setUsers).catch(console.error);
  }, []);

  // 搜尋時跳選（高亮 + 捲動到第一筆符合的資料）
  useEffect(() => {
    if (!searchQuery.trim()) {
      setHighlightedId(null);
      return;
    }
    const first = filteredMembers[0];
    if (first) {
      setHighlightedId(first.id);
      setUserId(String(first.id));
      // 延遲一點讓 DOM 更新後再捲動
      setTimeout(() => {
        const el = rowRefs.current[first.id];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    } else {
      setHighlightedId(null);
    }
  }, [searchQuery, filteredMembers]);

  const doRecharge = async (isTest, isModal = false) => {
    const uid = isModal ? modalUserId : userId;
    const amt = isModal ? modalAmount : amount;
    const nte = isModal ? modalNote : note;

    if (isModal) {
      setModalLoading(true);
      setModalMsg("");
      setModalError("");
    } else {
      setLoading(true);
      setMsg("");
      setError("");
    }

    try {
      const body = { user_id: Number(uid), amount: Number(amt), note: nte };
      const res = isTest
        ? await api.adminTestRecharge(body)
        : await api.adminRecharge(body);
      const successMsg = `成功！使用者新點數：${res.new_points.toLocaleString()} pt`;
      if (isModal) {
        setModalMsg(successMsg);
      } else {
        setMsg(successMsg);
      }
      // 重新載入使用者列表
      const updated = await api.adminUsers();
      setUsers(updated);
    } catch (err) {
      if (isModal) {
        setModalError(err.message);
      } else {
        setError(err.message);
      }
    } finally {
      if (isModal) {
        setModalLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  const openModal = (user) => {
    setModalUserId(String(user.id));
    setModalAmount(1000);
    setModalNote("");
    setModalMsg("");
    setModalError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const selectedUser = members.find((u) => String(u.id) === String(userId));

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-purple-300 mb-6">儲值管理</h1>

      {/* 上方功能區：左表單 + 右搜尋 */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        {/* 左側：原本的儲值表單 */}
        <div className="flex-1 bg-dark-800/60 rounded-2xl p-6 border border-purple-900/30 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">選擇會員</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
            >
              <option value="">請選擇...</option>
              {members.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} (目前 {u.points} pt)
                </option>
              ))}
            </select>
            {selectedUser && (
              <p className="text-xs text-gray-500 mt-1">
                已選擇：{selectedUser.username}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              金額（正數儲值、負數扣點）
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">備註</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
              placeholder="選填"
            />
          </div>

          {msg && (
            <div className="bg-green-900/40 text-green-300 px-3 py-2 rounded text-sm">
              {msg}
            </div>
          )}
          {error && (
            <div className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => doRecharge(false)}
              disabled={loading || !userId}
              className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
            >
              手動儲值 / 扣點
            </button>
            <button
              onClick={() => doRecharge(true)}
              disabled={loading || !userId || amount <= 0}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition"
            >
              系統測試儲值
            </button>
          </div>
        </div>

        {/* 右側：搜尋帳號名稱 */}
        <div className="lg:w-80 bg-dark-800/60 rounded-2xl p-6 border border-purple-900/30 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              搜尋帳號名稱
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
              placeholder="輸入帳號名稱搜尋下方表單..."
            />
            <p className="text-xs text-gray-500 mt-2">
              輸入後會自動篩選並跳選到符合的帳號
            </p>
          </div>
          <div className="text-sm text-gray-400">
            符合筆數：<span className="text-purple-300">{filteredMembers.length}</span> / {members.length}
          </div>
        </div>
      </div>

      {/* 下方：所有帳號表單 */}
      <div className="bg-dark-800/60 rounded-2xl border border-purple-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-purple-900/30">
          <h2 className="text-lg font-semibold text-purple-200">所有帳號列表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-900/80 text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">帳號</th>
                <th className="px-4 py-3 text-left">申請日期 (UTC+8)</th>
                <th className="px-4 py-3 text-right">目前剩餘遊戲幣</th>
                <th className="px-4 py-3 text-center">加值功能</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    沒有符合的帳號
                  </td>
                </tr>
              ) : (
                filteredMembers.map((u) => (
                  <tr
                    key={u.id}
                    ref={(el) => (rowRefs.current[u.id] = el)}
                    className={`border-t border-gray-800 hover:bg-purple-900/20 transition ${
                      highlightedId === u.id ? "bg-purple-900/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-200">
                      {u.username}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {formatDateTime(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-300">
                      {u.points.toLocaleString()} pt
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openModal(u)}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm transition"
                      >
                        加值
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 加值彈窗 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 rounded-2xl border border-purple-900/50 w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-purple-300">加值功能</h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">帳號</label>
                <div className="bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-200">
                  {members.find((u) => String(u.id) === String(modalUserId))?.username || "—"}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  金額（正數儲值、負數扣點）
                </label>
                <input
                  type="number"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">備註</label>
                <input
                  type="text"
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                  placeholder="選填"
                />
              </div>

              {modalMsg && (
                <div className="bg-green-900/40 text-green-300 px-3 py-2 rounded text-sm">
                  {modalMsg}
                </div>
              )}
              {modalError && (
                <div className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm">
                  {modalError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => doRecharge(false, true)}
                  disabled={modalLoading || !modalUserId}
                  className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
                >
                  手動儲值 / 扣點
                </button>
                <button
                  onClick={() => doRecharge(true, true)}
                  disabled={modalLoading || !modalUserId || modalAmount <= 0}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition"
                >
                  系統測試儲值
                </button>
              </div>
              <button
                onClick={closeModal}
                className="w-full py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-dark-700 transition"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
