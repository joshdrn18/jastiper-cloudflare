import { json, fail, bodyJson, normPhone, randomHex, errorResponse } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  try {
    const data = await bodyJson(request);
    const c = data.customer || {};
    const name = String(c.name || "").trim().slice(0, 120);
    const phone = String(c.phone || "").trim().slice(0, 40);
    const phoneNorm = normPhone(phone);
    const address = String(c.address || "").trim().slice(0, 500);
    const city = String(c.city || "").trim().slice(0, 120);
    const email = String(c.email || "").trim().slice(0, 160);
    const notes = String(c.notes || "").trim().slice(0, 500);
    if (!name || !phoneNorm || phoneNorm.length < 8 || !address || !city)
      return fail("Nama, WhatsApp, alamat, dan kota wajib diisi.");
    if (!Array.isArray(data.items) || !data.items.length || data.items.length > 30)
      return fail("Keranjang kosong atau terlalu banyak item.");

    const grouped = new Map();
    for (const item of data.items) {
      const id = Number(item.id), qty = Number(item.quantity);
      if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(qty) || qty <= 0 || qty > 50)
        return fail("Produk atau jumlah tidak valid.");
      grouped.set(id, (grouped.get(id) || 0) + qty);
    }
    if ([...grouped.values()].some(q => q > 50)) return fail("Jumlah produk terlalu besar.");

    const setting = await env.DB.prepare("SELECT value FROM site_settings WHERE key='shipping_fee'").first();
    const shipping = Math.max(0, Number(setting?.value) || 0);
    const orderNo = "JST-" + new Date().toISOString().slice(2,10).replaceAll("-","") + "-" + randomHex(3).toUpperCase();
    const tracking = randomHex(8);
    let subtotal = 0;
    const products = [];
    for (const [id, qty] of grouped) {
      const p = await env.DB.prepare(`SELECT id,name,price,stock,availability_status,publication_status
        FROM products WHERE id=?`).bind(id).first();
      if (!p || p.publication_status !== "published" || p.availability_status !== "available" || !p.price)
        return fail("Ada produk yang tidak tersedia. Muat ulang katalog.");
      if (p.stock < qty) return fail(`Stok ${p.name} tidak mencukupi.`);
      subtotal += Number(p.price) * qty;
      if (!Number.isSafeInteger(subtotal) || subtotal > 9_000_000_000_000)
        return fail("Total pesanan terlalu besar.");
      products.push({ ...p, qty });
    }
    const total = subtotal + shipping;

    // Satu batch D1 bersifat transaksional. Trigger prevent_negative_stock akan
    // membatalkan seluruh batch jika stok berubah/kurang di antara pengecekan dan update.
    const statements = [
      env.DB.prepare(`INSERT INTO orders
        (order_number,tracking_code,customer_name,customer_phone,customer_phone_norm,customer_email,shipping_address,city,notes,subtotal,shipping_fee,total_amount,payment_method)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(orderNo, tracking, name, phone, phoneNorm, email || null, address, city, notes || null, subtotal, shipping, total, "Transfer manual")
    ];
    for (const p of products) {
      statements.push(env.DB.prepare(`UPDATE products SET stock=stock-?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id=? AND publication_status='published' AND availability_status='available'`)
        .bind(p.qty, p.id));
    }
    for (const p of products) {
      statements.push(env.DB.prepare(`INSERT INTO order_items(order_id,product_id,product_name_snapshot,unit_price_snapshot,quantity,subtotal)
        SELECT id,?,?,?,?,? FROM orders WHERE order_number=?`)
        .bind(p.id,p.name,p.price,p.qty,p.price*p.qty,orderNo));
    }
    statements.push(env.DB.prepare(`INSERT INTO order_status_history(order_id,old_status,new_status)
      SELECT id,NULL,? FROM orders WHERE order_number=?`).bind("Menunggu Konfirmasi",orderNo));
    await env.DB.batch(statements);
    return json({ ok: true, order_number: orderNo, tracking_code: tracking, total_amount: total,
      message: "Pesanan dibuat. Simpan nomor pesanan dan kode pelacakan." }, 201);
  } catch (e) {
    if (String(e?.message || "").includes("STOK_TIDAK_CUKUP")) return fail("Stok baru saja berubah atau tidak mencukupi. Silakan coba checkout lagi.",409);
    return errorResponse(e);
  }
}
