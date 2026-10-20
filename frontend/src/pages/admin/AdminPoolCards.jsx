import { imgSrc } from "../../utils/image";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../api/client";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function formatProb(p) {
  if (p == null || p === "") return "—";
  const pct = Number(p) * 100;
  if (!Number.isFinite(pct) || pct === 0) return "0%";
  const s = pct.toFixed(7).replace(/\.?0+$/, "");
  return s + "%";
}

export default function AdminPoolCards() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", total_quantity: 10, original_probability: "" });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [probMode, setProbMode] = useState("auto");
  const [previewImage, setPreviewImage] = useState(null);
  const [showBackTop, setShowBackTop] = useState(false);
  const [showZeroAlert, setShowZeroAlert] = useState(false); // 剩餘可分配為 0 的提示

  const load = () =>
    api.adminListCards(id).then(setData).catch((e) => setMsg("載入失敗：" + e.message));

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openCreate = () => {
    const remaining = data?.pool ? data.pool.total_quantity - sumQty : 0;
    if (remaining <= 0) {
      setShowZeroAlert(true);
      return;
    }
    setEditingId(null);
    setForm({ name: "", total_quantity: 10, original_probability: "" });
    setImage(null);
    setShowCreateForm(true);
    setShowEditModal(false);
    setProbMode("auto");
    setMsg("");
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      total_quantity: c.total_quantity,
      original_probability: c.original_probability != null ? String(c.original_probability) : "",
    });
    setImage(null);
    setShowEditModal(true);
    setShowCreateForm(false);
    setProbMode(c.original_probability != null ? "manual" : "auto");
    setMsg("");
  };

  const closeCreate = () => {
    setShowCreateForm(false);
    setImage(null);
  };

  const closeEdit = () => {
    setShowEditModal(false);
    setEditingId(null);
    setImage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("total_quantity", form.total_quantity);

      let finalProb = form.original_probability;
      if (probMode === "auto" && data?.pool) {
        const auto = Number(form.total_quantity) / Number(data.pool.total_quantity);
        finalProb = String(auto);
      }
      if (finalProb !== "") {
        fd.append("original_probability", finalProb);
      }

      if (image) fd.append("image", image);

      if (editingId != null) {
        await api.adminUpdateCard(editingId, fd);
        setMsg("卡面已更新！");
        closeEdit();
      } else {
        await api.adminAddCard(id, fd);
        setMsg("卡面新增成功！");
        closeCreate();
      }
      load();
    } catch (err) {
      setMsg("錯誤：" + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (c) => {
    if (!confirm(`確定刪除卡面「${c.name}」？\n（已抽出過的卡面無法刪除）`)) return;
    setMsg("");
    try {
      await api.adminDeleteCard(c.id);
      setMsg("卡面已刪除");
      load();
    } catch (err) {
      setMsg("錯誤：" + err.message);
    }
  };

  if (!data) return <div className="text-center py-20 text-purple-300">載入中...</div>;

  const { pool, cards } = data;
  const sumQty = cards.reduce((s, c) => s + c.total_quantity, 0);
  const remaining = pool.total_quantity - sumQty;

  const autoProb =
    pool && form.total_quantity
      ? Number(form.total_quantity) / Number(pool.total_quantity)
      : 0;

  return (
    <div>
      <Link to="/admin/pools" className="text-sm text-gray-400 hover:text-purple-300 mb-4 inline-block">
        ← 返回獎池列表
      </Link>
      <h1 className="text-2xl font-bold text-purple-300 mb-1">{pool.name} - 卡面管理</h1>
      <p className="text-gray-400 mb-6">
        獎池總量 {pool.total_quantity} · 已設定卡面總數 {sumQty} · 剩餘可分配 {remaining}
      </p>

      {msg && (
        <div
          className={`mb-4 text-sm px-3 py-2 rounded ${
            msg.startsWith("錯誤") || msg.startsWith("載入")
              ? "bg-red-900/40 text-red-300"
              : "bg-green-900/40 text-green-300"
          }`}
        >
          {msg}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={showCreateForm ? closeCreate : openCreate}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition"
        >
          {showCreateForm ? "取消" : "+ 新增卡面"}
        </button>
      </div>

      {/* 新增卡面表單 */}
      {showCreateForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-dark-800/60 rounded-2xl p-6 border border-purple-900/30 mb-8 space-y-4"
        >
          <h2 className="text-lg font-semibold text-purple-200">新增卡面</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">卡面名稱 *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">可抽出張數（總數）*</label>
              <input
                type="number"
                min={1}
                required
                value={form.total_quantity}
                onChange={(e) => setForm({ ...form, total_quantity: e.target.value })}
                className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">原始概率</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setProbMode("auto")}
                  className={`px-3 py-1.5 rounded text-sm ${
                    probMode === "auto" ? "bg-purple-600 text-white" : "bg-dark-900 text-gray-400"
                  }`}
                >
                  自動百分比
                </button>
                <button
                  type="button"
                  onClick={() => setProbMode("manual")}
                  className={`px-3 py-1.5 rounded text-sm ${
                    probMode === "manual" ? "bg-purple-600 text-white" : "bg-dark-900 text-gray-400"
                  }`}
                >
                  自行輸入
                </button>
              </div>

              {probMode === "auto" ? (
                <div className="bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 text-yellow-300">
                  自動計算：{formatProb(autoProb)}
                  <span className="text-xs text-gray-500 ml-2">
                    （{form.total_quantity} / {pool.total_quantity}）
                  </span>
                </div>
              ) : (
                <input
                  type="number"
                  step="0.0000001"
                  min={0}
                  max={1}
                  value={form.original_probability}
                  onChange={(e) => setForm({ ...form, original_probability: e.target.value })}
                  className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                  placeholder="例如 0.05 或 0.0000001"
                />
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">卡面圖片</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files[0])}
                className="w-full text-sm text-gray-400"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
            >
              {loading ? "儲存中..." : "新增卡面"}
            </button>
            <button
              type="button"
              onClick={closeCreate}
              className="px-4 py-2 rounded-lg bg-dark-900 text-gray-400"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {/* 編輯 Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeEdit}
        >
          <div
            className="bg-dark-800 rounded-2xl border border-purple-900/40 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-purple-200">編輯卡面 #{editingId}</h2>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="text-gray-400 hover:text-white text-xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">卡面名稱 *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">可抽出張數（總數）*</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.total_quantity}
                    onChange={(e) => setForm({ ...form, total_quantity: e.target.value })}
                    className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">不可小於已抽出數量；剩餘會自動重算</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-2">原始概率</label>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setProbMode("auto")}
                      className={`px-3 py-1.5 rounded text-sm ${
                        probMode === "auto" ? "bg-purple-600 text-white" : "bg-dark-900 text-gray-400"
                      }`}
                    >
                      自動百分比
                    </button>
                    <button
                      type="button"
                      onClick={() => setProbMode("manual")}
                      className={`px-3 py-1.5 rounded text-sm ${
                        probMode === "manual" ? "bg-purple-600 text-white" : "bg-dark-900 text-gray-400"
                      }`}
                    >
                      自行輸入
                    </button>
                  </div>

                  {probMode === "auto" ? (
                    <div className="bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 text-yellow-300">
                      自動計算：{formatProb(autoProb)}
                      <span className="text-xs text-gray-500 ml-2">
                        （{form.total_quantity} / {pool.total_quantity}）
                      </span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.0000001"
                      min={0}
                      max={1}
                      value={form.original_probability}
                      onChange={(e) => setForm({ ...form, original_probability: e.target.value })}
                      className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                      placeholder="例如 0.05 或 0.0000001"
                    />
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">
                    卡面圖片（不選則保留原圖）
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImage(e.target.files[0])}
                    className="w-full text-sm text-gray-400"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
                >
                  {loading ? "儲存中..." : "儲存修改"}
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="px-4 py-2 rounded-lg bg-dark-900 text-gray-400"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 卡面列表 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="py-2 pr-4">圖片</th>
              <th className="py-2 pr-4">卡片名稱</th>
              <th className="py-2 pr-4">總數</th>
              <th className="py-2 pr-4">已抽出</th>
              <th className="py-2 pr-4">剩餘</th>
              <th className="py-2 pr-4">原始概率</th>
              <th className="py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-b border-gray-900">
                <td className="py-2 pr-4">
                  {c.image_url ? (
                    <img
                      src={imgSrc(c.image_url)}
                      alt={c.name}
                      className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition"
                      title="雙擊查看大圖"
                      onDoubleClick={() => setPreviewImage(imgSrc(c.image_url))}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4 font-medium">{c.name}</td>
                <td className="py-2 pr-4">{c.total_quantity}</td>
                <td className="py-2 pr-4">{c.total_quantity - c.remaining_quantity}</td>
                <td className="py-2 pr-4 text-yellow-300">{c.remaining_quantity}</td>
                <td className="py-2 pr-4">{formatProb(c.original_probability)}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="px-2 py-1 rounded bg-blue-900/50 hover:bg-blue-800 text-xs"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="px-2 py-1 rounded bg-red-900/40 hover:bg-red-800 text-xs text-red-300"
                    >
                      刪除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cards.length === 0 && <p className="text-gray-500 mt-4">尚未新增任何卡面</p>}
      </div>

      {/* 大圖預覽 Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt="預覽"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 bg-dark-800 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 剩餘可分配為 0 提示 Modal */}
      {showZeroAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowZeroAlert(false)}
        >
          <div
            className="bg-dark-800 rounded-2xl border border-red-900/40 w-full max-w-md p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-300 mb-2">無法新增卡面</h3>
            <p className="text-gray-300 mb-6">剩餘可分配已為 0，請先調整現有卡面數量或增加獎池總量。</p>
            <button
              onClick={() => setShowZeroAlert(false)}
              className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500"
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* 浮動球 - 回到最頂 */}
      {showBackTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
          title="回到最頂"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}