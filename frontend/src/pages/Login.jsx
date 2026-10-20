import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
        <p className="text-center text-sm text-gray-400">
          還沒有帳號？ <Link to="/register" className="text-pink-400 hover:underline">立即註冊</Link>
        </p>
        <p className="text-center text-xs text-gray-600">歡迎來到 抽卡平台</p>
      </form>
    </div>
  );
}
