/*
 * Keuangan: budget and actual income/expenses per Schedule event.
 *
 * Sheets (created on first use):
 *   Anggaran   – planned lines: ID | Event ID | Jenis | Kategori | Uraian | Qty | Harga satuan | Jumlah | Catatan | Diubah
 *   Transaksi  – actual money in/out: ID | Event ID | Anggaran ID | Tanggal | Jenis | Kategori | Uraian | Jumlah |
 *                Dibayar dari | Dibayar oleh | Sudah diganti | Bukti (Drive file ID) | Nama bukti | Diubah
 *   _Keuangan  – hidden settings: PIN salt and hash, receipt folder ID
 *
 * The web app is open to anyone with the link, so every call here takes a session token from kuUnlock (PIN).
 */

var KU_LINES_SHEET = 'Anggaran';
var KU_TX_SHEET = 'Transaksi';
var KU_CONFIG_SHEET = '_Keuangan';
var KU_LINE_HEAD = ['ID', 'Event ID', 'Jenis', 'Kategori', 'Uraian', 'Qty', 'Harga satuan', 'Jumlah', 'Catatan', 'Diubah'];
var KU_TX_HEAD = ['ID', 'Event ID', 'Anggaran ID', 'Tanggal', 'Jenis', 'Kategori', 'Uraian', 'Jumlah', 'Dibayar dari', 'Dibayar oleh', 'Sudah diganti', 'Bukti', 'Nama bukti', 'Diubah'];
var KU_TOKEN_TTL = 6 * 60 * 60;   // seconds a PIN unlock lasts (CacheService maximum)
var KU_MAX_FAILS = 8;             // wrong PINs allowed per 15 minutes
var KU_MIN_PIN = 6;
var KU_RECEIPT_MAX = 8 * 1024 * 1024;

/* ---------- access (PIN) ---------- */

function kuSheet_(name, head) {
  var ss = getSs_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (head) { sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  }
  return sh;
}

function kuConfig_() {
  var sh = getSs_().getSheetByName(KU_CONFIG_SHEET), out = {};
  if (!sh || sh.getLastRow() < 1) return out;
  sh.getRange(1, 1, sh.getLastRow(), 2).getValues().forEach(function (r) { if (r[0]) out[String(r[0])] = String(r[1]); });
  return out;
}

function kuSetConfig_(key, value) {
  var sh = getSs_().getSheetByName(KU_CONFIG_SHEET);
  if (!sh) { sh = getSs_().insertSheet(KU_CONFIG_SHEET); if (sh.hideSheet) sh.hideSheet(); }
  var n = sh.getLastRow(), keys = n ? sh.getRange(1, 1, n, 1).getValues() : [];
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.appendRow([key, value]);
}

function kuHash_(salt, pin) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pin, Utilities.Charset.UTF_8));
}

function kuNewToken_() {
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('ku_tok_' + token, '1', KU_TOKEN_TTL);
  return token;
}

/* Throws 'KU_LOCKED' (the client shows the PIN screen) unless token came from a recent unlock. */
function kuAuth_(token) {
  if (!token || !CacheService.getScriptCache().get('ku_tok_' + token)) throw new Error('KU_LOCKED');
}

function kuStatus(token) {
  var ok = false;
  try { kuAuth_(token); ok = true; } catch (e) {}
  return { pinSet: !!kuConfig_().pinHash, unlocked: ok };
}

/* Sets the first PIN. Refused once a PIN exists (use kuChangePin). */
function kuSetupPin(pin) {
  pin = String(pin || '');
  if (pin.length < KU_MIN_PIN) return { success: false, message: 'PIN minimal ' + KU_MIN_PIN + ' karakter.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (kuConfig_().pinHash) return { success: false, message: 'PIN keuangan sudah dibuat. Masukkan PIN untuk membuka.' };
    var salt = Utilities.getUuid();
    kuSetConfig_('pinSalt', salt);
    kuSetConfig_('pinHash', kuHash_(salt, pin));
  } finally {
    lock.releaseLock();
  }
  return { success: true, token: kuNewToken_() };
}

