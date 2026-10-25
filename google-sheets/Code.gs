/** JASTIPER Google Sheets bridge.
 * Jalankan setup() sekali dari editor Apps Script sebelum deploy.
 * Script membuat spreadsheet dan menyimpan ID-nya di Script Properties.
 */
const PROP = PropertiesService.getScriptProperties();
const SHEET_NAMES = {
  orders: 'Pesanan',
  details: 'Detail Barang',
  categories: 'Rekap Kategori'
};

function setup() {
  let id = PROP.getProperty('SPREADSHEET_ID');
  let ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('JASTIPER - Pesanan dan Rekap');
    id = ss.getId();
    PROP.setProperty('SPREADSHEET_ID', id);
  }

  ensureSheet_(ss, SHEET_NAMES.orders, [
    'Nomor Pesanan', 'Waktu', 'Nama Pelanggan', 'WhatsApp', 'Email', 'Kota',
    'Alamat', 'Ringkasan Barang', 'Subtotal (MYR)', 'Ongkir (MYR)', 'Total (MYR)', 'Status Pesanan', 'Catatan'
  ]);
  ensureSheet_(ss, SHEET_NAMES.details, [
    'Nomor Pesanan', 'Waktu', 'Nama Barang', 'Kategori', 'Tipe Produk', 'Qty',
    'Harga Satuan (MYR)', 'Subtotal (MYR)'
  ]);
  ensureSheet_(ss, SHEET_NAMES.categories, [
    'Nomor Pesanan', 'Waktu', 'Kategori', 'Jumlah Jenis Barang', 'Total Qty', 'Subtotal (MYR)'
  ]);
  Logger.log('Spreadsheet JASTIPER: ' + ss.getUrl());
  return ss.getUrl();
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const expected = PROP.getProperty('WEBHOOK_SECRET');
    if (!expected) return json_({ ok: false, error: 'WEBHOOK_SECRET belum diatur' }, 500);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!body.secret || !constantTimeEqual_(String(body.secret), expected)) {
      return json_({ ok: false, error: 'Unauthorized' }, 401);
    }
    if (!body.order || !body.order.order_number || !Array.isArray(body.items) || !body.items.length) {
      return json_({ ok: false, error: 'Payload tidak valid' }, 400);
    }

    lock.waitLock(15000);
    const ss = SpreadsheetApp.openById(PROP.getProperty('SPREADSHEET_ID'));
    const orderSheet = ss.getSheetByName(SHEET_NAMES.orders);
    const orderNo = String(body.order.order_number);
    // Idempotensi: jika nomor order sudah ada, jangan tambahkan baris kedua kalinya.
    if (orderSheet.getLastRow() > 1) {
      const found = orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, 1)
        .createTextFinder(orderNo).matchEntireCell(true).findNext();
      if (found) return json_({ ok: true, duplicate: true });
    }

    const o = body.order;
    const items = body.items.map(i => ({
      product_name: safeCell_(i.product_name),
      category: safeCell_(i.category || 'Barang lainnya'),
      product_type: safeCell_(i.product_type || ''),
      quantity: Math.max(0, Number(i.quantity) || 0),
      unit_price: Math.max(0, Number(i.unit_price) || 0),
      subtotal: Math.max(0, Number(i.subtotal) || 0)
    }));
    const when = safeCell_(o.created_at || new Date().toISOString());
    const summary = items.map(i => i.product_name + ' x' + i.quantity).join(', ');
    orderSheet.appendRow([
      orderNo, when, safeCell_(o.customer_name), safeCell_(o.customer_phone),
      safeCell_(o.customer_email), safeCell_(o.city), safeCell_(o.shipping_address),
      summary, Number(o.subtotal) || 0, Number(o.shipping_fee) || 0,
      Number(o.total_amount) || 0, safeCell_(o.order_status || 'Menunggu Konfirmasi'), safeCell_(o.notes || '')
    ]);

    const detailRows = items.map(i => [orderNo, when, i.product_name, i.category,
      i.product_type, i.quantity, i.unit_price, i.subtotal]);
    appendRows_(ss.getSheetByName(SHEET_NAMES.details), detailRows);

    const byCategory = new Map();
    items.forEach(i => {
      const key = i.category || 'Barang lainnya';
      const old = byCategory.get(key) || { kinds: 0, qty: 0, subtotal: 0 };
      old.kinds += 1;
      old.qty += i.quantity;
      old.subtotal += i.subtotal;
      byCategory.set(key, old);
    });
    const categoryRows = Array.from(byCategory, ([category, v]) => [
      orderNo, when, category, v.kinds, v.qty, v.subtotal
    ]);
    appendRows_(ss.getSheetByName(SHEET_NAMES.categories), categoryRows);
    return json_({ ok: true, order_number: orderNo });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) }, 500);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sh.autoResizeColumns(1, headers.length);
  return sh;
}

function appendRows_(sheet, rows) {
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function safeCell_(value) {
  let s = String(value == null ? '' : value).slice(0, 2000);
  // Prevent user-controlled text from being interpreted as a spreadsheet formula.
  if (/^[=+@\-]/.test(s)) s = "'" + s;
  return s;
}

function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json_(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
