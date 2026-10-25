import { json, fail, bodyJson, randomHex, sha256Hex, cookieHeader } from "../../_lib.js";
export async function onRequestPost({ request, env }) {
  try {
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || !env.SITE_ORIGIN)
      return fail("Secret admin belum dikonfigurasi.", 503);
    try { if (new URL(request.headers.get("Origin") || "").origin !== new URL(env.SITE_ORIGIN).origin) return fail("Origin tidak diizinkan",403); }
    catch { return fail("Origin tidak diizinkan",403); }
    const d = await bodyJson(request);
    const password = String(d.password || "");
    // Constant-time comparison using SHA-256 digests of supplied and configured password.
    const [provided, expected] = await Promise.all([sha256Hex(password), sha256Hex(env.ADMIN_PASSWORD)]);
    if (provided.length !== expected.length) return fail("Password salah", 401);
    let diff = 0;
    for (let i=0;i<provided.length;i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return fail("Password salah", 401);
    const token = randomHex(32), csrf = randomHex(24), now = Math.floor(Date.now()/1000);
    const idHash = await sha256Hex(token);
    await env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at<=?").bind(now).run();
    await env.DB.prepare("INSERT INTO admin_sessions(id_hash,csrf_token,created_at,expires_at) VALUES(?,?,?,?)")
      .bind(idHash,csrf,now,now+8*60*60).run();
    return json({ ok:true, csrf_token:csrf },200,{ "set-cookie":cookieHeader(token,8*60*60) });
  } catch { return fail("Login gagal", 500); }
}
