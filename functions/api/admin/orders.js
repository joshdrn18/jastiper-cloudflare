import { json, fail, bodyJson, requireAdmin } from "../../_lib.js";
const transitions = {
 "Menunggu Konfirmasi":["Dikonfirmasi","Dibatalkan"],
 "Dikonfirmasi":["Menunggu Pembayaran","Dibatalkan"],
 "Menunggu Pembayaran":["Pembayaran Diverifikasi","Dibatalkan"],
 "Pembayaran Diverifikasi":["Diproses","Dibatalkan"],
 "Diproses":["Dikirim","Dibatalkan"],
 "Dikirim":["Selesai"],"Selesai":[],"Dibatalkan":[]
};
export async function onRequestGet({request,env}) {
 const a=await requireAdmin(request,env,false); if(a.error)return a.error;
 const rows=await env.DB.prepare(`SELECT o.*, (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id) AS item_count FROM orders o ORDER BY o.created_at DESC LIMIT 300`).all();
 return json({ok:true,orders:rows.results||[]});
}
export async function onRequestPost({request,env}) {
 const a=await requireAdmin(request,env); if(a.error)return a.error;
 try {
  const d=await bodyJson(request), id=Number(d.id), next=String(d.status||"");
  if(!Number.isSafeInteger(id)||id<=0||!Object.hasOwn(transitions,next))return fail("Status tidak valid.");
  const o=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
  if(!o)return fail("Pesanan tidak ditemukan",404);
  if(!transitions[o.order_status]?.includes(next))return fail("Perubahan status tidak diizinkan.");
  if(next==="Dibatalkan" && !o.stock_restored) {
   const items=await env.DB.prepare("SELECT product_id,quantity FROM order_items WHERE order_id=?").bind(id).all();
   const statements=(items.results||[]).map(i=>env.DB.prepare("UPDATE products SET stock=stock+?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(i.quantity,i.product_id));
   statements.push(env.DB.prepare("UPDATE orders SET stock_restored=1 WHERE id=? AND stock_restored=0").bind(id));
   await env.DB.batch(statements);
  }
  await env.DB.prepare("UPDATE orders SET order_status=?,payment_status=CASE WHEN ?='Pembayaran Diverifikasi' THEN 'verified' ELSE payment_status END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
    .bind(next,next,id).run();
  await env.DB.prepare("INSERT INTO order_status_history(order_id,old_status,new_status,changed_by) VALUES(?,?,?,'admin')").bind(id,o.order_status,next).run();
  return json({ok:true});
 } catch { return fail("Gagal mengubah pesanan",500); }
}
