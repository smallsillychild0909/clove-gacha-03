import os
import json
import random
import uuid
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from database import init_db, get_db
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin, require_member
)

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

try:
    import stripe
except ImportError:
    stripe = None

# 初始化
init_db()

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Supabase Storage（有設定就壓縮後上傳雲端，否則存本機）
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "gacha-images")

def save_image(file, prefix: str = "img") -> str:
    """儲存上傳圖片。優先壓縮後上傳 Supabase Storage，否則存本機。"""
    from pathlib import Path as _P
    from io import BytesIO

    raw = file.file.read()
    content_type = "image/jpeg"
    filename_ext = ".jpg"

    try:
        from PIL import Image
        img = Image.open(BytesIO(raw))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        max_side = 1200
        if max(img.size) > max_side:
            ratio = max_side / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.LANCZOS)
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
        raw = buf.getvalue()
    except Exception:
        ext = _P(getattr(file, "filename", "") or "").suffix.lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
            ext = ".jpg"
        filename_ext = ext
        content_type = getattr(file, "content_type", None) or "image/jpeg"

    filename = f"{prefix}_{uuid.uuid4().hex}{filename_ext}"

    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        try:
            import httpx
        except ImportError:
            raise HTTPException(500, "請安裝 httpx")
        url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{filename}"
        headers = {
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "apikey": SUPABASE_SERVICE_KEY,
            "Content-Type": content_type,
            "x-upsert": "true",
            "Cache-Control": "public, max-age=31536000",
        }
        resp = httpx.post(url, content=raw, headers=headers, timeout=60)
        if resp.status_code not in (200, 201):
            raise HTTPException(500, f"圖片上傳失敗 ({resp.status_code}): {resp.text[:200]}")
        return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{filename}"
    else:
        filepath = UPLOAD_DIR / filename
        with open(filepath, "wb") as f:
            f.write(raw)
        return f"/uploads/{filename}"

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")
POINTS_PER_CURRENCY = float(os.getenv("POINTS_PER_CURRENCY", "1"))
PAYMENT_CURRENCY = os.getenv("PAYMENT_CURRENCY", "TWD")

if stripe and STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

app = FastAPI(title="Clove 抽卡平台 API", version="1.0.0")

_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://clove-gacha-03.vercel.app",
]
_env_origins = os.getenv("CORS_ORIGINS", "")
allow_origins = _default_origins + [o.strip() for o in _env_origins.split(",") if o.strip()]
if os.getenv("CORS_ALLOW_ALL", "").lower() in ("1", "true", "yes"):
    allow_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ==================== Schemas ====================

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class RechargeRequest(BaseModel):
    user_id: Optional[int] = None
    amount: int
    note: Optional[str] = None

class PoolCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    intro_type: str = "image"  # image / text
    cost_single: int = 100
    cost_ten: int = 900
    total_quantity: int

class CardCreate(BaseModel):
    name: str
    total_quantity: int
    original_probability: Optional[float] = None  # 若不填則自動依數量計算

class DrawRequest(BaseModel):
    pool_id: int
    draw_type: str  # single / ten

# ==================== Auth ====================

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(400, "密碼至少 6 位")
    conn = get_db()
    try:
        hashed = hash_password(req.password)
        cur = conn.execute(
            "INSERT INTO users (username, email, password_hash, role, points) VALUES (?, ?, ?, 'member', 0)",
            (req.username, req.email, hashed)
        )
        conn.commit()
        user_id = cur.lastrowid
        token = create_access_token({"sub": user_id, "role": "member"})
        return {"token": token, "user": {"id": user_id, "username": req.username, "role": "member", "points": 0}}
    except Exception as e:
        conn.rollback()
        if "UNIQUE" in str(e):
            raise HTTPException(400, "使用者名稱或 Email 已存在")
        raise HTTPException(500, str(e))
    finally:
        conn.close()

@app.post("/api/auth/login")
def login(req: LoginRequest):
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (req.username,)).fetchone()
    conn.close()
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "帳號或密碼錯誤")
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "points": user["points"]
        }
    }

@app.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "points": user["points"]
    }

# ==================== 獎池 (公開 + 會員) ====================

