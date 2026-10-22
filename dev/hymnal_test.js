const fs = require('fs'), vm = require('vm'), cp = require('child_process');
const T = process.argv[2];
let fetches = [];
function mkSheet() { const rows = []; return { rows, getLastRow: () => rows.length, getRange: (r, c, nr, nc) => ({ getValues: () => rows.slice(r - 1, r - 1 + (nr || 1)).map(x => { const o = []; for (let i = 0; i < (nc || 1); i++) o.push(x[c - 1 + i] === undefined ? '' : x[c - 1 + i]); return o; }), setValues: v => { v.forEach((vr, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; vr.forEach((x, j) => rows[r - 1 + i][c - 1 + j] = x); }); return { setFontWeight() {} }; } }), appendRow: v => rows.push(v.slice()), setFrozenRows() {} }; }
const sheets = {}, cache = {};
const ctx = { console,
  SpreadsheetApp: { openById: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet()) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { if (v.length > 100000) throw new Error('cache too big ' + v.length); cache[k] = v; } }) },
  UrlFetchApp: { fetch: url => { fetches.push(url); const out = cp.execSync('curl -sL -m 20 -w "\\n%{http_code}" ' + JSON.stringify(url)).toString(); const i = out.lastIndexOf('\n'); return { getContentText: () => out.slice(0, i), getResponseCode: () => Number(out.slice(i + 1)) }; } },
  Utilities: { formatDate: () => '' }, HtmlService: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(T + '/Code.js', 'utf8') + '\n' + fs.readFileSync(T + '/TataIbadah.js', 'utf8'), ctx);
const r = s => vm.runInContext(s, ctx);
const show = (q, h) => { const x = r(`searchHymnalOnline(${JSON.stringify(q)}, ${JSON.stringify(h || '')})`); console.log(`search "${q}" ${h||'*'}: ${x.results.length} →`, x.results.slice(0, 4).map(s => `${s.hymnal} ${s.number} ${s.title}${s.songId ? ' [have ' + s.songId + ']' : ''}`).join(' | ')); };
show('berbahagia'); show('kj 392'); show('392'); show('haleluya', 'KK'); show('kk 767');
console.log('index sizes', Object.keys(cache).map(k => k + ':' + JSON.parse(cache[k]).length + ' (' + cache[k].length + 'b)').join(', '));
for (const [h, n] of [['KK','767'],['KK','767h'],['KK','767F'],['KJ', '392'], ['KJ', '3'], ['PKJ', '3'], ['KK', '767'], ['NKB', '1'], ['KJ', '9999'], ['XX', '1'], ['KJ', '1/../x']]) {
  const res = r(`importHymnalSong('${h}', '${n}')`);
  console.log(`\nimport ${h} ${n}:`, res.success ? `${res.message} | id=${res.song.id} | ${res.song.title} | arr=${res.song.arr} | sections=${res.song.sections.map(s => s.label + '(' + s.text.split('\n').length + ')').join(',')}` : res.message);
  if (res.success && h === 'KJ' && n === '392') console.log(JSON.stringify(res.song.sections[1]));
}
fetches = []; console.log('\nreimport KJ 392:', r(`importHymnalSong('KJ','392')`).message, 'fetches:', fetches.length);
