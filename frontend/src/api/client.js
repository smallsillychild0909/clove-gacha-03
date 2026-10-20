// 本地開發走 Vite proxy（空字串）；正式環境設 VITE_API_URL
const API_BASE = import.meta.env.VITE_API_URL ?? "";

function getToken() {
  return localStorage.getItem("token");
}

function clearToken() {
  localStorage.removeItem("token");
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  // 登入/註冊不要帶舊 Token，避免干擾
  const isAuthPath = path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register");
  const token = getToken();
  if (token && !isAuthPath) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let data = {};
  try {
    data = await res.json();
  } catch (_) {}

  if (res.status === 401) {
    // 登入本身的 401 是帳密錯誤，不要清 token 以外的邏輯搞混
    if (!isAuthPath) {
      clearToken();
    }
    const detail = data.detail;
    const msg = typeof detail === "string" ? detail : "請重新登入";
    throw new Error(msg);
  }

  if (!res.ok) {
    const detail = data.detail;
    const msg = typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join(", ")
        : data.message || `請求失敗 (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  register: (body) => request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => {
    clearToken(); // 登入前清掉舊 Token
    return request("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
  },
  me: () => request("/api/auth/me"),

  listPools: () => request("/api/pools"),
  getPool: (id) => request(`/api/pools/${id}`),

  draw: (body) => request("/api/draw", { method: "POST", body: JSON.stringify(body) }),

  myDrawRecords: () => request("/api/my/draw-records"),
  myTransactions: () => request("/api/my/transactions"),
  myShippings: () => request("/api/my/shippings"),
  myRedeemedKeys: () => request("/api/my/redeemed-keys"),
  redeemToCoins: (body) => request("/api/my/redeem-to-coins", { method: "POST", body: JSON.stringify(body) }),
  extractCards: (body) => request("/api/my/extract-cards", { method: "POST", body: JSON.stringify(body) }),
  recharge: (body) => request("/api/recharge", { method: "POST", body: JSON.stringify(body) }),

  // 第三方支付
  paymentMethods: () => request("/api/payments/methods"),
  createPayment: (body) => request("/api/payments/create", { method: "POST", body: JSON.stringify(body) }),
  confirmPayment: (orderNo, sessionId) =>
    request(`/api/payments/confirm?order_no=${encodeURIComponent(orderNo)}&session_id=${encodeURIComponent(sessionId || "")}`, { method: "POST" }),
  myPaymentOrders: () => request("/api/payments/orders"),

  adminCreatePool: (formData) => request("/api/admin/pools", { method: "POST", body: formData }),
  adminUpdatePool: (id, formData) => request(`/api/admin/pools/${id}`, { method: "PUT", body: formData }),
  adminAddCard: (poolId, formData) => request(`/api/admin/pools/${poolId}/cards`, { method: "POST", body: formData }),
  adminListCards: (poolId) => request(`/api/admin/pools/${poolId}/cards`),
  adminRecharge: (body) => request("/api/admin/recharge", { method: "POST", body: JSON.stringify(body) }),
  adminTestRecharge: (body) => request("/api/admin/test-recharge", { method: "POST", body: JSON.stringify(body) }),
  adminUsers: () => request("/api/admin/users"),
  adminTransactions: (userId) => request(userId ? `/api/admin/transactions?user_id=${userId}` : "/api/admin/transactions"),
  adminDrawRecords: () => request("/api/admin/draw-records"),
  adminShippingsToday: () => request("/api/admin/shippings/today"),
  adminShippings: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/admin/shippings${q ? "?" + q : ""}`);
  },
  adminUpdateShipping: (orderNo, body) => request(`/api/admin/shippings/${orderNo}`, { method: "PUT", body: JSON.stringify(body) }),
  adminGetReturnSettings: (poolId, mode) => request(`/api/admin/return-settings/${poolId}?mode=${mode}`),
  adminSaveReturnSettings: (poolId, body) => request(`/api/admin/return-settings/${poolId}`, { method: "POST", body: JSON.stringify(body) }),
  listAllPools: () => request("/api/pools?active_only=false"),
  adminUpdateCard: (cardId, formData) => request(`/api/admin/cards/${cardId}`, { method: "PUT", body: formData }),
  adminDeleteCard: (cardId) => request(`/api/admin/cards/${cardId}`, { method: "DELETE" }),
  adminDeletePool: (poolId) => request(`/api/admin/pools/${poolId}`, { method: "DELETE" }),
  adminMovePool: (poolId, direction) =>
    request(`/api/admin/pools/${poolId}/move?direction=${direction}`, { method: "POST" }),
};

export default api;
