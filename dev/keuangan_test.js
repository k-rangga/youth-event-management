// Runs Keuangan.js against the fake sheets from server_test.js: PIN lock, budget lines, transactions, copy, receipts.
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const root = process.argv[2] || '.';
const { ctx, sheets, r } = require('./server_test.js');
let n = 0;
const files = {}, cache = {};
Object.assign(ctx.Utilities, {
  DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
  computeDigest: (alg, s) => [...crypto.createHash(alg).update(s, 'utf8').digest()],
  base64Encode: b => Buffer.from(b).toString('base64'), base64Decode: s => [...Buffer.from(s, 'base64')],
  getUuid: () => 'u' + (++n), newBlob: (bytes, mime, name) => ({ bytes, mime, name })
});
ctx.Utilities.formatDate = (d, tz, f) => f === 'yyyy-MM-dd' ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : d.toISOString().slice(0, 19);
ctx.CacheService = { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) };
const folder = { getId: () => 'folder1', createFile: b => { const id = 'file' + (++n); files[id] = { id, blob: b, trashed: false }; return { getId: () => id }; } };
ctx.DriveApp = {
  createFolder: () => folder, getFolderById: id => { if (id !== 'folder1') throw new Error('no folder'); return folder; },
  getFileById: id => { const f = files[id]; if (!f) throw new Error('no file'); return { getParents: () => { let d = false; return { hasNext: () => !d, next: () => { d = true; return folder; } }; },
    getBlob: () => ({ getContentType: () => f.blob.mime, getName: () => f.blob.name, getBytes: () => f.blob.bytes }), setTrashed: t => { f.trashed = t; } }; }
};
vm.runInContext(fs.readFileSync(root + '/Keuangan.js', 'utf8'), ctx, { filename: 'Keuangan.js' });

const ok = (label, cond, extra) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + label + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); if (!cond) process.exitCode = 1; };
const throws = (s) => { try { r(s); return ''; } catch (e) { return e.message; } };

ok('locked before PIN', throws(`getKeuanganData('nope')`) === 'KU_LOCKED');
ok('status: no PIN yet', !r(`kuStatus('')`).pinSet);
ok('short PIN refused', !r(`kuSetupPin('123')`).success);
const t1 = r(`kuSetupPin('rahasia1')`).token;
ok('setup gives token', !!t1);
ok('second setup refused', !r(`kuSetupPin('lainnya1')`).success);
ok('PIN stored hashed', !JSON.stringify(sheets._Keuangan.rows).includes('rahasia1'), sheets._Keuangan.rows.map(x => x[0]));
ok('status unlocked with token', r(`kuStatus(${JSON.stringify(t1)})`).unlocked);
ok('wrong PIN', r(`kuUnlock('salah123')`).message === 'PIN salah.');
const t = r(`kuUnlock('rahasia1')`).token;
ok('right PIN', !!t);
const T = JSON.stringify(t);

const l1 = r(`saveBudgetLine(${T}, {eventId:'1', type:'out', category:'Konsumsi', desc:'Snack', qty:40, price:15000})`);
ok('line qty×price', l1.success && l1.line.amount === 600000, l1.line);
const l2 = r(`saveBudgetLine(${T}, {eventId:'1', type:'in', category:'Iuran peserta', desc:'Iuran', amount:1000000})`);
ok('line total', l2.success && l2.line.type === 'in');
ok('line needs amount', !r(`saveBudgetLine(${T}, {eventId:'1', desc:'X', amount:0})`).success);
r(`saveBudgetLine(${T}, {id:${JSON.stringify(l1.line.id)}, eventId:'1', type:'out', category:'Konsumsi', desc:'Snack sore', amount:700000})`);
ok('line update in place', sheets.Anggaran.rows.length === 3 && sheets.Anggaran.rows[1][4] === 'Snack sore' && sheets.Anggaran.rows[1][7] === 700000);

