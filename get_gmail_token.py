"""
取得 Gmail API Refresh Token 的一次性工具。

使用方式：
1. 到 Google Cloud Console 建立 OAuth 用戶端（Desktop app）
2. 下載 JSON 憑證，或手動填入 CLIENT_ID / CLIENT_SECRET
3. 執行：python get_gmail_token.py
4. 瀏覽器授權後，會印出 REFRESH_TOKEN
5. 把三個值設到 Render 環境變數
"""
import os
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

# 方式一：直接填（推薦）
CLIENT_ID = os.getenv("GMAIL_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET", "")

# 方式二：或放置從 Google Cloud 下載的 credentials.json
CREDENTIALS_FILE = "credentials.json"

def main():
    if CLIENT_ID and CLIENT_SECRET:
        flow = InstalledAppFlow.from_client_config(
            {
                "installed": {
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": ["http://localhost"],
                }
            },
            SCOPES,
        )
    elif os.path.exists(CREDENTIALS_FILE):
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
    else:
        print("請先設定 GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET，或放置 credentials.json")
        return

    creds = flow.run_local_server(port=0)
    print("\n========== 請把以下值設到環境變數 ==========")
    print(f"GMAIL_CLIENT_ID={CLIENT_ID or '（從 credentials.json 取得）'}")
    print(f"GMAIL_CLIENT_SECRET={CLIENT_SECRET or '（從 credentials.json 取得）'}")
    print(f"GMAIL_REFRESH_TOKEN={creds.refresh_token}")
    print(f"GMAIL_USER=你的Gmail@gmail.com")
    print("==========================================")

if __name__ == "__main__":
    main()