@app.get("/api/pools")
def list_pools(active_only: bool = True):
    conn = get_db()
    # 前台與後台共用 sort_order，數字越小越前面
    if active_only:
        rows = conn.execute(
            """SELECT id, name, description, image_url, intro_type, cost_single, cost_ten,
                      total_quantity, remaining_quantity, is_active, sort_order
               FROM pools WHERE is_active = 1 ORDER BY sort_order ASC, id ASC"""
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT id, name, description, image_url, intro_type, cost_single, cost_ten,
                      total_quantity, remaining_quantity, is_active, sort_order
               FROM pools ORDER BY sort_order ASC, id ASC"""
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/pools/{pool_id}")
def get_pool(pool_id: int):
    conn = get_db()
    pool = conn.execute("SELECT * FROM pools WHERE id = ?", (pool_id,)).fetchone()
    if not pool:
        conn.close()
        raise HTTPException(404, "獎池不存在")
    cards = conn.execute(
        "SELECT id, name, image_url, total_quantity, remaining_quantity, original_probability FROM cards WHERE pool_id = ? ORDER BY id",
        (pool_id,)
    ).fetchall()
    conn.close()
    result = dict(pool)
    result["cards"] = [dict(c) for c in cards]
    return result

# ==================== 抽卡 ====================

def weighted_draw(cards: list) -> dict | None:
    """依剩餘數量加權隨機抽一張"""
    available = [c for c in cards if c["remaining_quantity"] > 0]
    if not available:
        return None
    weights = [c["remaining_quantity"] for c in available]
    chosen = random.choices(available, weights=weights, k=1)[0]
    return chosen

@app.post("/api/draw")
def draw_cards(req: DrawRequest, user: dict = Depends(require_member)):
    if req.draw_type not in ("single", "ten"):
        raise HTTPException(400, "draw_type 必須是 single 或 ten")

    conn = get_db()
    try:
        pool = conn.execute("SELECT * FROM pools WHERE id = ? AND is_active = 1", (req.pool_id,)).fetchone()
        if not pool:
            raise HTTPException(404, "獎池不存在或已關閉")

        cost = pool["cost_single"] if req.draw_type == "single" else pool["cost_ten"]
        count = 1 if req.draw_type == "single" else 10

        if user["points"] < cost:
            raise HTTPException(400, f"點數不足，需要 {cost} 點，目前只有 {user['points']} 點")

        if pool["remaining_quantity"] < count:
            raise HTTPException(400, f"獎池剩餘不足，只剩 {pool['remaining_quantity']} 張")

        cards = [dict(c) for c in conn.execute(
            "SELECT * FROM cards WHERE pool_id = ?", (req.pool_id,)
        ).fetchall()]

        results = []
        for _ in range(count):
            chosen = weighted_draw(cards)
            if not chosen:
                break
            # 更新剩餘
            conn.execute(
                "UPDATE cards SET remaining_quantity = remaining_quantity - 1 WHERE id = ?",
                (chosen["id"],)
            )
            for c in cards:
                if c["id"] == chosen["id"]:
                    c["remaining_quantity"] -= 1
                    break
            results.append({
                "card_id": chosen["id"],
                "name": chosen["name"],
                "image_url": chosen["image_url"]
            })

        actual_count = len(results)
        if actual_count == 0:
            raise HTTPException(400, "獎池已抽完")

        # 若實際抽到少於預期（理論不該發生），按比例扣點
        actual_cost = cost if actual_count == count else int(cost * actual_count / count)

        # 更新使用者點數
        new_points = user["points"] - actual_cost
        conn.execute("UPDATE users SET points = ? WHERE id = ?", (new_points, user["id"]))

        # 更新獎池剩餘
        conn.execute(
            "UPDATE pools SET remaining_quantity = remaining_quantity - ? WHERE id = ?",
            (actual_count, req.pool_id)
        )

        # 寫入抽卡紀錄
        result_json = json.dumps(results, ensure_ascii=False)
        conn.execute(
            "INSERT INTO draw_records (user_id, pool_id, draw_type, cost_points, result_json) VALUES (?, ?, ?, ?, ?)",
            (user["id"], req.pool_id, req.draw_type, actual_cost, result_json)
        )

        # 寫入交易紀錄
        conn.execute(
            "INSERT INTO transactions (user_id, type, amount, balance_after, note) VALUES (?, 'draw', ?, ?, ?)",
            (user["id"], -actual_cost, new_points, f"{'單抽' if req.draw_type=='single' else '十連'} 獎池#{req.pool_id}")
        )

        conn.commit()
        return {
            "success": True,
            "results": results,
            "cost": actual_cost,
            "remaining_points": new_points,
            "draw_count": actual_count
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()

# ==================== 會員紀錄 ====================

@app.get("/api/my/draw-records")
def my_draw_records(user: dict = Depends(require_member), limit: int = 50):
    conn = get_db()
    rows = conn.execute("""
        SELECT dr.*, p.name as pool_name
        FROM draw_records dr
        LEFT JOIN pools p ON dr.pool_id = p.id
        WHERE dr.user_id = ?
        ORDER BY dr.id DESC LIMIT ?
    """, (user["id"], limit)).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["results"] = json.loads(d.pop("result_json") or "[]")
        result.append(d)
    return result

@app.get("/api/my/transactions")
def my_transactions(user: dict = Depends(require_member), limit: int = 50):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?",
        (user["id"], limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ==================== 會員自行儲值（模擬，本機測試用） ====================

@app.post("/api/recharge")
def member_recharge(req: RechargeRequest, user: dict = Depends(require_member)):
    if req.amount <= 0:
        raise HTTPException(400, "儲值金額必須大於 0")
    conn = get_db()
    new_points = user["points"] + req.amount
    conn.execute("UPDATE users SET points = ? WHERE id = ?", (new_points, user["id"]))
    conn.execute(
        "INSERT INTO transactions (user_id, type, amount, balance_after, note) VALUES (?, 'recharge', ?, ?, ?)",
        (user["id"], req.amount, new_points, req.note or "會員自行儲值（模擬）")
    )
    conn.commit()
    conn.close()
    return {"success": True, "new_points": new_points}


# ==================== 第三方支付（Stripe：刷卡 / Apple Pay / Google Pay / 微信 / 支付寶） ====================

METHOD_LABELS = {
    "card": "信用卡 / 簽帳卡",
    "apple_pay": "Apple Pay",
    "google_pay": "Google Pay",
    "wechat": "微信支付",
    "alipay": "支付寶",
    "mock": "模擬儲值",
}

# Stripe Checkout 支援的 payment_method_types
STRIPE_METHOD_MAP = {
    "card": ["card"],
    "apple_pay": ["card"],       # Stripe 會自動顯示 Apple Pay
    "google_pay": ["card"],      # Stripe 會自動顯示 Google Pay
    "wechat": ["wechat_pay"],
    "alipay": ["alipay"],
}


class CreatePaymentRequest(BaseModel):
    amount: int                  # 要買的遊戲幣點數
    method: str = "card"         # card / apple_pay / google_pay / wechat / alipay


def _credit_order(conn, order: dict, payment_id: str | None = None) -> int:
    """把訂單點數入帳（冪等：已 paid 不再加）"""
    if order["status"] == "paid":
        user = conn.execute("SELECT points FROM users WHERE id = ?", (order["user_id"],)).fetchone()
        return user["points"] if user else 0

    user = conn.execute("SELECT * FROM users WHERE id = ?", (order["user_id"],)).fetchone()
    if not user:
        raise HTTPException(404, "使用者不存在")

    new_points = user["points"] + order["amount_points"]
    conn.execute("UPDATE users SET points = ? WHERE id = ?", (new_points, user["id"]))
    conn.execute(
        """UPDATE payment_orders
           SET status = 'paid', provider_payment_id = COALESCE(?, provider_payment_id),
               paid_at = datetime('now','localtime')
           WHERE id = ?""",
        (payment_id, order["id"])
    )
    label = METHOD_LABELS.get(order["method"], order["method"])
    conn.execute(
        """INSERT INTO transactions (user_id, type, amount, balance_after, note)
           VALUES (?, 'payment', ?, ?, ?)""",
        (user["id"], order["amount_points"], new_points,
         f"{label} 儲值 {order['amount_money']} {order['currency']} · 訂單 {order['order_no']}")
    )
    return new_points


@app.get("/api/payments/methods")
def payment_methods():
    """回傳可用支付方式（前端用來顯示按鈕）"""
    stripe_ready = bool(stripe and STRIPE_SECRET_KEY)
    methods = [
        {"id": "card", "name": "信用卡 / 簽帳卡", "enabled": stripe_ready},
        {"id": "apple_pay", "name": "Apple Pay", "enabled": stripe_ready},
        {"id": "google_pay", "name": "Google Pay", "enabled": stripe_ready},
        {"id": "wechat", "name": "微信支付", "enabled": stripe_ready},
        {"id": "alipay", "name": "支付寶", "enabled": stripe_ready},
        {"id": "mock", "name": "模擬儲值（本機測試）", "enabled": True},
    ]
    return {
        "methods": methods,
        "currency": PAYMENT_CURRENCY,
        "points_per_currency": POINTS_PER_CURRENCY,
        "stripe_configured": stripe_ready,
    }


@app.post("/api/payments/create")
def create_payment(req: CreatePaymentRequest, user: dict = Depends(require_member)):
    """建立支付訂單。mock 直接入帳；其餘走 Stripe Checkout。"""
    if req.amount <= 0:
        raise HTTPException(400, "儲值點數必須大於 0")
    method = req.method.lower()
    if method not in METHOD_LABELS:
        raise HTTPException(400, "不支援的支付方式")

    amount_money = round(req.amount / POINTS_PER_CURRENCY, 2)
    order_no = f"CL{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"

    conn = get_db()
    cur = conn.execute(
        """INSERT INTO payment_orders
           (user_id, order_no, provider, method, amount_points, amount_money, currency, status, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
        (user["id"], order_no, "mock" if method == "mock" else "stripe",
         method, req.amount, amount_money, PAYMENT_CURRENCY,
         METHOD_LABELS.get(method, method))
    )
    order_id = cur.lastrowid
    conn.commit()

    # 模擬儲值：直接入帳
    if method == "mock":
        order = dict(conn.execute("SELECT * FROM payment_orders WHERE id = ?", (order_id,)).fetchone())
        new_points = _credit_order(conn, order, "mock")
        conn.commit()
        conn.close()
        return {
            "success": True,
            "mode": "mock",
            "order_no": order_no,
            "new_points": new_points,
            "message": "模擬儲值成功",
        }

    # 真實金流
    if not stripe or not STRIPE_SECRET_KEY:
        conn.close()
        raise HTTPException(400, "尚未設定 Stripe 金鑰，請先設定 .env 的 STRIPE_SECRET_KEY，或改用模擬儲值")

    pm_types = STRIPE_METHOD_MAP.get(method, ["card"])
    # Stripe 金額單位：零小數幣別用原值，否則 *100
    zero_decimal = PAYMENT_CURRENCY.upper() in {"JPY", "KRW", "TWD", "VND"}
    unit_amount = int(round(amount_money)) if zero_decimal else int(round(amount_money * 100))

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=pm_types,
            line_items=[{
                "price_data": {
                    "currency": PAYMENT_CURRENCY.lower(),
                    "product_data": {
                        "name": f"遊戲幣 {req.amount} pt",
                        "description": f"訂單 {order_no}",
                    },
                    "unit_amount": unit_amount,
                },
                "quantity": 1,
            }],
            success_url=f"{FRONTEND_URL}/recharge?status=success&order_no={order_no}&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/recharge?status=cancel&order_no={order_no}",
            metadata={
                "order_no": order_no,
                "user_id": str(user["id"]),
                "points": str(req.amount),
            },
            client_reference_id=order_no,
        )
    except Exception as e:
        conn.close()
        raise HTTPException(400, f"建立支付失敗：{e}")

    conn.execute(
        "UPDATE payment_orders SET provider_session_id = ? WHERE id = ?",
        (session.id, order_id)
    )
    conn.commit()
    conn.close()
    return {
        "success": True,
        "mode": "redirect",
        "order_no": order_no,
        "checkout_url": session.url,
        "session_id": session.id,
    }