const up = r(`uploadReceipt(${T}, '1', 'nota.jpg', 'image/jpeg', ${JSON.stringify(Buffer.from('JPEGDATA').toString('base64'))})`);
ok('receipt upload', up.success && files[up.receiptId]);
ok('receipt type checked', !r(`uploadReceipt(${T}, '1', 'x.exe', 'application/x-msdownload', 'AAAA')`).success);
const x1 = r(`saveTransaction(${T}, {eventId:'1', lineId:${JSON.stringify(l1.line.id)}, type:'out', category:'Konsumsi', date:'2026-10-20', desc:'Beli snack', amount:250000, source:'personal', paidBy:'Andreas', receiptId:${JSON.stringify(up.receiptId)}, receiptName:'nota.jpg'})`);
ok('tx personal', x1.success && x1.tx.source === 'personal' && !x1.tx.reimbursed);
ok('tx personal needs name', !r(`saveTransaction(${T}, {eventId:'1', type:'out', date:'2026-10-20', amount:1, source:'personal'})`).success);
ok('tx needs date', !r(`saveTransaction(${T}, {eventId:'1', type:'out', amount:1})`).success);
const x2 = r(`saveTransaction(${T}, {eventId:'1', type:'in', category:'Iuran peserta', date:'2026-10-21', amount:900000, source:'personal', paidBy:'X', reimbursed:true})`);
ok('income is never personal', x2.tx.source === 'kas' && !x2.tx.reimbursed);

const d = r(`getKeuanganData(${T})`);
ok('read back', d.lines.length === 2 && d.txs.length === 2 && d.events.length === 2, { tx: d.txs[0] });
ok('tx round-trip', d.txs[0].date === '2026-10-20' && d.txs[0].paidBy === 'Andreas' && d.txs[0].receiptId === up.receiptId && d.txs[0].lineId === l1.line.id);

const g = r(`getReceipt(${T}, ${JSON.stringify(up.receiptId)})`);
ok('receipt read', Buffer.from(g.data, 'base64').toString() === 'JPEGDATA' && g.mimeType === 'image/jpeg');
const stray = folder.createFile({ bytes: [1], mime: 'image/png', name: 'other' }).getId();
ok('unlinked Drive file refused', throws(`getReceipt(${T}, ${JSON.stringify(stray)})`) === 'Bukti tidak ditemukan.');

const up2 = r(`uploadReceipt(${T}, '1', 'nota2.jpg', 'image/jpeg', 'QUJD')`);
r(`saveTransaction(${T}, {id:${JSON.stringify(x1.tx.id)}, eventId:'1', lineId:${JSON.stringify(l1.line.id)}, type:'out', category:'Konsumsi', date:'2026-10-20', amount:250000, source:'personal', paidBy:'Andreas', reimbursed:true, receiptId:${JSON.stringify(up2.receiptId)}})`);
ok('replaced receipt trashed', files[up.receiptId].trashed && !files[up2.receiptId].trashed);
ok('reimbursed saved', r(`getKeuanganData(${T})`).txs[0].reimbursed === true);

const c = r(`copyBudget(${T}, '1', '2')`);
ok('copy budget', c.success && c.lines.length === 2 && sheets.Anggaran.rows.length === 5 && c.lines[0].eventId === '2', sheets.Anggaran.rows.map(x => x[1]));
ok('copy to self refused', !r(`copyBudget(${T}, '1', '1')`).success);

ok('delete line', r(`deleteBudgetLine(${T}, ${JSON.stringify(l1.line.id)})`).success);
ok('its tx becomes unbudgeted', r(`getKeuanganData(${T})`).txs[0].lineId === '');
ok('delete tx', r(`deleteTransaction(${T}, ${JSON.stringify(x1.tx.id)})`).success && files[up2.receiptId].trashed && sheets.Transaksi.rows.length === 2);

ok('change PIN: wrong old', r(`kuChangePin(${T}, 'salah123', 'barupin1')`).message === 'PIN lama salah.');
ok('change PIN', r(`kuChangePin(${T}, 'rahasia1', 'barupin1')`).success && r(`kuUnlock('barupin1')`).success && !r(`kuUnlock('rahasia1')`).success);
r(`kuLock(${T})`);
ok('lock ends session', throws(`getKeuanganData(${T})`) === 'KU_LOCKED');
for (let i = 0; i < 8; i++) r(`kuUnlock('tebak${i}00')`);
ok('rate limit after repeated wrong PINs', /Terlalu banyak/.test(r(`kuUnlock('barupin1')`).message));
