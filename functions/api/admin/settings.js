import { json, fail, bodyJson, requireAdmin } from "../../_lib.js";
export async function onRequestGet({request,env}) {
 const a=await requireAdmin(request,env,false); if(a.error)return a.error;
 const r=await env.DB.prepare("SELECT key,value FROM site_settings").all();
 return json({ok:true,settings:Object.fromEntries((r.results||[]).map(x=>[x.key,x.value]))});
}
export async function onRequestPost({request,env}) {
 const a=await requireAdmin(request,env); if(a.error)return a.error;
 try {
  const d=await bodyJson(request);
  const allowed=["store_name","tagline","shipping_fee","payment_instructions","whatsapp"];
  const statements=[];
  for(const key of allowed) if(d[key]!==undefined) {
   let value=String(d[key]).trim().slice(0,1000);
   if(key==="shipping_fee" && (!Number.isSafeInteger(Number(value))||Number(value)<0)) return fail("Ongkir harus angka nol atau lebih.");
   if(key==="whatsapp") value=value.replace(/[^\d+]/g,"").slice(0,30);
   statements.push(env.DB.prepare("INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key,value));
  }
  if(statements.length) await env.DB.batch(statements);
  return json({ok:true});
 } catch { return fail("Gagal menyimpan pengaturan",400); }
}