function kuCheckPin_(pin) {
  var cache = CacheService.getScriptCache(), fails = Number(cache.get('ku_fail') || 0);
  if (fails >= KU_MAX_FAILS) return 'Terlalu banyak PIN salah. Coba lagi dalam 15 menit.';
  var cfg = kuConfig_();
  if (!cfg.pinHash) return 'PIN keuangan belum dibuat.';
  if (kuHash_(cfg.pinSalt, String(pin || '')) === cfg.pinHash) return '';
  cache.put('ku_fail', String(fails + 1), 900);
  return 'PIN salah.';
}

function kuUnlock(pin) {
  var err = kuCheckPin_(pin);
  return err ? { success: false, message: err } : { success: true, token: kuNewToken_() };
}

function kuLock(token) {
  if (token) CacheService.getScriptCache().remove('ku_tok_' + token);
  return { success: true };
}

function kuChangePin(token, oldPin, newPin) {
  kuAuth_(token);
  newPin = String(newPin || '');
  if (newPin.length < KU_MIN_PIN) return { success: false, message: 'PIN baru minimal ' + KU_MIN_PIN + ' karakter.' };
  var err = kuCheckPin_(oldPin);
  if (err) return { success: false, message: err === 'PIN salah.' ? 'PIN lama salah.' : err };
  var salt = Utilities.getUuid();
  kuSetConfig_('pinSalt', salt);
  kuSetConfig_('pinHash', kuHash_(salt, newPin));
  return { success: true, message: 'PIN keuangan diganti' };
}

/* ---------- rows ---------- */

function kuNum_(v) {
  var n = Number(v);
  return isFinite(n) ? Math.round(n) : 0;
}

function kuLineFromRow_(r) {
  return { id: String(r[0]), eventId: String(r[1]), type: String(r[2]) === 'Pemasukan' ? 'in' : 'out', category: String(r[3] || ''),
    desc: String(r[4] || ''), qty: r[5] === '' ? '' : Number(r[5]), price: r[6] === '' ? '' : kuNum_(r[6]), amount: kuNum_(r[7]), notes: String(r[8] || '') };
}

function kuTxFromRow_(r) {
  return { id: String(r[0]), eventId: String(r[1]), lineId: String(r[2] || ''), date: fmtDate_(r[3]), type: String(r[4]) === 'Pemasukan' ? 'in' : 'out',
    category: String(r[5] || ''), desc: String(r[6] || ''), amount: kuNum_(r[7]), source: String(r[8]) === 'Pribadi' ? 'personal' : 'kas',
    paidBy: String(r[9] || ''), reimbursed: r[10] === true || String(r[10]).toUpperCase() === 'TRUE', receiptId: String(r[11] || ''), receiptName: String(r[12] || '') };
}

function kuRows_(name, head) {
  var sh = getSs_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues().filter(function (r) { return r[0] !== '' && r[0] !== null; });
}

/* Writes values over the row whose ID is id, or appends it. */
function kuUpsert_(name, head, id, values) {
  var sh = kuSheet_(name, head), n = sh.getLastRow();
  var ids = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues() : [];
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) { sh.getRange(i + 2, 1, 1, values.length).setValues([values]); return; }
  }
  sh.appendRow(values);
}

function kuDeleteRow_(name, id) {
  var sh = getSs_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return false;
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === id) { sh.deleteRow(i + 2); return true; }
  }
  return false;
}

function kuWithLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function kuStamp_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"); }

/* ---------- API ---------- */

/* Schedule events (ID, date, theme, tag) plus every budget line and transaction. */
function getKeuanganData(token) {
  kuAuth_(token);
  var sh = getScheduleSheet_(), n = sh.getLastRow();
  var events = (n > 1 ? sh.getRange(2, 1, n - 1, 5).getValues() : []).filter(function (r) { return r[0] !== '' && r[0] !== null; }).map(function (r) {
    return { id: String(r[0]), date: fmtDate_(r[1]), theme: String(r[2] || ''), pastor: String(r[3] || ''), tag: String(r[4] || '') };
  });
  return {
    events: events,
    lines: kuRows_(KU_LINES_SHEET, KU_LINE_HEAD).map(kuLineFromRow_),
    txs: kuRows_(KU_TX_SHEET, KU_TX_HEAD).map(kuTxFromRow_)
  };
}

