import { json, fail } from "../_lib.js";
export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ ok: row?.ok === 1, service: "JASTIPER API" });
  } catch {
    return fail("Database belum terhubung. Periksa binding D1 dan migration.", 503);
  }
}
