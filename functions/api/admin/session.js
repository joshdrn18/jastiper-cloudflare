import { json, fail, adminSession } from "../../_lib.js";
export async function onRequestGet({ request, env }) {
  const s = await adminSession(request, env);
  if (!s) return fail("Belum login",401);
  return json({ ok:true, csrf_token:s.csrf_token });
}
