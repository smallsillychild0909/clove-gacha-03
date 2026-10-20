import { imgSrc } from "../utils/image";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/* 卡片背面元件 */
function CardBack({ className = "" }) {
    return (
        <div className={`relative w-full h-full rounded-xl overflow-hidden ${className}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#0f0a1a]" />
            <div className="absolute inset-0 opacity-40">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-pink-400/60 rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border border-purple-400/50 rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-pink-400 rounded-full" />
            </div>
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-pink-400/70" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-pink-400/70" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-pink-400/70" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-pink-400/70" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-3xl text-pink-300/80 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]">✦</div>
            </div>
            <div className="absolute inset-0 rounded-xl border border-pink-500/40 pointer-events-none" />
            <div className="absolute inset-[2px] rounded-lg border border-white/5 pointer-events-none" />
        </div>
    );
}

const cardVariants = {
    hidden: { opacity: 0, scale: 0.5, y: 60, rotateY: 180 },
    visible: (i) => ({
        opacity: 1,
        scale: 1,
        y: 0,
        rotateY: 0,
        transition: {
            delay: i * 0.14,
            type: "spring",
            stiffness: 220,
            damping: 18,
        },
    }),
};

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.25 } },
};

export default function PoolDetail() {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const [pool, setPool] = useState(null);
    const [loading, setLoading] = useState(true);
    const [drawing, setDrawing] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState("");
    const [animPhase, setAnimPhase] = useState("idle");
    const [lightbox, setLightbox] = useState(null); // { url, name }

    const load = () => {
        api.getPool(id)
            .then(setPool)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [id]);

    useEffect(() => {
        if (!results || animPhase !== "spinning") return;
        const t = setTimeout(() => setAnimPhase("revealing"), 2400);
        return () => clearTimeout(t);
    }, [results, animPhase]);

    const handleDraw = async (type) => {
        if (!user) {
            setError("請先登入才能抽卡");
            return;
        }
        setDrawing(true);
        setError("");
        setResults(null);
        setAnimPhase("spinning");

        try {
            const res = await api.draw({ pool_id: Number(id), draw_type: type });
            setResults(res);
            await refreshUser();
            load();
        } catch (err) {
            setError(err.message);
            setAnimPhase("idle");
        } finally {
            setDrawing(false);
        }
    };

    const closeAnimation = () => setAnimPhase("idle");

    const openLightbox = (url, name) => {
        if (url) setLightbox({ url: imgSrc(url), name });
    };

    if (loading) return <div className="text-center py-20 text-pink-300">載入中...</div>;
    if (error && !pool) return <div className="text-center py-20 text-red-400">{error}</div>;
    if (!pool) return null;

    const showOverlay = animPhase !== "idle";

    return (
        <div className="relative">
            <AnimatePresence>
                {showOverlay && (
                    <motion.div
                        key="overlay"
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md"
                    >
                        {/* 旋轉卡片召喚 */}
                        {animPhase === "spinning" && (
                            <motion.div
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex flex-col items-center gap-8"
                            >
                                <div className="relative w-80 h-80" style={{ perspective: 1200 }}>
                                    {[0, 1, 2, 3, 4].map((i) => (
                                        <motion.div
                                            key={i}
                                            className="absolute top-1/2 left-1/2 w-32 h-44 -ml-16 -mt-22"
                                            animate={{ rotateY: [0, 360] }}
                                            transition={{
                                                duration: 4,
                                                repeat: Infinity,
                                                ease: "linear",
                                                delay: i * 0.12,
                                            }}
                                            style={{
                                                transformStyle: "preserve-3d",
                                                rotateY: i * 72,
                                            }}
                                        >
                                            <div className="w-full h-full rounded-xl shadow-2xl shadow-pink-500/40">
                                                <CardBack />
                                            </div>
                                        </motion.div>
                                    ))}
                                    <motion.div
                                        className="absolute inset-0 rounded-full bg-pink-500/25 blur-3xl"
                                        animate={{ scale: [0.7, 1.3, 0.7], opacity: [0.3, 0.7, 0.3] }}
                                        transition={{ duration: 2.2, repeat: Infinity }}
                                    />
                                </div>
                                <motion.p
                                    animate={{ opacity: [0.4, 1, 0.4] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="text-2xl text-pink-300 font-semibold tracking-widest"
                                >
                                    正在召喚卡片...
                                </motion.p>
                            </motion.div>
                        )}

                        {/* 揭曉 */}
                        {animPhase === "revealing" && results && (
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-5xl mx-auto px-4 text-center"
                            >
                                <h3 className="text-2xl font-bold text-pink-300 mb-8">抽卡結果</h3>
                                <div className="flex flex-wrap justify-center gap-5">
                                    {results.results.map((r, i) => (
                                        <motion.div
                                            key={i}
                                            custom={i}
                                            variants={cardVariants}
                                            initial="hidden"
                                            animate="visible"
                                            className="w-28 sm:w-32 cursor-pointer"
                                            style={{ perspective: 1000 }}
                                            onClick={() => openLightbox(r.image_url, r.name)}
                                        >
                                            <div
                                                className="aspect-[3/4] rounded-xl overflow-hidden bg-dark-900 border-2 border-pink-500/70 shadow-xl shadow-pink-500/30"
                                                style={{ transformStyle: "preserve-3d" }}
                                            >
                                                {r.image_url ? (
                                                    <img
                                                        src={imgSrc(r.image_url)}
                                                        alt={r.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-dark-800 to-dark-900">
                                                        🎴
                                                    </div>
                                                )}
                                            </div>
                                            <p className="mt-2 text-sm text-center text-gray-200 truncate">{r.name}</p>
                                        </motion.div>
                                    ))}
                                </div>
                                <motion.button
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: results.results.length * 0.14 + 0.4 }}
                                    onClick={() => setAnimPhase("done")}
                                    className="mt-8 px-10 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 font-medium text-lg"
                                >
                                    查看結果
                                </motion.button>
                            </motion.div>
                        )}

                        {/* 完成 */}
                        {animPhase === "done" && results && (
                            <motion.div
                                initial={{ scale: 0.85, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="bg-dark-800/95 border border-pink-500/40 rounded-2xl p-7 max-w-3xl mx-4 text-center shadow-2xl"
                            >
                                <h3 className="text-2xl font-bold text-pink-300 mb-5">抽卡完成！</h3>
                                <div className="flex flex-wrap justify-center gap-3 mb-6">
                                    {results.results.map((r, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.06 }}
                                            className="w-24 cursor-pointer"
                                            onClick={() => openLightbox(r.image_url, r.name)}
                                        >
                                            <div className="aspect-[3/4] rounded-lg overflow-hidden border border-pink-500/50">
                                                {r.image_url ? (
                                                    <img src={imgSrc(r.image_url)} alt={r.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-dark-900 text-3xl">🎴</div>
                                                )}
                                            </div>
                                            <p className="text-xs mt-1 truncate text-gray-300">{r.name}</p>
                                        </motion.div>
                                    ))}
                                </div>
                                <p className="text-gray-400 mb-5">
                                    花費 {results.cost} pt · 剩餘 {results.remaining_points} pt
                                </p>
                                <button
                                    onClick={closeAnimation}
                                    className="px-10 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 font-medium"
                                >
                                    關閉
                                </button>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <Link to="/" className="text-sm text-gray-400 hover:text-pink-300 mb-4 inline-block">← 返回獎池列表</Link>

            <div className="grid md:grid-cols-2 gap-8">
                <div>
                    <div className="aspect-square rounded-2xl overflow-hidden bg-dark-800 border border-pink-900/30">
                        {pool.image_url ? (
                            <img src={imgSrc(pool.image_url)} alt={pool.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-6xl text-gray-600">🎴</div>
                        )}
                    </div>
                </div>

                <div>
                    <h1 className="text-2xl font-bold text-pink-300 mb-2">{pool.name}</h1>
                    <p className="text-gray-400 mb-4 whitespace-pre-wrap">{pool.description || "暫無介紹"}</p>

                    <div className="bg-dark-800/60 rounded-xl p-4 mb-6 border border-pink-900/20">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">剩餘 / 總數</span>
                            <span className="text-yellow-300 font-semibold">
                                {pool.remaining_quantity} / {pool.total_quantity}
                            </span>
                        </div>
                        <div className="w-full bg-dark-900 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all"
                                style={{ width: `${pool.total_quantity ? (pool.remaining_quantity / pool.total_quantity) * 100 : 0}%` }}
                            />
                        </div>
                    </div>

                    {error && <div className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm mb-4">{error}</div>}

                    <div className="flex gap-3">
                        <button
                            onClick={() => handleDraw("single")}
                            disabled={drawing || pool.remaining_quantity < 1}
                            className="flex-1 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 font-medium transition"
                        >
                            {drawing ? "抽卡中..." : `單抽 ${pool.cost_single} pt`}
                        </button>
                        <button
                            onClick={() => handleDraw("ten")}
                            disabled={drawing || pool.remaining_quantity < 10}
                            className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 font-medium transition"
                        >
                            {drawing ? "抽卡中..." : `十連 ${pool.cost_ten} pt`}
                        </button>
                    </div>

                    {!user && (
                        <p className="text-center text-sm text-gray-500 mt-3">
                            <Link to="/login" className="text-pink-400">登入</Link> 後即可開始抽卡
                        </p>
                    )}
                </div>
            </div>

            {results && animPhase === "idle" && (
                <div className="mt-10">
                    <h2 className="text-xl font-semibold text-pink-300 mb-4">抽卡結果</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                        {results.results.map((r, i) => (
                            <div
                                key={i}
                                className="bg-dark-800 rounded-xl overflow-hidden border border-pink-500/30 cursor-pointer"
                                onClick={() => openLightbox(r.image_url, r.name)}
                            >
                                <div className="aspect-square bg-dark-900">
                                    {r.image_url ? (
                                        <img src={imgSrc(r.image_url)} alt={r.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-3xl">🎴</div>
                                    )}
                                </div>
                                <div className="p-2 text-center text-sm truncate">{r.name}</div>
                            </div>
                        ))}
                    </div>
                    <p className="text-center text-gray-400 mt-4">
                        花費 {results.cost} pt · 剩餘 {results.remaining_points} pt
                    </p>
                </div>
            )}

            {pool.cards && pool.cards.length > 0 && (
                <div className="mt-12">
                    <h2 className="text-xl font-semibold mb-4 text-gray-300">獎池內容</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {pool.cards.map((c) => (
                            <div
                                key={c.id}
                                className="bg-dark-800/40 rounded-xl overflow-hidden border border-gray-800 cursor-pointer"
                                onClick={() => openLightbox(c.image_url, c.name)}
                            >
                                <div className="aspect-square bg-dark-900">
                                    {c.image_url ? (
                                        <img src={imgSrc(c.image_url)} alt={c.name} className="w-full h-full object-cover opacity-80" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-2xl text-gray-600">🎴</div>
                                    )}
                                </div>
                                <div className="p-2">
                                    <div className="text-sm truncate">{c.name}</div>
                                    <div className="text-xs text-gray-500">
                                        剩 {c.remaining_quantity}/{c.total_quantity}
                                        {c.original_probability != null && (
                                            <span> · {(Number(c.original_probability) * 100).toFixed(7).replace(/\.?0+$/, "")}%</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 圖片放大 Lightbox */}
            <AnimatePresence>
                {lightbox && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                        onClick={() => setLightbox(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="relative max-w-4xl max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={lightbox.url}
                                alt={lightbox.name}
                                className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border-2 border-pink-500/40"
                            />
                            <p className="text-center text-pink-200 mt-4 text-lg font-medium">{lightbox.name}</p>
                            <button
                                onClick={() => setLightbox(null)}
                                className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-dark-800 border border-pink-500/50 text-pink-300 text-xl flex items-center justify-center hover:bg-pink-600 hover:text-white transition"
                            >
                                ×
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
