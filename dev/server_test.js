// Runs the server files in Node with fake Apps Script services; UrlFetchApp uses curl.
const fs = require('fs'), vm = require('vm'), cp = require('child_process');
const root = process.argv[2] || '.';
function mkSheet() { const rows = []; return { rows, getLastRow: () => rows.length, getLastColumn: () => Math.max(0, ...rows.map(r => r.length)),
  getRange: (r, c, nr, nc) => ({ getValues: () => rows.slice(r - 1, r - 1 + (nr || 1)).map(x => { const o = []; for (let i = 0; i < (nc || 1); i++) o.push(x[c - 1 + i] === undefined ? '' : x[c - 1 + i]); return o; }),
    getValue: () => (rows[r - 1] || [])[c - 1], setValue: v => { rows[r - 1][c - 1] = v; },
    setValues: v => { v.forEach((vr, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; vr.forEach((x, j) => rows[r - 1 + i][c - 1 + j] = x); }); return { setFontWeight() {} }; } }),
  appendRow: v => rows.push(v.slice()), deleteRow: i => rows.splice(i - 1, 1), setFrozenRows() {} }; }
const sheets = { Schedule: mkSheet() }, cache = {};
sheets.Schedule.rows.push(['Event ID', 'Date', 'Theme', 'Pastor', 'tag'], [1, new Date('2026-10-25T00:00:00'), 'Rapat', '', 'Meeting'], [2, new Date('2026-10-25T00:00:00'), 'Old', 'X', 'Regular']);
const ctx = { console, Date,
  SpreadsheetApp: { openById: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet()) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  UrlFetchApp: { fetch: url => { const out = cp.execSync('curl -sL -m 20 -w "\\n%{http_code}" ' + JSON.stringify(url)).toString(); const i = out.lastIndexOf('\n'); return { getContentText: () => out.slice(0, i), getResponseCode: () => Number(out.slice(i + 1)) }; } },
  Utilities: { formatDate: (d, tz, f) => f.indexOf('HH:mm:ss') !== -1 ? d.toISOString().slice(0, 19) : f === 'yyyy-MM-dd' ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '10.00' },
  HtmlService: {} };
