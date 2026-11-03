import { useEffect, useState } from "react";
import api from "../../api/client";

export default function AdminTiers() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const emptyForm = { name: "", min_recharge: 0, draw_discount: 0, sort_order: 0, description: "" };
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      const data = await api.adminListTiers();
      setTiers(data || []);
    } catch (e) {
      setError(e.message || "載入失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(""); setError("");
    try {
      if (editing) {
        await api.adminUpdateTier(editing, form);
        setMsg("已更新");
      } else {
        await api.adminCreateTier(form);
        setMsg("已新增");
      }
      setForm(emptyForm);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message || "操作失敗");
    }
  };

  const startEdit = (t) => {
    setEditing(t.id);
    setForm({
      name: t.name,
      min_recharge: t.min_recharge,
      draw_discount: t.draw_discount || 0,
      sort_order: t.sort_order || 0,
      description: t.description || ""
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const handleDelete = async (id) => {
    if (!confirm("確定刪除此等級？")) return;
    try {
      await api.adminDeleteTier(id);
      setMsg("已刪除");
      load();
    } catch (e) {
      setError(e.message || "刪除失敗");
    }
  };

  // 快速修改門檻／折扣（列表內直接改）
  const quickUpdate = async (tier, field, value) => {
    const num = Number(value);
    if (isNaN(num) || num < 0) return;
    setMsg(""); setError("");
    try {
      const payload = {
        name: tier.name,
        min_recharge: field === "min_recharge" ? num : tier.min_recharge,
        draw_discount: field === "draw_discount" ? num : (tier.draw_discount || 0),
        sort_order: tier.sort_order || 0,
        description: tier.description || ""
      };
      await api.adminUpdateTier(tier.id, payload);
      setMsg(`${tier.name} 的${field === "min_recharge" ? "門檻" : "折扣"}已更新`);
      load();
    } catch (e) {
      setError(e.message || "更新失敗");
    }
  };

  const recalculate = async () => {
    if (!confirm("將依目前門檻重新計算所有會員等級，確定？")) return;
    try {
      const r = await api.adminRecalculateTiers();
      setMsg(`已重新計算 ${r.updated} 位會員`);
    } catch (e) {
      setError(e.message || "重新計算失敗");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-purple-300">會員等級設定</h1>
        <button onClick={recalculate} className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-sm">
          重新計算全部會員
        </button>
      </div>

      {msg && <div className="mb-4 p-3 rounded bg-green-900/40 text-green-300 text-sm">{msg}</div>}
      {error && <div className="mb-4 p-3 rounded bg-red-900/40 text-red-300 text-sm">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* 列表 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">目前等級門檻</h2>
          {loading ? <p className="text-gray-400">載入中...</p> : (
            <div className="space-y-2">
              {tiers.map((t) => (
                <div key={t.id} className="bg-dark-800/60 rounded-xl p-4 border border-purple-900/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-semibold text-yellow-300 mb-2">{t.name}</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">門檻（累計儲值）</label>
                          <input
                            type="number"
                            min="0"
                            defaultValue={t.min_recharge}
                            className="w-full bg-dark-900 border border-purple-900/40 rounded px-2 py-1 text-sm"
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== t.min_recharge) quickUpdate(t, "min_recharge", v);
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">抽卡折扣 %</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={t.draw_discount || 0}
                            className="w-full bg-dark-900 border border-purple-900/40 rounded px-2 py-1 text-sm"
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== (t.draw_discount || 0)) quickUpdate(t, "draw_discount", v);
                            }}
                          />
                        </div>
                      </div>
                      {t.description && <div className="text-xs text-gray-500 mt-2">{t.description}</div>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => startEdit(t)} className="text-xs px-2 py-1 rounded bg-purple-800 hover:bg-purple-700">完整編輯</button>
                      {t.min_recharge > 0 && (
                        <button onClick={() => handleDelete(t.id)} className="text-xs px-2 py-1 rounded bg-red-900/60 hover:bg-red-800">刪除</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {tiers.length === 0 && <p className="text-gray-500 text-sm">尚未設定任何等級</p>}
            </div>
          )}
        </div>

        {/* 表單 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{editing ? "編輯等級" : "新增等級"}</h2>
          <form onSubmit={handleSubmit} className="bg-dark-800/60 rounded-2xl p-6 border border-purple-900/30 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">等級名稱</label>
              <input
                className="w-full bg-dark-900 border border-purple-900/40 rounded px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如 VIP、VVIP、XVIP"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">累計儲值門檻（點數）</label>
              <input
                type="number"
                min="0"
                className="w-full bg-dark-900 border border-purple-900/40 rounded px-3 py-2"
                value={form.min_recharge}
                onChange={(e) => setForm({ ...form, min_recharge: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">抽卡折扣 %（0 = 無折扣，10 = 9折）</label>
              <input
                type="number"
                min="0"
                max="100"
                className="w-full bg-dark-900 border border-purple-900/40 rounded px-3 py-2"
                value={form.draw_discount}
                onChange={(e) => setForm({ ...form, draw_discount: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">排序（數字越小越前面）</label>
              <input
                type="number"
                className="w-full bg-dark-900 border border-purple-900/40 rounded px-3 py-2"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">說明（選填）</label>
              <input
                className="w-full bg-dark-900 border border-purple-900/40 rounded px-3 py-2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="例如：專屬客服、更高中獎率..."
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-5 py-2 rounded bg-purple-600 hover:bg-purple-500">
                {editing ? "更新" : "新增"}
              </button>
              {editing && (
                <button type="button" onClick={cancelEdit} className="px-5 py-2 rounded bg-gray-700 hover:bg-gray-600">
                  取消
                </button>
              )}
            </div>
          </form>
          <p className="text-xs text-gray-500 mt-4">
            會員每次儲值後會自動依累計金額更新等級。抽卡時會套用該等級的折扣。
          </p>
        </div>
      </div>
    </div>
  );
}
