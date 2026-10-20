import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(username, email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-2xl font-bold text-center mb-6 text-pink-300">註冊會員</h1>
      <form onSubmit={handleSubmit} className="bg-dark-800/60 rounded-2xl p-6 border border-pink-900/30 space-y-4">
        {error && <div className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm">{error}</div>}
        <div>
          <label className="block text-sm text-gray-400 mb-1">帳號</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500" required />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500" required />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">密碼（至少 6 位）</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500" required minLength={6} />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 font-medium transition">
          {loading ? "註冊中..." : "註冊"}
        </button>
        <p className="text-center text-sm text-gray-400">
          已有帳號？ <Link to="/login" className="text-pink-400 hover:underline">立即登入</Link>
        </p>
      </form>
    </div>
  );
}
