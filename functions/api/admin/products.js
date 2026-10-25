import { json, fail, bodyJson, requireAdmin, slugify, validImageUrl } from "../../_lib.js";
export async function onRequestGet({request,env}) {
  const auth=await requireAdmin(request,env,false); if(auth.error) return auth.error;
  const rows=await env.DB.prepare(`SELECT p.*,c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.created_at DESC LIMIT 500`).all();
  return json({ok:true,products:rows.results||[]});
}
export async function onRequestPost({request,env}) {
  const auth=await requireAdmin(request,env); if(auth.error) return auth.error;
  try {
    const d=await bodyJson(request), name=String(d.name||"").trim().slice(0,160), category=Number(d.category_id);
    const price=d.price===""||d.price==null?null:Number(d.price), stock=Number(d.stock||0);
    const image=validImageUrl(d.image_url), publication=["draft","published","archived"].includes(d.publication_status)?d.publication_status:"draft";
    if(!name||!Number.isSafeInteger(category)||category<=0||!Number.isSafeInteger(stock)||stock<0||stock>1000000) return fail("Nama, kategori, atau stok tidak valid.");
    if(price!==null&&(!Number.isSafeInteger(price)||price<=0)) return fail("Harga harus bilangan bulat positif.");
    if(publication==="published"&&price===null) return fail("Produk publik harus memiliki harga.");
    let slug=slugify(d.slug||name)+"-"+Date.now().toString(36);
    await env.DB.prepare(`INSERT INTO products(name,slug,description,image_url,price,stock,category_id,availability_status,publication_status,depositor_name)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(name,slug,String(d.description||"").slice(0,3000),image,price,stock,category,
      d.availability_status==="unavailable"?"unavailable":"available",publication,String(d.depositor_name||"").slice(0,120)||null).run();
    return json({ok:true});
  } catch(e) { return fail("Gagal menyimpan produk. Periksa kategori dan data yang diisi.",400); }
}
export async function onRequestPut({request,env}) {
  const auth=await requireAdmin(request,env); if(auth.error) return auth.error;
  try {
    const d=await bodyJson(request), id=Number(d.id), name=String(d.name||"").trim().slice(0,160), category=Number(d.category_id);
    const price=d.price===""||d.price==null?null:Number(d.price), stock=Number(d.stock);
    const image=validImageUrl(d.image_url), publication=["draft","published","archived"].includes(d.publication_status)?d.publication_status:"draft";
    if(!Number.isSafeInteger(id)||id<=0||!name||!Number.isSafeInteger(category)||category<=0||!Number.isSafeInteger(stock)||stock<0||stock>1000000) return fail("Data produk tidak valid.");
    if(price!==null&&(!Number.isSafeInteger(price)||price<=0)) return fail("Harga harus bilangan bulat positif.");
    if(publication==="published"&&price===null) return fail("Produk publik harus memiliki harga.");
    await env.DB.prepare(`UPDATE products SET name=?,description=?,image_url=?,price=?,stock=?,category_id=?,availability_status=?,publication_status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
      .bind(name,String(d.description||"").slice(0,3000),image,price,stock,category,d.availability_status==="unavailable"?"unavailable":"available",publication,id).run();
    return json({ok:true});
  } catch { return fail("Gagal mengubah produk",400); }
}
