const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function imgSrc(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url}`;
}
