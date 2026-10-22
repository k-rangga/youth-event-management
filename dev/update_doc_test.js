// Path checks for updateLiturgyDoc (rewrite in place) with faked Apps Script services.
const fs = require('fs'), vm = require('vm');
function run(opts) {
  const log = [];
  const ctx = { console, TZ: 'Asia/Jakarta', Utilities: { formatDate: () => '22 Okt, 17.00' },
    DriveApp: { getFileById: id => { if (opts.missing) throw new Error('not found'); return { isTrashed: () => !!opts.trashed }; } },
    DocumentApp: { ParagraphHeading: { NORMAL: 'N' }, openById: id => ({ getBody: () => ({ appendParagraph: () => { log.push('empty ' + id); return { setHeading: () => {} }; }, getNumChildren: () => 1, getChild: () => null, removeChild: () => {} }), setName: n => log.push('name ' + n), saveAndClose: () => log.push('save') }) } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('Liturgi.js', 'utf8'), ctx);
  const saved = [];
  ctx.SAVED = saved;
  vm.runInContext(`findService_ = function () { return { sheet: { getRange: function () { return { setValue: function (v) { SAVED.push(v); } }; } }, row: 2, svc: { date: '2026-10-25' }, data: ${opts.noDoc ? '{}' : "{ doc: { id: 'D1', url: 'u', at: '22 Okt, 00.17' } }"} }; }`, ctx);
  ctx.liturgySongs_ = () => ({});
  ctx.buildLiturgy_ = (doc, svc, songs, o) => log.push('build inPlace=' + !!(o && o.inPlace));
  const res = vm.runInContext('updateLiturgyDoc("1")', ctx);
  return { res, log, saved: saved.length ? JSON.parse(saved[0]).doc.updatedAt : null };
}
for (const [name, o] of [['normal', {}], ['trashed', { trashed: true }], ['missing', { missing: true }], ['no doc', { noDoc: true }]]) console.log(name.padEnd(8), JSON.stringify(run(o)));
