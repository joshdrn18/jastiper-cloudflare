import { json, fail, adminSession, sameOrigin, clearCookie } from "../../_lib.js";
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request,env)) return fail("Origin tidak diizinkan",403);
  const s = await adminSession(request,env);
  if (s) await env.DB.prepare("DELETE FROM admin_sessions WHERE id_hash=?").bind(s.id_hash).run();
  return json({ok:true},200,{"set-cookie":clearCookie()});
}
