import { json, fail } from "../_lib.js";
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const category = Number(url.searchParams.get("category") || 0);
  const search = (url.searchParams.get("q") || "").trim().slice(0, 80);
  try {
    let sql = `SELECT p.id,p.name,p.slug,p.description,p.image_url,p.price,p.stock,p.availability_status,
      p.category_id,c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id
      WHERE p.publication_status='published' AND p.availability_status='available'`;
    const args = [];
    if (category > 0) { sql += " AND p.category_id=?"; args.push(category); }
    if (search) { sql += " AND (p.name LIKE ? OR p.description LIKE ?)"; args.push(`%${search}%`, `%${search}%`); }
    sql += " ORDER BY p.created_at DESC LIMIT 100";
    const rows = await env.DB.prepare(sql).bind(...args).all();
    return json({ ok: true, products: rows.results || [] });
  } catch { return fail("Gagal memuat produk", 500); }
}
