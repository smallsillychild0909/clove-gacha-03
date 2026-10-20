"""
資料庫模組：自動支援
- 本機：SQLite（不設 DATABASE_URL 時）
- 線上：Supabase / Postgres（設定 DATABASE_URL 環境變數時）

Supabase 使用方式：
1. 在 Supabase 建立專案
2. 到 Project Settings → Database → Connection string（URI）
3. 複製並設為環境變數 DATABASE_URL
4. 在 Supabase SQL Editor 執行同目錄的 supabase_schema.sql
"""
import os
import sqlite3
from pathlib import Path
from typing import Any, Optional

DB_PATH = Path(__file__).parent / "clove.db"
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

USE_POSTGRES = bool(DATABASE_URL)

# ---------- Postgres 連線 ----------
def _get_pg_conn():
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except ImportError:
        raise RuntimeError("請安裝 psycopg2-binary：pip install psycopg2-binary")

    # Supabase 連線字串有時需要 sslmode
    url = DATABASE_URL
    if "sslmode" not in url:
        sep = "&" if "?" in url else "?"
        url = url + sep + "sslmode=require"

    conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
    conn.autocommit = False
    return conn


class _CompatCursor:
    """讓 Postgres cursor 行為接近 sqlite3（支援 lastrowid、dict row）"""
    def __init__(self, raw_cur, is_pg: bool):
        self._cur = raw_cur
        self.is_pg = is_pg
        self.lastrowid: Optional[int] = None

    def execute(self, sql: str, params=None):
        is_insert_returning = False
        if self.is_pg:
            sql = sql.replace("?", "%s")
            upper = sql.strip().upper()
            # 只有 INSERT 才自動加 RETURNING 並取 lastrowid
            if (upper.startswith("INSERT")
                    and "RETURNING" not in upper
                    and any(t in upper for t in ("INTO USERS", "INTO POOLS", "INTO CARDS", "INTO DRAW_RECORDS", "INTO TRANSACTIONS"))):
                sql = sql.rstrip().rstrip(";") + " RETURNING id"
                is_insert_returning = True

        self._cur.execute(sql, params or ())

        if self.is_pg and is_insert_returning:
            try:
                row = self._cur.fetchone()
                if row and "id" in row:
                    self.lastrowid = row["id"]
            except Exception:
                pass
        elif not self.is_pg:
            self.lastrowid = getattr(self._cur, "lastrowid", None)

        return self

    def fetchone(self):
        row = self._cur.fetchone()
        if row is None:
            return None
        return dict(row) if not isinstance(row, dict) else row

    def fetchall(self):
        rows = self._cur.fetchall()
        return [dict(r) if not isinstance(r, dict) else r for r in rows]

    def close(self):
        try:
            self._cur.close()
        except Exception:
            pass


class _CompatConn:
    """統一介面：execute / commit / rollback / close"""
    def __init__(self, raw, is_pg: bool):
        self._raw = raw
        self.is_pg = is_pg

    def execute(self, sql: str, params=None):
        cur = self._raw.cursor()
        return _CompatCursor(cur, self.is_pg).execute(sql, params)

    def cursor(self):
        return _CompatCursor(self._raw.cursor(), self.is_pg)

    def commit(self):
        self._raw.commit()

    def rollback(self):
        try:
            self._raw.rollback()
        except Exception:
            pass

    def close(self):
        try:
            self._raw.close()
        except Exception:
            pass


def get_db() -> _CompatConn:
    if USE_POSTGRES:
        return _CompatConn(_get_pg_conn(), is_pg=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return _CompatConn(conn, is_pg=False)


def init_db():
    """本機 SQLite 自動建表；Postgres 請手動執行 supabase_schema.sql"""
    if USE_POSTGRES:
        print("使用 Supabase / Postgres（請確認已執行 supabase_schema.sql）")
        # 嘗試建立預設帳號（若表已存在）
        try:
            _seed_default_users()
        except Exception as e:
            print(f"預設帳號建立略過（表可能尚未建立）: {e}")
        return

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        points INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS pools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        intro_type TEXT DEFAULT 'image',
        cost_single INTEGER NOT NULL DEFAULT 100,
        cost_ten INTEGER NOT NULL DEFAULT 900,
        total_quantity INTEGER NOT NULL DEFAULT 0,
        remaining_quantity INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pool_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        image_url TEXT,
        total_quantity INTEGER NOT NULL DEFAULT 0,
        remaining_quantity INTEGER NOT NULL DEFAULT 0,
        original_probability REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS draw_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        pool_id INTEGER NOT NULL,
        card_id INTEGER,
        draw_type TEXT NOT NULL,
        cost_points INTEGER NOT NULL,
        result_json TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (pool_id) REFERENCES pools(id),
        FOREIGN KEY (card_id) REFERENCES cards(id)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        note TEXT,
        operator_id INTEGER,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    conn.commit()
    _seed_default_users(conn)
    conn.close()
    print("SQLite 資料庫初始化完成")


def _seed_default_users(conn=None):
    close = False
    if conn is None:
        conn = get_db()
        close = True
    try:
        import bcrypt
        # admin
        cur = conn.execute("SELECT id FROM users WHERE username = 'admin'")
        if not cur.fetchone():
            hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
            conn.execute(
                "INSERT INTO users (username, email, password_hash, role, points) VALUES (?, ?, ?, ?, ?)",
                ("admin", "admin@clove.local", hashed, "admin", 0)
            )
        # user
        cur = conn.execute("SELECT id FROM users WHERE username = 'user'")
        if not cur.fetchone():
            hashed = bcrypt.hashpw(b"user123", bcrypt.gensalt()).decode()
            conn.execute(
                "INSERT INTO users (username, email, password_hash, role, points) VALUES (?, ?, ?, ?, ?)",
                ("user", "user@clove.local", hashed, "member", 10000)
            )
        conn.commit()
        print("預設帳號已就緒（admin / user）")
    finally:
        if close:
            conn.close()


if __name__ == "__main__":
    init_db()
