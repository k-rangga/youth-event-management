// Path checks for updateLiturgyDoc with faked Apps Script services.
const fs = require('fs'), vm = require('vm');
function run(opts) {
  const log = [];
  const ctx = { console: { warn: m => log.push('warn: ' + m) }, TZ: 'Asia/Jakarta',
    Utilities: { formatDate: () => '22 Okt, 17.00' },
    DriveApp: { getFileById: id => ({ isTrashed: () => !!opts.trashed, setTrashed: () => log.push('trash ' + id), getId: () => id }) },
    Drive: { Files: { update: (meta, id, blob) => { if (opts.noDrive) throw new Error('Drive API has not been used'); log.push('drive.update ' + id + ' name=' + meta.name + ' blob=' + blob); } } } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('Liturgi.js', 'utf8'), ctx);
  const saved = [];
  vm.runInContext('findService_ = ' + (opts.missing ? 'function () { return null; }' : `function () { return { sheet: { getRange: function () { return { setValue: function (v) { SAVED.push(v); } }; } }, row: 2, svc: { date: '2026-10-25' }, data: ${opts.noDoc ? '{}' : "{ doc: { id: 'D1', url: 'u', at: '22 Okt, 00.17' } }"} }; }`), Object.assign(ctx, { SAVED: saved }));
  ctx.makeLiturgyDoc_ = () => ({ getId: () => 'TEMP', setTrashed: () => log.push('trash TEMP') });
  ctx.exportDocx_ = () => 'docx';
  ctx.addPageNumbers_ = () => 'numbered-docx';
  ctx.stripPageMark_ = id => log.push('strip ' + id);
  ctx.copyDocContent_ = (a, b, n) => log.push('copy ' + a + '→' + b + ' ' + n);
  const res = vm.runInContext('updateLiturgyDoc("1")', ctx);
  return { res: JSON.stringify(res), log, saved: saved.length ? JSON.parse(saved[0]).doc : null };
}
console.log('normal  ', JSON.stringify(run({})));
console.log('no Drive', JSON.stringify(run({ noDrive: true })));
console.log('trashed ', JSON.stringify(run({ trashed: true })));
console.log('no doc  ', JSON.stringify(run({ noDoc: true })));
