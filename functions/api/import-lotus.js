
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export async function onRequestPost({ request, env }) {
  // Ganti DB jika nama binding D1 di Pages berbeda.
  const db = env.DB;
  const token = env.LOTUS_IMPORT_TOKEN;

  if (!db || !token) {
    return json({
      ok: false,
      error: "D1 binding atau LOTUS_IMPORT_TOKEN belum disetel."
    }, 500);
  }

  if (
    request.headers.get("Authorization") !== `Bearer ${token}`
  ) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "JSON tidak valid." }, 400);
  }

  if (!Array.isArray(body.products) || body.products.length > 20) {
    return json({
      ok: false,
      error: "Kirim maksimal 20 produk per percobaan."
    }, 400);
  }

  const result = {
    ok: true,
    received: body.products.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  for (const item of body.products) {
    const d = item.document || item;
    const sourceId = String(d.productId || d.id || "").trim();
    const name = String(
      d.searchTitle?.EN || d.title || d.name || ""
    ).trim();

    if (!sourceId || !name || d.status === "inactive") {
      result.skipped++;
      continue;
    }

    try {
      const existing = await db.prepare(`
        SELECT id FROM products
        WHERE source_name = ? AND source_product_id = ?
        LIMIT 1
      `).bind("Lotus's Malaysia", sourceId).first();

      const image =
        d.thumbnail ||
        (Array.isArray(d.images) ? d.images[0] : null) ||
        null;

      const description =
        typeof d.searchDescriptionLong?.EN === "string"
          ? d.searchDescriptionLong.EN
          : null;

      const sourcePrice =
        Number.isFinite(Number(d.price)) ? Number(d.price) : null;

      const promoPrice =
        Number.isFinite(Number(d.specialPrice))
          ? Number(d.specialPrice)
          : null;

      const now = new Date().toISOString();
      const slug = `lotus-${sourceId}`;

      if (existing) {
        // Perbarui data sumber saja. Jangan ubah harga jual,
        // stok, atau status publikasi JASTIPER.
        await db.prepare(`
          UPDATE products SET
            name = ?,
            description = ?,
            image_url = ?,
            source_product_url = ?,
            source_price = ?,
            source_currency = 'MYR',
            source_promotion_price = ?,
            source_last_checked_at = ?,
            import_status = 'lotus_test',
            updated_at = ?
          WHERE id = ?
        `).bind(
          name,
          description,
          image,
          null,
          sourcePrice,
          promoPrice,
          now,
          now,
          existing.id
        ).run();

        result.updated++;
      } else {
        await db.prepare(`
          INSERT INTO products (
            category_id,
            product_type_id,
            name,
            slug,
            description,
            image_url,
            price,
            stock,
            availability_status,
            publication_status,
            source_name,
            source_product_url,
            source_product_id,
            source_price,
            source_currency,
            source_promotion_price,
            source_last_checked_at,
            import_status
          ) VALUES (
            5, 5, ?, ?, ?, ?, NULL, 0,
            'available', 'draft', ?, NULL, ?, ?,
            'MYR', ?, ?, 'lotus_test'
          )
        `).bind(
          name,
          slug,
          description,
          image,
          "Lotus's Malaysia",
          sourceId,
          sourcePrice,
          promoPrice,
          now
        ).run();

        result.inserted++;
      }
    } catch (error) {
      result.errors.push({
        sourceId,
        name,
        error: String(error.message || error).slice(0, 250)
      });
    }
  }

  result.ok = result.errors.length === 0;
  return json(result, result.ok ? 200 : 207);
}
