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

// stripPageMark_ removes only the marker, and without inserting empty text.
{
  let footer = '{{PAGE}}  |  PEMUDA KOTA WISATA', saved = false;
  const el = { asText: () => ({ deleteText: (a, b) => { footer = footer.slice(0, a) + footer.slice(b + 1); } }) };
  ctx.DocumentApp.openById = () => ({ saveAndClose: () => { saved = true; }, getFooter: () => ({
    replaceText: (r, v) => { if (v === '') throw new Error('Cannot insert an empty text element.'); },
    findText: re => { const m = footer.match(new RegExp(re)); return m && { getElement: () => el, getStartOffset: () => m.index, getEndOffsetInclusive: () => m.index + m[0].length - 1 }; }
  }) });
  ctx.stripPageMark_('x');
  ok('page marker removed', footer === 'PEMUDA KOTA WISATA' && saved, footer);
  ctx.DocumentApp.openById = () => ({ saveAndClose: () => {}, getFooter: () => null });
  ctx.stripPageMark_('x');
  ok('no footer is fine', true);
}
// litLocated_ names the failing line once.
{
  const e = new Error('Boom'); e.stack = 'Error: Boom\n    at litFill_ (Liturgi:300:9)\n    at x (Liturgi:9:1)';
  const a = ctx.litLocated_(e);
  ok('error names its line', a.message === 'Boom [di litFill_ (Liturgi:300:9) < x (Liturgi:9:1)]', a.message);
  ok('not located twice', ctx.litLocated_(a) === a || !/\[di .*\[di /.test(ctx.litLocated_(a).message));
}

// writeFooter_ on a new Doc: the blank footer paragraph is never set to empty text.
{
  const footerFor = text => {
    const runs = text ? [text] : [];
    const fp = { getText: () => runs.join(''), clear: () => { runs.length = 0; return fp; }, setAlignment: () => fp,
      setText: v => { if (v === '') throw new Error('Cannot insert an empty text element.'); runs.splice(0, runs.length, v); return fp; },
      appendText: v => { if (!v) throw new Error('Cannot insert an empty text element.'); runs.push(v); return { setAttributes: () => {} }; } };
    return { fp, footer: { getNumChildren: () => 1, getChild: () => ({ asParagraph: () => fp }) } };
  };
  ctx.DocumentApp.HorizontalAlignment = { CENTER: 'C' };
  const fresh = footerFor('');
  ctx.writeFooter_({ getFooter: () => null, addFooter: () => fresh.footer }, '8 November 2026', false);
  ok('new footer written', fresh.fp.getText() === '{{PAGE}}  |  PEMUDA KOTA WISATA – TATA IBADAH MINGGU, 8 NOVEMBER 2026', fresh.fp.getText());
  const old = footerFor('lama');
  ctx.writeFooter_({ getFooter: () => old.footer }, '8 November 2026', false);
  ok('old footer text replaced', !/lama/.test(old.fp.getText()) && /PEMUDA/.test(old.fp.getText()), old.fp.getText());
}
