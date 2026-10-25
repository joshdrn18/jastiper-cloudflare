import { json, fail, bodyJson, normPhone } from "../_lib.js";
export async function onRequestPost({ request, env }) {
  try {
    const d = await bodyJson(request);
    const orderNo = String(d.order_number || "").trim().toUpperCase().slice(0, 40);
    const verifier = String(d.verifier || "").trim().slice(0, 100);
    if (!orderNo || !verifier) return fail("Nomor pesanan dan verifikasi wajib diisi.");
    const order = await env.DB.prepare(`SELECT id,order_number,tracking_code,customer_phone_norm,created_at,order_status,total_amount,payment_status
      FROM orders WHERE order_number=?`).bind(orderNo).first();
    if (!order) return fail("Pesanan tidak ditemukan atau verifikasi tidak cocok.", 404);
    const valid = order.customer_phone_norm === normPhone(verifier) || order.tracking_code === verifier.toLowerCase();
    if (!valid) return fail("Pesanan tidak ditemukan atau verifikasi tidak cocok.", 404);
    const [items, history] = await Promise.all([
      env.DB.prepare("SELECT product_name_snapshot AS name,unit_price_snapshot AS unit_price,quantity,subtotal FROM order_items WHERE order_id=?").bind(order.id).all(),
      env.DB.prepare("SELECT new_status AS status,created_at FROM order_status_history WHERE order_id=? ORDER BY created_at").bind(order.id).all()
    ]);
    return json({ ok: true, order: { order_number: order.order_number, created_at: order.created_at,
      status: order.order_status, payment_status: order.payment_status, total_amount: order.total_amount,
      items: items.results || [], history: history.results || [] } });
  } catch { return fail("Gagal melacak pesanan", 500); }
}
