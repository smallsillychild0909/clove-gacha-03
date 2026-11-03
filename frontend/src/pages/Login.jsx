import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // 忘記密碼流程
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: 帳號+email, 2: 驗證碼+新密碼
  const [fUsername, setFUsername] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fCode, setFCode] = useState("");
  const [fNewPwd, setFNewPwd] = useState("");
  const [fMsg, setFMsg] = useState("");
  const [fError, setFError] = useState("");
  const [fLoading, setFLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(username, password);
      navigate(user.role === "admin" ? "/admin" : "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const requestCode = async () => {
    setFLoading(true);
    setFMsg("");
    setFError("");
    try {
      const res = await api.forgotPasswordRequest({ username: fUsername, email: fEmail });
      setFMsg(res.message || "驗證碼已寄出");
      setForgotStep(2);
    } catch (err) {
      setFError(err.message);
    } finally {
      setFLoading(false);
    }
  };

  const verifyAndReset = async () => {
    if (fNewPwd.length < 6) {
      setFError("新密碼至少 6 個字元");
      return;
    }
    setFLoading(true);
    setFMsg("");
    setFError("");
    try {
      const res = await api.forgotPasswordVerify({
        username: fUsername,
        code: fCode,
        new_password: fNewPwd,
      });
      setFMsg(res.message || "密碼已更新");
      setTimeout(() => {
        setShowForgot(false);
        setForgotStep(1);
        setFUsername("");
        setFEmail("");
        setFCode("");
        setFNewPwd("");
        setFMsg("");
      }, 1500);
    } catch (err) {
      setFError(err.message);
    } finally {
      setFLoading(false);
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotStep(1);
    setFMsg("");
    setFError("");
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-2xl font-bold text-center mb-6 text-pink-300">會員登入</h1>
      <form onSubmit={handleSubmit} className="bg-dark-800/60 rounded-2xl p-6 border border-pink-900/30 space-y-4">
        {error && <div className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm">{error}</div>}
        <div>
          <label className="block text-sm text-gray-400 mb-1">帳號</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">密碼</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 font-medium transition"
        >
          {loading ? "登入中..." : "登入"}
        </button>
        <p className="text-center text-sm">
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="text-pink-400 hover:underline"
          >
            忘記密碼？
          </button>
        </p>
        <p className="text-center text-sm text-gray-400">
          還沒有帳號？ <Link to="/register" className="text-pink-400 hover:underline">立即註冊</Link>
        </p>
        <p className="text-center text-xs text-gray-600">歡迎來到 抽卡平台</p>
      </form>

      {/* 忘記密碼彈窗 */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 rounded-2xl border border-pink-900/50 w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-pink-300">忘記密碼</h3>
              <button onClick={closeForgot} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>

            {forgotStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">請輸入帳號與當初登記的 Email，系統將寄送驗證碼。</p>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">帳號</label>
                  <input
                    type="text"
                    value={fUsername}
                    onChange={(e) => setFUsername(e.target.value)}
                    className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">登記 Email</label>
                  <input
                    type="email"
                    value={fEmail}
                    onChange={(e) => setFEmail(e.target.value)}
                    className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                  />
                </div>
                {fError && <div className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm">{fError}</div>}
                <button
                  onClick={requestCode}
                  disabled={fLoading || !fUsername || !fEmail}
                  className="w-full py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 transition"
                >
                  {fLoading ? "處理中..." : "寄送驗證碼"}
                </button>
              </div>
            )}

            {forgotStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">驗證碼已寄至 {fEmail}，請輸入驗證碼與新密碼。</p>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">驗證碼</label>
                  <input
                    type="text"
                    value={fCode}
                    onChange={(e) => setFCode(e.target.value)}
                    placeholder="6 位數字"
                    className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">新密碼（至少 6 字元）</label>
                  <input
                    type="password"
                    value={fNewPwd}
                    onChange={(e) => setFNewPwd(e.target.value)}
                    className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2"
                  />
                </div>
                {fMsg && <div className="bg-green-900/40 text-green-300 px-3 py-2 rounded text-sm">{fMsg}</div>}
                {fError && <div className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm">{fError}</div>}
                <button
                  onClick={verifyAndReset}
                  disabled={fLoading}
                  className="w-full py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 transition"
                >
                  {fLoading ? "處理中..." : "確認重設密碼"}
                </button>
                <button
                  onClick={() => setForgotStep(1)}
                  className="w-full py-2 text-sm text-gray-400 hover:text-gray-300"
                >
                  重新寄送驗證碼
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
