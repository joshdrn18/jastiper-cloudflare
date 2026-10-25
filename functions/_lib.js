const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()"
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...JSON_HEADERS, ...extra }
  });
}
export function fail(message, status = 400) { return json({ ok: false, error: message }, status); }
export async function bodyJson(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error("Content-Type harus application/json");
  const text = await request.text();
  if (text.length > 100_000) throw new Error("Request terlalu besar");
  return JSON.parse(text);
}
export function normPhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? "62" + digits.slice(1) : digits;
}
export function slugify(input) {
  return String(input || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "produk";
}
export function validImageUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u.href.slice(0, 1500);
  } catch { return null; }
}
export function sameOrigin(request, env) {
  const origin = request.headers.get("Origin");
  const expected = env.SITE_ORIGIN;
  if (!origin || !expected) return false;
  try { return new URL(origin).origin === new URL(expected).origin; } catch { return false; }
}
export function cookieMap(request) {
  const out = {};
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}
export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}
export function randomHex(bytes = 32) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return [...arr].map(x => x.toString(16).padStart(2, "0")).join("");
}
export async function adminSession(request, env) {
  const token = cookieMap(request).jst_session;
  if (!token) return null;
  const idHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT id_hash, csrf_token, expires_at FROM admin_sessions WHERE id_hash=? AND expires_at>?")
    .bind(idHash, now).first();
  return row ? { ...row, token } : null;
}
export async function requireAdmin(request, env, requireCsrf = true) {
  const session = await adminSession(request, env);
  if (!session) return { error: fail("Login diperlukan", 401) };
  if (!sameOrigin(request, env)) return { error: fail("Origin tidak diizinkan", 403) };
  if (requireCsrf && request.headers.get("X-CSRF-Token") !== session.csrf_token)
    return { error: fail("Token keamanan tidak valid", 403) };
  return { session };
}
export function cookieHeader(value, maxAge) {
  return `jst_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
export function clearCookie() {
  return "jst_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}
export function errorResponse(error) {
  const message = String(error?.message || "Terjadi kesalahan");
  if (message.includes("DATA_") || message.includes("KERANJANG") || message.includes("JUMLAH_") ||
      message.includes("BARANG_") || message.includes("STOK_") || message.includes("TRANSISI_"))
    return fail(message, 400);
  return fail("Terjadi kesalahan server", 500);
}