@app.post("/api/payments/confirm")
def confirm_payment(order_no: str = Query(...), session_id: str = Query(""), user: dict = Depends(require_member)):
    """付款成功導回後呼叫，向 Stripe 確認並入帳（冪等）"""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM payment_orders WHERE order_no = ? AND user_id = ?",
        (order_no, user["id"])
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "訂單不存在")
    order = dict(row)

    if order["status"] == "paid":
        u = conn.execute("SELECT points FROM users WHERE id = ?", (user["id"],)).fetchone()
        conn.close()
        return {"success": True, "already_paid": True, "new_points": u["points"], "order_no": order_no}

    if order["provider"] != "stripe":
        conn.close()
        raise HTTPException(400, "此訂單不是線上支付")

    if not stripe or not STRIPE_SECRET_KEY:
        conn.close()
        raise HTTPException(400, "Stripe 未設定")

    sid = session_id or order.get("provider_session_id") or ""
    if not sid:
        conn.close()
        raise HTTPException(400, "缺少付款工作階段 ID")

    try:
        session = stripe.checkout.Session.retrieve(sid)
    except Exception as e:
        conn.close()
        raise HTTPException(400, f"查詢付款狀態失敗：{e}")

    if session.payment_status != "paid":
        conn.close()
        raise HTTPException(400, f"付款尚未完成（狀態：{session.payment_status}）")

    new_points = _credit_order(conn, order, session.payment_intent)
    conn.commit()
    conn.close()
    return {"success": True, "new_points": new_points, "order_no": order_no}


