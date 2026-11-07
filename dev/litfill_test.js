// litFill_ with a fake paragraph that refuses text with nothing printable, as Docs does.
const fs = require('fs'), vm = require('vm');
const warns = [];
const ctx = { console: { warn: m => warns.push(m), log: console.log }, DocumentApp: { HorizontalAlignment: {}, Attribute: {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('Liturgi.js', 'utf8'), ctx);
ctx.litAttrs_ = () => ({});
function fill(runs, refuse) {
  const out = [];
  const para = new Proxy({}, { get: (t, k) => k === 'appendText' ? x => {
    if (x === '' || (refuse && refuse.test(x))) throw new Error('Cannot insert an empty text element.');
    out.push(x); return { setAttributes: () => {} };
  } : () => para });
  ctx.litFill_(para, runs, {});
  return out;
}
const ok = (label, cond, extra) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + label + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); if (!cond) process.exitCode = 1; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
ok('plain text kept', same(fill('Halo'), ['Halo']));
ok('empty string skipped', same(fill(''), []));
ok('null skipped', same(fill([[null, {}]]), []));
ok('only a line break skipped', same(fill('\n'), []));
ok('only CR LF skipped', same(fill('\r\n\r\n'), []));
ok('only zero-width skipped', same(fill('​﻿'), []));
ok('only control char skipped', same(fill('\u0003'), []));
ok('single space kept (spacer)', same(fill([[' ', { size: 1 }]]), [' ']));
ok('inner line break kept', same(fill('a\r\nb\n'), ['a\nb']));
ok('later runs survive an empty one', same(fill([['\n', {}], ['Amin', {}]]), ['Amin']));
ok('text Docs still refuses is skipped, not fatal', same(fill([['☐', {}], ['Amin', {}]], /☐/), ['Amin']) && warns.length === 1, warns);