vm.createContext(ctx);
['Code.js', 'LiturgiText.js', 'TataIbadah.js', 'Liturgi.js'].forEach(f => vm.runInContext(fs.readFileSync(root + '/' + f, 'utf8'), ctx, { filename: f }));
module.exports = { ctx, sheets, r: s => vm.runInContext(s, ctx) };
if (require.main === module) {
  const r = module.exports.r;
  const mode = process.argv[3] || 'all';
  if (mode === 'books' || mode === 'all') {
    const books = r('BIBLE_BOOKS'), bad = [];
    books.forEach((b, i) => { const x = r(`fetchBibleText(${JSON.stringify(b)}, 1, '1')`); if (!x.success) bad.push(b); });
    console.log('books ok:', books.length - bad.length, '/', books.length, bad.length ? 'FAILED: ' + bad.join(', ') : '');
  }
  console.log('Mzm 139:23-24 →', JSON.stringify(r(`fetchBibleText('Mazmur', 139, '23-24')`)).slice(0, 220));
  console.log('Yoh 3:16,18 →', r(`fetchBibleText('Yohanes', '3', '16, 18')`).text.slice(0, 120));
  console.log('bad →', JSON.stringify(r(`fetchBibleText('Mazmur', 139, '99')`)), JSON.stringify(r(`fetchBibleText('Foo', 1, '1')`)));
  // services: save, conflict, texts
  const a = r(`saveTataIbadah({date:'2026-10-25', series:'GP', sub:'Body', pf:'Paul', status:'Draft', texts:{call:'Hai'}, slots:{b2:'kj3', b5:'kj392'}, lyrics:{'kj3|Bait 1':'x'}})`);
  const b = r(`saveTataIbadah({id:'1', date:'2026-10-25', series:'GP', sub:'Body 2', pf:'Paul', baseUpdatedAt:${JSON.stringify(a.updatedAt)}, texts:{call:'Hai'}, slots:{b2:'kj3'}})`);
  const c = r(`saveTataIbadah({id:'1', date:'2026-10-25', series:'GP', sub:'Stale', pf:'Paul', baseUpdatedAt:'2000-01-01T00:00:00', slots:{}})`);
  const d = r(`saveTataIbadah({id:'1', date:'2026-10-25', series:'GP', sub:'Forced', pf:'Paul', baseUpdatedAt:'2000-01-01T00:00:00', force:true, slots:{b2:'kj3'}, lyrics:{'kj3|Bait 1':'x'}})`);
  console.log('save', a.success, a.updatedAt, '| same-base resave', b.success, '| stale', c.conflict, c.latest && c.latest.sub, '| forced', d.success);
  console.log('texts round-trip', JSON.stringify(r(`getTataIbadahData().services[0].texts`)), '| liturgy keys', Object.keys(r('getTataIbadahData().liturgy.fixed')).join(','));
  // delete song in use: refused, then merged
  console.log('delete used', JSON.stringify(r(`deleteSong('kj3')`)));
  console.log('merge', JSON.stringify(r(`deleteSong('kj3', 'goodness')`)), JSON.stringify(r(`getTataIbadahData().services[0]`).slots), Object.keys(r(`getTataIbadahData().services[0]`).lyrics));
  console.log('delete unused', JSON.stringify(r(`deleteSong('waymaker')`)), 'songs left', r('readSongs_().length'));
}
if (require.main === module && process.argv[3] === 'index') {
  const r = module.exports.r;
  const before = r('readSongs_().length');
  const res = r('importHymnalIndex()');
  const again = r('importHymnalIndex()');
  const songs = r('readSongs_()');
  console.log('before', before, 'added', JSON.stringify(res), 'second run', again.total, 'after', songs.length);
  console.log('sample', JSON.stringify(songs.filter(s => s.id === 'kj410' || s.id === 'kk767')));
  const imp = r(`importHymnalSong('KJ', '410')`);
  console.log('lazy fetch KJ 410 →', imp.message, imp.song && imp.song.sections.map(s => s.label).join(','), '| rows', r('readSongs_().length'));
}
if (require.main === module && process.argv[3] === 'sync') {
  const { r, sheets } = module.exports;
  const sched = () => JSON.stringify(sheets.Schedule.rows.slice(1).map(x => [x[0], x[2], x[3], x[4]]));
  // 1. TI save pushes to the Regular row (Meeting skipped)
  const a = r(`saveTataIbadah({date:'2026-10-25', series:'Glorious Purpose', sub:'Body of Christ', pf:'Sdr. Paul', status:'Draft', slots:{}})`);
  console.log('1 TI→Schedule', a.scheduleChanged, JSON.stringify(a.schedule), sched());
  // 2. empty PF does not blank the Schedule
  const b = r(`saveTataIbadah({id:'1', date:'2026-10-25', series:'Glorious Purpose', sub:'Body of Christ', pf:'', baseUpdatedAt:${JSON.stringify(a.updatedAt)}, slots:{}})`);
  console.log('2 empty PF keeps pastor', b.scheduleChanged, sched());
  // 3. new Sunday without a row adds a Service row
  const c = r(`saveTataIbadah({date:'2026-11-08', series:'', sub:'Rooted', pf:'Pdt. A', slots:{}})`);
  console.log('3 adds row', c.scheduleChanged, JSON.stringify(c.schedule));
  // 4. Event input edits the service row → TI follows; a Meeting edit on that day does not
  const before = r(`getTataIbadahData().services.filter(function(s){return s.date==='2026-10-25'})[0]`);
  const d = r(`saveEvent({id:'2', date:'2026-10-25', theme:'Glorious Purpose: Soul of The Calling', pastor:'Tpg. Siska', tag:'Regular'})`);
  const after = r(`getTataIbadahData().services.filter(function(s){return s.date==='2026-10-25'})[0]`);
  console.log('4 Schedule→TI', JSON.stringify(d.tataIbadah), after.series + ' | ' + after.sub + ' | ' + after.pf, '| updatedAt moved', before.updatedAt !== after.updatedAt || '(same second)');
  const e = r(`saveEvent({id:'1', date:'2026-10-25', theme:'Rapat lain', pastor:'X', tag:'Meeting'})`);
  console.log('5 Meeting ignored', JSON.stringify(e.tataIbadah), r(`getTataIbadahData().services.filter(function(s){return s.date==='2026-10-25'})[0].pf`));
  const f = r(`saveEvent({id:'2', date:'2026-10-25', theme:'Glorious Purpose: Soul of The Calling', pastor:'Tpg. Siska', tag:'Regular'})`);
  console.log('6 no-op', JSON.stringify(f.tataIbadah));
}