@app.post("/api/payments/webhook")
async def stripe_webhook(request: Request):
    """Stripe Webhook（正式環境建議用這個入帳，比前端 confirm 更可靠）"""
    if not stripe or not STRIPE_SECRET_KEY:
        raise HTTPException(400, "Stripe 未設定")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
        except Exception as e:
            raise HTTPException(400, f"Webhook 驗證失敗：{e}")
    else:
        # 未設 webhook secret 時僅供本機除錯，正式環境務必設定
        event = json.loads(payload)

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        order_no = (session.get("metadata") or {}).get("order_no") or session.get("client_reference_id")
        if order_no and session.get("payment_status") == "paid":
            conn = get_db()
            row = conn.execute("SELECT * FROM payment_orders WHERE order_no = ?", (order_no,)).fetchone()
            if row and row["status"] != "paid":
                _credit_order(conn, dict(row), session.get("payment_intent"))
                conn.commit()
            conn.close()
    return {"received": True}


@app.get("/api/payments/orders")
def my_payment_orders(user: dict = Depends(require_member), limit: int = 30):
    conn = get_db()
    rows = conn.execute(
        """SELECT order_no, method, amount_points, amount_money, currency, status, created_at, paid_at
           FROM payment_orders WHERE user_id = ? ORDER BY id DESC LIMIT ?""",
        (user["id"], limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ==================== 管理控台 ====================

@app.post("/api/admin/pools")
def admin_create_pool(
    name: str = Form(...),
    description: str = Form(""),
    intro_type: str = Form("image"),
    cost_single: int = Form(100),
    cost_ten: int = Form(900),
    total_quantity: int = Form(...),
    image: Optional[UploadFile] = File(None),
    admin: dict = Depends(require_admin)
):
    if total_quantity <= 0:
        raise HTTPException(400, "獎池總數量必須大於 0")

    image_url = None
    if image and image.filename:
        image_url = save_image(image, "pool")

    conn = get_db()
    # 新獎池排在最後
    max_order = conn.execute("SELECT COALESCE(MAX(sort_order), -1) as m FROM pools").fetchone()["m"]
    cur = conn.execute(
        """INSERT INTO pools (name, description, image_url, intro_type, cost_single, cost_ten,
                              total_quantity, remaining_quantity, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (name, description, image_url, intro_type, cost_single, cost_ten,
         total_quantity, total_quantity, max_order + 1)
    )
    conn.commit()
    pool_id = cur.lastrowid
    conn.close()
    return {"id": pool_id, "message": "獎池建立成功"}

@app.put("/api/admin/pools/{pool_id}")
def admin_update_pool(
    pool_id: int,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    intro_type: Optional[str] = Form(None),
    cost_single: Optional[int] = Form(None),
    cost_ten: Optional[int] = Form(None),
    total_quantity: Optional[int] = Form(None),
    is_active: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    admin: dict = Depends(require_admin)
):
    conn = get_db()
    pool = conn.execute("SELECT * FROM pools WHERE id = ?", (pool_id,)).fetchone()
    if not pool:
        conn.close()
        raise HTTPException(404, "獎池不存在")

    updates = []
    params = []
    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if description is not None:
        updates.append("description = ?")
        params.append(description)
    if intro_type is not None:
        updates.append("intro_type = ?")
        params.append(intro_type)
    if cost_single is not None:
        updates.append("cost_single = ?")
        params.append(cost_single)
    if cost_ten is not None:
        updates.append("cost_ten = ?")
        params.append(cost_ten)
    if is_active is not None:
        updates.append("is_active = ?")
        params.append(is_active)
    if total_quantity is not None:
        if total_quantity <= 0:
            conn.close()
            raise HTTPException(400, "獎池總數量必須大於 0")
        cards_sum = conn.execute(
            "SELECT COALESCE(SUM(total_quantity), 0) as s FROM cards WHERE pool_id = ?", (pool_id,)
        ).fetchone()["s"]
        if total_quantity < cards_sum:
            conn.close()
            raise HTTPException(400, f"總數量不可小於已設定卡面總數（{cards_sum}）")
        drawn = pool["total_quantity"] - pool["remaining_quantity"]
        new_remaining = max(0, total_quantity - drawn)
        updates.append("total_quantity = ?")
        params.append(total_quantity)
        updates.append("remaining_quantity = ?")
        params.append(new_remaining)
    if image and image.filename:
        updates.append("image_url = ?")
        params.append(save_image(image, "pool"))

    if updates:
        params.append(pool_id)
        conn.execute(f"UPDATE pools SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    conn.close()
    return {"message": "更新成功"}


@app.post("/api/admin/pools/{pool_id}/move")
def admin_move_pool(pool_id: int, direction: str = Query(..., description="up 往前 / down 往後"),
                    admin: dict = Depends(require_admin)):
    """與相鄰獎池交換順序。立即寫入，前台獎池列表會同步。"""
    if direction not in ("up", "down"):
        raise HTTPException(400, "direction 必須是 up 或 down")

    conn = get_db()
    pools = [dict(r) for r in conn.execute(
        "SELECT id, sort_order FROM pools ORDER BY sort_order ASC, id ASC"
    ).fetchall()]
    idx = next((i for i, p in enumerate(pools) if p["id"] == pool_id), None)
    if idx is None:
        conn.close()
        raise HTTPException(404, "獎池不存在")

    swap_with = idx - 1 if direction == "up" else idx + 1
    if swap_with < 0 or swap_with >= len(pools):
        conn.close()
        return {"message": "已在最前" if direction == "up" else "已在最後", "moved": False}

    # 重新編成連續序號後交換，避免舊資料 sort_order 重複
    ordered = [p["id"] for p in pools]
    ordered[idx], ordered[swap_with] = ordered[swap_with], ordered[idx]
    for i, pid in enumerate(ordered):
        conn.execute("UPDATE pools SET sort_order = ? WHERE id = ?", (i, pid))
    conn.commit()
    conn.close()
    return {"message": "排序已更新", "moved": True}


# ==================== 管理控台 卡面 ====================

@app.post("/api/admin/pools/{pool_id}/cards")
def admin_add_card(
    pool_id: int,
    name: str = Form(...),
    total_quantity: int = Form(...),
    original_probability: Optional[float] = Form(None),
    image: Optional[UploadFile] = File(None),
    admin: dict = Depends(require_admin)
):
    if total_quantity <= 0:
        raise HTTPException(400, "卡面數量必須大於 0")

    conn = get_db()
    pool = conn.execute("SELECT * FROM pools WHERE id = ?", (pool_id,)).fetchone()
    if not pool:
        conn.close()
        raise HTTPException(404, "獎池不存在")

    # 檢查總卡面數量不超過獎池總量
    current_sum = conn.execute(
        "SELECT COALESCE(SUM(total_quantity), 0) as s FROM cards WHERE pool_id = ?", (pool_id,)
    ).fetchone()["s"]
    if current_sum + total_quantity > pool["total_quantity"]:
        conn.close()
        raise HTTPException(400, f"卡面總數將超過獎池上限（目前已設定 {current_sum}，上限 {pool['total_quantity']}）")

    image_url = None
    if image and image.filename:
        image_url = save_image(image, "card")

    # 若未指定概率，依數量佔總量比例計算
    prob = original_probability
    if prob is None:
        prob = total_quantity / pool["total_quantity"] if pool["total_quantity"] > 0 else 0

    cur = conn.execute(
        """INSERT INTO cards (pool_id, name, image_url, total_quantity, remaining_quantity, original_probability)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (pool_id, name, image_url, total_quantity, total_quantity, prob)
    )
    conn.commit()
    card_id = cur.lastrowid
    conn.close()
    return {"id": card_id, "message": "卡面新增成功"}

@app.get("/api/admin/pools/{pool_id}/cards")
def admin_list_cards(pool_id: int, admin: dict = Depends(require_admin)):
    conn = get_db()
    pool = conn.execute("SELECT * FROM pools WHERE id = ?", (pool_id,)).fetchone()
    if not pool:
        conn.close()
        raise HTTPException(404, "獎池不存在")
    cards = conn.execute(
        "SELECT id, name, image_url, total_quantity, remaining_quantity, original_probability FROM cards WHERE pool_id = ? ORDER BY id",
        (pool_id,)
    ).fetchall()
    conn.close()
    return {
        "pool": dict(pool),
        "cards": [dict(c) for c in cards]
    }

@app.put("/api/admin/cards/{card_id}")
def admin_update_card(
    card_id: int,
    name: Optional[str] = Form(None),
    total_quantity: Optional[int] = Form(None),
    original_probability: Optional[float] = Form(None),
    image: Optional[UploadFile] = File(None),
    admin: dict = Depends(require_admin)
):
    """修改卡面：名稱、總張數、概率、圖片"""
    conn = get_db()
    card = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    if not card:
        conn.close()
        raise HTTPException(404, "卡面不存在")

    pool = conn.execute("SELECT * FROM pools WHERE id = ?", (card["pool_id"],)).fetchone()
    updates = []
    params = []

    if name is not None:
        updates.append("name = ?")
        params.append(name)

    if total_quantity is not None:
        if total_quantity <= 0:
            conn.close()
            raise HTTPException(400, "卡面數量必須大於 0")
        drawn = card["total_quantity"] - card["remaining_quantity"]
        if total_quantity < drawn:
            conn.close()
            raise HTTPException(400, f"總數不可小於已抽出數量（{drawn}）")
        # 檢查獎池上限
        other_sum = conn.execute(
            "SELECT COALESCE(SUM(total_quantity), 0) as s FROM cards WHERE pool_id = ? AND id != ?",
            (card["pool_id"], card_id)
        ).fetchone()["s"]
        if other_sum + total_quantity > pool["total_quantity"]:
            conn.close()
            raise HTTPException(400, f"卡面總數將超過獎池上限（上限 {pool['total_quantity']}）")
        new_remaining = total_quantity - drawn
        updates.append("total_quantity = ?")
        params.append(total_quantity)
        updates.append("remaining_quantity = ?")
        params.append(new_remaining)

    if original_probability is not None:
        updates.append("original_probability = ?")
        params.append(original_probability)

    if image and image.filename:
        updates.append("image_url = ?")
        params.append(save_image(image, "card"))

    if updates:
        params.append(card_id)
        conn.execute(f"UPDATE cards SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    conn.close()
    return {"message": "卡面更新成功"}

@app.delete("/api/admin/cards/{card_id}")
def admin_delete_card(card_id: int, admin: dict = Depends(require_admin)):
    conn = get_db()
    card = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    if not card:
        conn.close()
        raise HTTPException(404, "卡面不存在")
    drawn = card["total_quantity"] - card["remaining_quantity"]
    if drawn > 0:
        conn.close()
        raise HTTPException(400, f"此卡面已抽出 {drawn} 張，無法刪除（可改將剩餘設為 0）")
    conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    conn.commit()
    conn.close()
    return {"message": "卡面已刪除"}

@app.delete("/api/admin/pools/{pool_id}")
def admin_delete_pool(pool_id: int, admin: dict = Depends(require_admin)):
    conn = get_db()
    pool = conn.execute("SELECT * FROM pools WHERE id = ?", (pool_id,)).fetchone()
    if not pool:
        conn.close()
        raise HTTPException(404, "獎池不存在")
    drawn = pool["total_quantity"] - pool["remaining_quantity"]
    if drawn > 0:
        conn.close()
        raise HTTPException(400, f"此獎池已有 {drawn} 次抽出紀錄，請改為關閉（is_active=0）而非刪除")
    conn.execute("DELETE FROM cards WHERE pool_id = ?", (pool_id,))
    conn.execute("DELETE FROM pools WHERE id = ?", (pool_id,))
    conn.commit()
    conn.close()
    return {"message": "獎池已刪除"}

@app.post("/api/admin/recharge")
def admin_recharge(req: RechargeRequest, admin: dict = Depends(require_admin)):
    if not req.user_id:
        raise HTTPException(400, "請指定 user_id")
    if req.amount == 0:
        raise HTTPException(400, "金額不可為 0")

    conn = get_db()
    target = conn.execute("SELECT * FROM users WHERE id = ?", (req.user_id,)).fetchone()
    if not target:
        conn.close()
        raise HTTPException(404, "使用者不存在")

    new_points = target["points"] + req.amount
    if new_points < 0:
        conn.close()
        raise HTTPException(400, "扣點後點數不可為負")

    tx_type = "admin_recharge" if req.amount > 0 else "admin_deduct"
    conn.execute("UPDATE users SET points = ? WHERE id = ?", (new_points, req.user_id))
    conn.execute(
        "INSERT INTO transactions (user_id, type, amount, balance_after, note, operator_id) VALUES (?, ?, ?, ?, ?, ?)",
        (req.user_id, tx_type, req.amount, new_points, req.note or "管理員手動操作", admin["id"])
    )
    conn.commit()
    conn.close()
    return {"success": True, "new_points": new_points}

@app.post("/api/admin/test-recharge")
def admin_test_recharge(req: RechargeRequest, admin: dict = Depends(require_admin)):
    """系統測試儲值：給指定使用者加點"""
    if not req.user_id:
        raise HTTPException(400, "請指定 user_id")
    if req.amount <= 0:
        raise HTTPException(400, "測試儲值金額必須大於 0")

    conn = get_db()
    target = conn.execute("SELECT * FROM users WHERE id = ?", (req.user_id,)).fetchone()
    if not target:
        conn.close()
        raise HTTPException(404, "使用者不存在")

    new_points = target["points"] + req.amount
    conn.execute("UPDATE users SET points = ? WHERE id = ?", (new_points, req.user_id))
    conn.execute(
        "INSERT INTO transactions (user_id, type, amount, balance_after, note, operator_id) VALUES (?, 'test_recharge', ?, ?, ?, ?)",
        (req.user_id, req.amount, new_points, req.note or "系統測試儲值", admin["id"])
    )
    conn.commit()
    conn.close()
    return {"success": True, "new_points": new_points}

@app.get("/api/admin/users")
def admin_list_users(admin: dict = Depends(require_admin)):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, username, email, role, points, created_at FROM users ORDER BY id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/admin/transactions")
def admin_transactions(
    user_id: Optional[int] = None,
    limit: int = 100,
    admin: dict = Depends(require_admin)
):
    conn = get_db()
    if user_id:
        rows = conn.execute(
            "SELECT t.*, u.username FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.user_id = ? ORDER BY t.id DESC LIMIT ?",
            (user_id, limit)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT t.*, u.username FROM transactions t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.id DESC LIMIT ?",
            (limit,)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/admin/draw-records")
def admin_draw_records(limit: int = 100, admin: dict = Depends(require_admin)):
    conn = get_db()
    rows = conn.execute("""
        SELECT dr.*, u.username, p.name as pool_name
        FROM draw_records dr
        LEFT JOIN users u ON dr.user_id = u.id
        LEFT JOIN pools p ON dr.pool_id = p.id
        ORDER BY dr.id DESC LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["results"] = json.loads(d.pop("result_json") or "[]")
        result.append(d)
    return result

# ==================== 獎品兌換 & 出貨 ====================

class RedeemCoinsRequest(BaseModel):
    cards: List[dict]

class ExtractRequest(BaseModel):
    cards: List[dict]
    recipient: str
    phone: str
    address: str
    shipping_method: str = "cod"

class ShippingUpdateRequest(BaseModel):
    status: Optional[str] = None
    packaging_note: Optional[str] = None
    company: Optional[str] = None
    tracking: Optional[str] = None

@app.post("/api/my/redeem-to-coins")
def redeem_to_coins(req: RedeemCoinsRequest, user: dict = Depends(require_member)):
    if not req.cards:
        raise HTTPException(400, "請選擇至少一張卡片")
    coins_per_card = 50
    total = len(req.cards) * coins_per_card
    conn = get_db()
    new_points = user["points"] + total
    conn.execute("UPDATE users SET points = ? WHERE id = ?", (new_points, user["id"]))
    conn.execute(
        "INSERT INTO transactions (user_id, type, amount, balance_after, note) VALUES (?, 'redeem', ?, ?, ?)",
        (user["id"], total, new_points, f"兌換抽獎幣 x{len(req.cards)}")
    )
    for c in req.cards:
        key = c.get("key")
        if key:
            conn.execute(
                "INSERT OR IGNORE INTO redeemed_cards (user_id, card_key, redeem_type) VALUES (?, ?, 'coins')",
                (user["id"], key)
            )
    conn.commit()
    conn.close()
    return {"success": True, "added_points": total, "new_points": new_points}

@app.post("/api/my/extract-cards")
def extract_cards(req: ExtractRequest, user: dict = Depends(require_member)):
    if not req.cards or not req.recipient or not req.phone or not req.address:
        raise HTTPException(400, "請填寫完整資訊")
    import datetime
    order_no = f"ORD-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    pool_name = req.cards[0].get("pool_name") or "未知獎池"
    pool_id = req.cards[0].get("pool_id")
    items_json = json.dumps(req.cards, ensure_ascii=False)
    conn = get_db()
    conn.execute("""
        INSERT INTO shipping_orders (order_no, user_id, pool_id, pool_name, items_json, recipient, phone, address, shipping_method, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')
    """, (order_no, user["id"], pool_id, pool_name, items_json, req.recipient, req.phone, req.address, req.shipping_method))
    for c in req.cards:
        key = c.get("key")
        if key:
            conn.execute(
                "INSERT OR IGNORE INTO redeemed_cards (user_id, card_key, redeem_type) VALUES (?, ?, 'extract')",
                (user["id"], key)
            )
    conn.commit()
    conn.close()
    return {"success": True, "order_no": order_no}

@app.get("/api/my/redeemed-keys")
def my_redeemed_keys(user: dict = Depends(require_member)):
    conn = get_db()
    rows = conn.execute(
        "SELECT card_key FROM redeemed_cards WHERE user_id = ?",
        (user["id"],)
    ).fetchall()
    conn.close()
    return [r["card_key"] for r in rows]

@app.get("/api/my/shippings")
def my_shippings(user: dict = Depends(require_member)):
    conn = get_db()
    rows = conn.execute("""
        SELECT order_no, pool_name, items_json, status, packaging_note, company, tracking, created_at
        FROM shipping_orders WHERE user_id = ? ORDER BY id DESC
    """, (user["id"],)).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        items = json.loads(d.pop("items_json") or "[]")
        d["items"] = ", ".join([i.get("name", "") for i in items]) or "—"
        dt = d.get("created_at")
        if dt is None:
            dt_str = ""
        elif hasattr(dt, "strftime"):
            # Postgres datetime 是 UTC，轉成 Asia/Taipei (+8)
            from datetime import timezone, timedelta
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            dt_local = dt.astimezone(timezone(timedelta(hours=8)))
            dt_str = dt_local.strftime("%Y-%m-%d %H:%M:%S")
        else:
            dt_str = str(dt)
        d["created_at"] = dt_str
        d["fillDate"] = dt_str[:10] if len(dt_str) >= 10 else ""
        d["fillTime"] = dt_str[11:16] if len(dt_str) >= 16 else ""
        result.append(d)
    return result

@app.get("/api/admin/shippings/today")
def admin_shippings_today(admin: dict = Depends(require_admin)):
    conn = get_db()
    # SQLite：用 UTC+8 判斷今天
    rows = conn.execute("""
        SELECT s.*, u.username
        FROM shipping_orders s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE date(s.created_at, '+8 hours') = date('now', '+8 hours')
           OR date(s.created_at) = date('now', 'localtime')
        ORDER BY s.id DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/admin/shippings")
def admin_shippings(start: Optional[str] = None, end: Optional[str] = None, admin: dict = Depends(require_admin)):
    conn = get_db()
    query = """
        SELECT s.order_no, s.pool_name, s.items_json, s.status, s.company, s.tracking,
               s.packaging_note, s.recipient, s.phone, s.address, s.created_at, u.username
        FROM shipping_orders s LEFT JOIN users u ON s.user_id = u.id WHERE 1=1
    """
    params = []
    if start:
        query += " AND date(s.created_at, '+8 hours') >= ?"
        params.append(start)
    if end:
        query += " AND date(s.created_at, '+8 hours') <= ?"
        params.append(end)
    query += " ORDER BY s.id DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        raw_items = d.pop("items_json", None) or "[]"
        try:
            items = json.loads(raw_items) if isinstance(raw_items, str) else (raw_items or [])
        except Exception:
            items = []
        d["items"] = ", ".join([i.get("name", "") for i in items]) if isinstance(items, list) else "—"
        dt = d.get("created_at")
        dt_str = str(dt) if dt else ""
        d["created_at"] = dt_str
        d["fillDate"] = dt_str[:10] if len(dt_str) >= 10 else ""
        d["fillTime"] = dt_str[11:16] if len(dt_str) >= 16 else ""
        result.append(d)
    return result

@app.put("/api/admin/shippings/{order_no}")
def admin_update_shipping(order_no: str, req: ShippingUpdateRequest, admin: dict = Depends(require_admin)):
    conn = get_db()
    updates = []
    params = []
    if req.status is not None:
        updates.append("status = ?"); params.append(req.status)
    if req.packaging_note is not None:
        updates.append("packaging_note = ?"); params.append(req.packaging_note)
    if req.company is not None:
        updates.append("company = ?"); params.append(req.company)
    if req.tracking is not None:
        updates.append("tracking = ?"); params.append(req.tracking)
    if updates:
        updates.append("updated_at = datetime('now','localtime')")
        params.append(order_no)
        conn.execute(f"UPDATE shipping_orders SET {', '.join(updates)} WHERE order_no = ?", params)
        conn.commit()
    conn.close()
    return {"success": True}

@app.get("/api/admin/return-settings/{pool_id}")
def get_return_settings(pool_id: int, mode: str = "per_card", admin: dict = Depends(require_admin)):
    conn = get_db()
    if mode == "per_card":
        cards = conn.execute("SELECT id, name, original_probability FROM cards WHERE pool_id = ? ORDER BY id", (pool_id,)).fetchall()
        settings = {s["target_key"]: s["return_coins"] for s in conn.execute(
            "SELECT target_key, return_coins FROM card_return_settings WHERE pool_id = ? AND mode = 'per_card'", (pool_id,)
        ).fetchall()}
        result = [{"target_key": str(c["id"]), "name": c["name"], "original_prob": c["original_probability"], "return_coins": settings.get(str(c["id"]), 0)} for c in cards]
    else:
        probs = conn.execute("SELECT DISTINCT original_probability FROM cards WHERE pool_id = ? ORDER BY original_probability DESC", (pool_id,)).fetchall()
        settings = {s["target_key"]: s["return_coins"] for s in conn.execute(
            "SELECT target_key, return_coins FROM card_return_settings WHERE pool_id = ? AND mode = 'by_prob'", (pool_id,)
        ).fetchall()}
        result = [{"target_key": str(p["original_probability"]), "prob": p["original_probability"], "return_coins": settings.get(str(p["original_probability"]), 0)} for p in probs]
    conn.close()
    return result

class ReturnSettingItem(BaseModel):
    target_key: str
    target_name: Optional[str] = None
    return_coins: int

class ReturnSettingsRequest(BaseModel):
    mode: str
    items: List[ReturnSettingItem]

@app.post("/api/admin/return-settings/{pool_id}")
def save_return_settings(pool_id: int, req: ReturnSettingsRequest, admin: dict = Depends(require_admin)):
    conn = get_db()
    for item in req.items:
        conn.execute("""
            INSERT INTO card_return_settings (pool_id, mode, target_key, target_name, return_coins)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(pool_id, mode, target_key) DO UPDATE SET return_coins = excluded.return_coins, target_name = excluded.target_name
        """, (pool_id, req.mode, item.target_key, item.target_name, item.return_coins))
    conn.commit()
    conn.close()
    return {"success": True}

@app.get("/")
def root():
    return {"message": "Clove 抽卡平台 API 運行中", "docs": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
