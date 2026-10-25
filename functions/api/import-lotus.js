
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.LOTUS_IMPORT_TOKEN) {
    return json({ ok: false, error: "Konfigurasi belum lengkap." }, 500);
  }

  if (
    request.headers.get("Authorization") !==
    `Bearer ${env.LOTUS_IMPORT_TOKEN}`
  ) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "JSON tidak valid." }, 400);
  }

  if (!Array.isArray(body.products) ||
      body.products.length === 0 ||
      body.products.length > 20) {
    return json({
      ok: false,
      error: "Kirim 1–20 produk per permintaan."
    }, 400);
  }

  const result = { ok: true, inserted: 0, updated: 0, skipped: 0, errors: [] };

  for (const hit of body.products) {
    const d = hit?.document || hit;
    const id = String(d?.productId || d?.id || "").trim();
    const name = String(d?.searchTitle?.EN || d?.title || "").trim();

    if (!id || !name) {
      result.skipped++;
      continue;
    }

    const price = Number(d.price);
    const promo = Number(d.specialPrice);
    const sourcePrice = Number.isFinite(price) ? price : null;
    const promoPrice = Number.isFinite(promo) ? promo : null;
    const image = d.thumbnail ||
      (Array.isArray(d.images) ? d.images[0] : null) || null;
    const description = d.searchDescriptionLong?.EN || null;
    const now = new Date().toISOString();

    try {
      const existing = await env.DB.prepare(`
        SELECT id FROM products
        WHERE source_name = ? AND source_product_id = ?
        LIMIT 1
      `).bind("Lotus's Malaysia", id).first();

      if (existing) {
        await env.DB.prepare(`
          UPDATE products SET
            name = ?,
            description = ?,
            image_url = ?,
            source_price = ?,
            source_currency = 'MYR',
            source_promotion_price = ?,
            source_last_checked_at = ?,
            import_status = 'imported',
            updated_at = ?
          WHERE id = ?
        `).bind(
          name, description, image, sourcePrice,
          promoPrice, now, now, existing.id
        ).run();

        result.updated++;
      } else {
        await env.DB.prepare(`
          INSERT INTO products (
            category_id, product_type_id, name, slug,
            description, image_url, price, stock,
            availability_status, publication_status,
            source_name, source_product_id, source_price,
            source_currency, source_promotion_price,
            source_last_checked_at, import_status
          ) VALUES (
            5, 5, ?, ?, ?, ?, NULL, 0,
            'available', 'draft',
            'Lotus''s Malaysia', ?, ?, 'MYR', ?, ?, 'imported'
          )
        `).bind(
          name,
          `lotus-${id}`,
          description,
          image,
          "Lotus's Malaysia",
          id,
          sourcePrice,
          promoPrice,
          now
        ).run();

        result.inserted++;
      }
    } catch (error) {
      result.errors.push({
        id,
        message: String(error.message || error).slice(0, 200)
      });
    }
  }

  result.ok = result.errors.length === 0;
  return json(result, result.ok ? 200 : 207);
}