function saveBudgetLine(token, p) {
  kuAuth_(token);
  p = p || {};
  var eventId = String(p.eventId || '').trim(), desc = String(p.desc || '').trim();
  if (!eventId) return { success: false, message: 'Event belum dipilih.' };
  if (!desc) return { success: false, message: 'Isi uraian anggaran.' };
  var qty = p.qty === '' || p.qty == null ? '' : Number(p.qty), price = p.price === '' || p.price == null ? '' : kuNum_(p.price);
  var amount = qty !== '' && price !== '' ? Math.round(qty * price) : kuNum_(p.amount);
  if (amount <= 0) return { success: false, message: 'Jumlah anggaran harus lebih dari 0.' };
  var line = { id: String(p.id || '') || Utilities.getUuid(), eventId: eventId, type: p.type === 'in' ? 'in' : 'out', category: String(p.category || 'Lain-lain'),
    desc: desc, qty: qty, price: price, amount: amount, notes: String(p.notes || '').trim() };
  kuWithLock_(function () {
    kuUpsert_(KU_LINES_SHEET, KU_LINE_HEAD, line.id, [line.id, line.eventId, line.type === 'in' ? 'Pemasukan' : 'Pengeluaran', line.category, line.desc,
      line.qty, line.price, line.amount, line.notes, kuStamp_()]);
  });
  return { success: true, line: line };
}

/* Deletes a budget line; its transactions stay, as unbudgeted ("di luar anggaran"). */
function deleteBudgetLine(token, id) {
  kuAuth_(token);
  id = String(id || '');
  return kuWithLock_(function () {
    if (!kuDeleteRow_(KU_LINES_SHEET, id)) return { success: false, message: 'Baris anggaran tidak ditemukan.' };
    var sh = getSs_().getSheetByName(KU_TX_SHEET);
    if (sh && sh.getLastRow() > 1) {
      var col = sh.getRange(2, 3, sh.getLastRow() - 1, 1).getValues();
      col.forEach(function (r, i) { if (String(r[0]) === id) sh.getRange(i + 2, 3).setValue(''); });
    }
    return { success: true };
  });
}

function saveTransaction(token, p) {
  kuAuth_(token);
  p = p || {};
  var eventId = String(p.eventId || '').trim(), date = String(p.date || '').trim(), amount = kuNum_(p.amount);
  if (!eventId) return { success: false, message: 'Event belum dipilih.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, message: 'Isi tanggal transaksi.' };
  if (amount <= 0) return { success: false, message: 'Jumlah harus lebih dari 0.' };
  var tx = { id: String(p.id || '') || Utilities.getUuid(), eventId: eventId, lineId: String(p.lineId || ''), date: date, type: p.type === 'in' ? 'in' : 'out',
    category: String(p.category || 'Lain-lain'), desc: String(p.desc || '').trim(), amount: amount,
    source: p.type !== 'in' && p.source === 'personal' ? 'personal' : 'kas', paidBy: String(p.paidBy || '').trim(),
    reimbursed: !!p.reimbursed, receiptId: String(p.receiptId || ''), receiptName: String(p.receiptName || '') };
  if (tx.source === 'personal' && !tx.paidBy) return { success: false, message: 'Isi nama yang membayar.' };
  if (tx.source !== 'personal') tx.reimbursed = false;
  var old = p.id ? kuRows_(KU_TX_SHEET, KU_TX_HEAD).map(kuTxFromRow_).filter(function (t) { return t.id === tx.id; })[0] : null;
  if (old && old.receiptId && old.receiptId !== tx.receiptId) kuTrashReceipt_(old.receiptId);
  kuWithLock_(function () {
    kuUpsert_(KU_TX_SHEET, KU_TX_HEAD, tx.id, [tx.id, tx.eventId, tx.lineId, new Date(date + 'T00:00:00'), tx.type === 'in' ? 'Pemasukan' : 'Pengeluaran',
      tx.category, tx.desc, tx.amount, tx.source === 'personal' ? 'Pribadi' : 'Kas', tx.paidBy, tx.reimbursed, tx.receiptId, tx.receiptName, kuStamp_()]);
  });
  return { success: true, tx: tx };
}

/* Deletes a transaction and moves its receipt to Drive's trash (recoverable for 30 days). */
function deleteTransaction(token, id) {
  kuAuth_(token);
  id = String(id || '');
  var tx = kuRows_(KU_TX_SHEET, KU_TX_HEAD).map(kuTxFromRow_).filter(function (t) { return t.id === id; })[0];
  if (!tx) return { success: false, message: 'Transaksi tidak ditemukan.' };
  if (tx.receiptId) kuTrashReceipt_(tx.receiptId);
  kuWithLock_(function () { kuDeleteRow_(KU_TX_SHEET, id); });
  return { success: true };
}

/* Copies every budget line of one event to another (amounts kept, nothing spent yet). */
function copyBudget(token, fromEventId, toEventId) {
  kuAuth_(token);
  fromEventId = String(fromEventId || ''); toEventId = String(toEventId || '');
  if (!fromEventId || !toEventId || fromEventId === toEventId) return { success: false, message: 'Pilih event sumber yang lain.' };
  var src = kuRows_(KU_LINES_SHEET, KU_LINE_HEAD).map(kuLineFromRow_).filter(function (l) { return l.eventId === fromEventId; });
  if (!src.length) return { success: false, message: 'Event itu belum punya anggaran.' };
  var stamp = kuStamp_(), out = src.map(function (l) {
    var c = JSON.parse(JSON.stringify(l)); c.id = Utilities.getUuid(); c.eventId = toEventId; return c;
  });
  kuWithLock_(function () {
    var sh = kuSheet_(KU_LINES_SHEET, KU_LINE_HEAD);
    var values = out.map(function (l) { return [l.id, l.eventId, l.type === 'in' ? 'Pemasukan' : 'Pengeluaran', l.category, l.desc, l.qty, l.price, l.amount, l.notes, stamp]; });
    sh.getRange(sh.getLastRow() + 1, 1, values.length, KU_LINE_HEAD.length).setValues(values);
  });
  return { success: true, lines: out };
}

/* ---------- receipts (private Drive folder, read back through the app) ---------- */

function kuReceiptFolder_() {
  var id = kuConfig_().folderId;
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { console.warn('Receipt folder missing, making a new one: ' + e.message); } }
  var folder = DriveApp.createFolder('Keuangan Pemuda – Bukti transaksi');
  kuSetConfig_('folderId', folder.getId());
  return folder;
}

