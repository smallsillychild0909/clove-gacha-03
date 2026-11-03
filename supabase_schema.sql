-- ============================================================
-- Clove 抽卡平台 v4 — Supabase (Postgres) 建表腳本
-- 請到 Supabase Dashboard → SQL Editor → 貼上整份後執行
-- ============================================================

-- 使用者（會員 + 管理員）
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 活動獎池
CREATE TABLE IF NOT EXISTS pools (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    intro_type TEXT DEFAULT 'image',
    cost_single INTEGER NOT NULL DEFAULT 100,
    cost_ten INTEGER NOT NULL DEFAULT 900,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    remaining_quantity INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 卡面
CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_url TEXT,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    remaining_quantity INTEGER NOT NULL DEFAULT 0,
    original_probability DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 抽卡紀錄
CREATE TABLE IF NOT EXISTS draw_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    pool_id INTEGER NOT NULL REFERENCES pools(id),
    card_id INTEGER REFERENCES cards(id),
    draw_type TEXT NOT NULL,
    cost_points INTEGER NOT NULL,
    result_json TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 儲值 / 消費紀錄
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    note TEXT,
    operator_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 第三方支付訂單
CREATE TABLE IF NOT EXISTS payment_orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    order_no TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL DEFAULT 'stripe',
    method TEXT NOT NULL,
    amount_points INTEGER NOT NULL,
    amount_money DOUBLE PRECISION NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TWD',
    status TEXT NOT NULL DEFAULT 'pending',
    provider_session_id TEXT,
    provider_payment_id TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- 出貨訂單
CREATE TABLE IF NOT EXISTS shipping_orders (
    id SERIAL PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    pool_id INTEGER,
    pool_name TEXT,
    items_json TEXT,
    recipient TEXT,
    phone TEXT,
    address TEXT,
    shipping_method TEXT DEFAULT 'cod',
    status TEXT NOT NULL DEFAULT 'received',
    packaging_note TEXT,
    company TEXT,
    tracking TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 卡片返還設定
CREATE TABLE IF NOT EXISTS card_return_settings (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    target_key TEXT NOT NULL,
    target_name TEXT,
    return_coins INTEGER NOT NULL DEFAULT 0,
    UNIQUE(pool_id, mode, target_key)
);

-- 已兌換卡片（反灰用）
CREATE TABLE IF NOT EXISTS redeemed_cards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    card_key TEXT NOT NULL,
    redeem_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, card_key)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cards_pool ON cards(pool_id);
CREATE INDEX IF NOT EXISTS idx_draw_records_user ON draw_records(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pools_active_sort ON pools(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_shipping_user ON shipping_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_redeemed_user ON redeemed_cards(user_id);

-- 若表已存在但缺 sort_order：
-- ALTER TABLE pools ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ============================================================
-- 會員管理擴充（停用帳號 / 密碼變更紀錄 / 忘記密碼驗證碼）
-- ============================================================

-- 使用者表增加停用欄位（若尚未存在）
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1;

-- 密碼變更紀錄
CREATE TABLE IF NOT EXISTS password_change_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    username TEXT,
    email TEXT,
    change_type TEXT NOT NULL,          -- self_reset / admin_reset
    operator_id INTEGER,                -- 管理員操作時記錄
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_logs_user ON password_change_logs(user_id);

-- 忘記密碼驗證碼
CREATE TABLE IF NOT EXISTS password_reset_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_codes_user ON password_reset_codes(user_id);

-- ============================================================
-- 會員等級系統（依累計儲值金額自動升級）
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS member_level TEXT NOT NULL DEFAULT '普通會員';
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_recharged INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS member_tiers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    min_recharge INTEGER NOT NULL DEFAULT 0,
    draw_discount INTEGER NOT NULL DEFAULT 0,   -- 抽卡折扣 % (0-100)
    sort_order INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_tiers_min ON member_tiers(min_recharge);

-- 預設等級（可於後台修改門檻與名稱）
INSERT INTO member_tiers (name, min_recharge, draw_discount, sort_order, description) VALUES
('普通會員', 0, 0, 0, '預設等級'),
('VIP1', 1000, 2, 1, '累計儲值達 1,000，抽卡 98 折'),
('VIP2', 5000, 4, 2, '累計儲值達 5,000，抽卡 96 折'),
('VIP3', 15000, 6, 3, '累計儲值達 15,000，抽卡 94 折'),
('VIP4', 40000, 8, 4, '累計儲值達 40,000，抽卡 92 折'),
('VIP5', 80000, 10, 5, '累計儲值達 80,000，抽卡 9 折'),
('VVIP', 200000, 15, 6, '累計儲值達 200,000，抽卡 85 折'),
('SVIP', 500000, 20, 7, '累計儲值達 500,000，抽卡 8 折')
ON CONFLICT (name) DO NOTHING;

-- 若表已存在，補上折扣欄位
ALTER TABLE member_tiers ADD COLUMN IF NOT EXISTS draw_discount INTEGER NOT NULL DEFAULT 0;
