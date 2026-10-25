import { json, fail } from "../_lib.js";
export async function onRequestGet({ env }) {
  try {
    const [settings, categories] = await Promise.all([
      env.DB.prepare("SELECT key,value FROM site_settings").all(),
      env.DB.prepare("SELECT id,name,slug FROM categories WHERE is_active=1 ORDER BY name").all()
    ]);
    const s = Object.fromEntries((settings.results || []).map(x => [x.key, x.value]));
    return json({ ok: true, store: {
      name: env.STORE_NAME || s.store_name || "JASTIPER",
      tagline: s.tagline || "Titip Mudah, Belanja Praktis.",
      shipping_fee: Math.max(0, Number(s.shipping_fee) || 0),
      payment_instructions: s.payment_instructions || "Hubungi admin untuk detail pembayaran.",
      whatsapp: s.whatsapp || ""
    }, categories: categories.results || [] });
  } catch { return fail("Gagal memuat pengaturan toko", 500); }
}