/* data: base64 file contents. Returns the Drive file ID to put on the transaction. */
function uploadReceipt(token, eventId, name, mimeType, data) {
  kuAuth_(token);
  if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(String(mimeType))) return { success: false, message: 'Bukti harus berupa foto atau PDF.' };
  var bytes = Utilities.base64Decode(String(data || ''));
  if (!bytes.length) return { success: false, message: 'File bukti kosong.' };
  if (bytes.length > KU_RECEIPT_MAX) return { success: false, message: 'File bukti terlalu besar (maks. 8 MB).' };
  var safe = String(name || 'bukti').replace(/[\\\/:*?"<>|]+/g, ' ').slice(0, 80);
  var file = kuReceiptFolder_().createFile(Utilities.newBlob(bytes, mimeType, 'Event ' + String(eventId) + ' – ' + safe));
  return { success: true, receiptId: file.getId(), receiptName: safe };
}

/* Only files a transaction points to and that sit in the receipt folder can be read or trashed. */
function kuOwnReceipt_(fileId) {
  var known = kuRows_(KU_TX_SHEET, KU_TX_HEAD).some(function (r) { return String(r[11]) === fileId; });
  if (!fileId || !known) throw new Error('Bukti tidak ditemukan.');
  var file = DriveApp.getFileById(fileId), folderId = kuConfig_().folderId, parents = file.getParents(), inFolder = false;
  while (parents.hasNext()) { if (parents.next().getId() === folderId) inFolder = true; }
  if (!inFolder) throw new Error('Bukti tidak ditemukan.');
  return file;
}

function getReceipt(token, fileId) {
  kuAuth_(token);
  var blob = kuOwnReceipt_(String(fileId || '')).getBlob();
  return { success: true, mimeType: blob.getContentType(), name: blob.getName(), data: Utilities.base64Encode(blob.getBytes()) };
}

/* Best effort: a receipt that can't be trashed only leaves a stray file in the folder. */
function kuTrashReceipt_(fileId) {
  try { kuOwnReceipt_(fileId).setTrashed(true); } catch (e) { console.warn('Receipt not trashed: ' + e.message); }
}
