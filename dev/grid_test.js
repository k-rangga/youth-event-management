// Runs buildLiturgy_ against a mock DocumentApp that mimics the real API
// (setText returns void, tables leave a trailing empty paragraph) and
// renders an HTML preview of the A5 pages.
const fs = require('fs'), vm = require('vm');
const T = process.argv[2], OUT = process.argv[3] || 'grid_preview.html';
const ET = { PARAGRAPH: 'PARAGRAPH', TABLE: 'TABLE' };

function mkPara() {
  const p = { type: 'p', runs: [], props: {} };
  const textEl = (r) => ({ setAttributes: a => { r.a = a; return textEl(r); } });
  Object.assign(p, {
    getType: () => ET.PARAGRAPH, asParagraph: () => p, getText: () => p.runs.map(r => r.t || '').join(''),
    appendText: t => { const r = { t, a: {} }; p.runs.push(r); return textEl(r); },
    setText: t => { p.runs = [{ t, a: {} }]; },
    editAsText: () => ({ setAttributes: a => { p.runs.forEach(r => r.a = a); p.emptyAttrs = a; } }),
    appendInlineImage: blob => { const img = { w: 300, h: 100, key: blob.name }; p.runs.push({ img }); const o = { getWidth: () => img.w, getHeight: () => img.h, setWidth: v => { img.w = v; return o; }, setHeight: v => { img.h = v; return o; } }; return o; }
  });
  p.setHeading = () => p;
  ['Alignment:align', 'IndentStart:start', 'IndentFirstLine:first', 'IndentEnd:end', 'SpacingBefore:before', 'SpacingAfter:after', 'LineSpacing:line'].forEach(x => {
    const [m, k] = x.split(':'); p['set' + m] = v => { p.props[k] = v; return p; };
  });
  return p;
}
function mkCell() {
  const c = { kids: [mkPara()], pad: {} };
  c.getChild = i => c.kids[i]; c.getNumChildren = () => c.kids.length;
  c.appendParagraph = () => { const p = mkPara(); c.kids.push(p); return p; };
  ['Top', 'Bottom', 'Left', 'Right'].forEach(s => c['setPadding' + s] = v => { c.pad[s] = v; return c; });
  return c;
}
const kids = [mkPara()];
const INPLACE = process.argv.includes('--inplace');
const body = {
  removeChild: c => { kids.splice(kids.indexOf(c), 1); },
  getChild: i => kids[i], getNumChildren: () => kids.length,
  appendParagraph: () => { const p = mkPara(); kids.push(p); return p; },
  appendPageBreak: () => { const p = mkPara(); p.type = 'break'; kids.push(p); return p; },
  appendTable: cells => {
    const t = { type: 'table', widths: [], border: null, rows: cells.map(r => r.map(() => mkCell())), getType: () => ET.TABLE };
    t.setBorderWidth = v => { t.border = v; return t; }; t.setColumnWidth = (i, w) => { t.widths[i] = w; return t; };
    t.getCell = (r, c) => t.rows[r][c];
    kids.push(t); kids.push(mkPara());   // Docs keeps a paragraph after a trailing table
    return t;
  }
};
['PageWidth', 'PageHeight', 'MarginTop', 'MarginBottom', 'MarginLeft', 'MarginRight'].forEach(m => body['set' + m] = () => body);
body.setHeadingAttributes = () => body;
const footer = mkPara();
// existing Doc: old body content and a footer whose page number is a separate element
let oldFooter = null;
if (INPLACE) {
  kids.push(mkPara(), mkPara()); kids[0].runs = [{ t: 'old content', a: {} }];
  body.appendTable([['', 'old table']]); kids.push(mkPara()); body.appendTable([['•', 'old bullet']]);
  oldFooter = { parts: ['[PAGE#]', '  |  PEMUDA KOTA WISATA – TATA IBADAH MINGGU, 18 OKTOBER 2026'] };
  oldFooter.getText = () => oldFooter.parts.join('');
  oldFooter.replaceText = (re, v) => { oldFooter.parts = oldFooter.parts.map(p => p === '[PAGE#]' ? p : p.replace(new RegExp(re), v)); };
}
const doc = { getBody: () => body, getFooter: () => oldFooter, addFooter: () => ({ getNumChildren: () => 1, getChild: () => footer }) };
const ctx = { console, DocumentApp: { Attribute: { FONT_FAMILY: 'font', FONT_SIZE: 'size', BOLD: 'bold', ITALIC: 'italic', UNDERLINE: 'u', FOREGROUND_COLOR: 'color' },
  HorizontalAlignment: { CENTER: 'center', RIGHT: 'right', JUSTIFY: 'justify', LEFT: 'left' }, ParagraphHeading: { NORMAL: 'N' }, ElementType: ET },
  Utilities: { newBlob: (d, t, n) => ({ name: n }), base64Decode: x => x } };
vm.createContext(ctx);
vm.runInContext(['LiturgiText.js', 'LiturgiAssets.js', 'Liturgi.js'].map(f => fs.readFileSync(T + '/' + f, 'utf8')).join('\n'), ctx);
const songs = {
  kk34: { id: 'kk34', hymnal: 'KK', number: '34', title: 'Kita Masuk RumahNya', credits: 'Syair & lagu: Bruce Ballinger, 1976 · Terjemahan: Yamuger, 1998', sections: [{ label: 'Bait 1', text: 'Kita masuk rumahNya, berkumpul menyembah kepadaNya.\nMenyembah Kristus Tuhan.' }, { label: 'Bait 2', text: 'Lupakanlah dirimu, arahkan hatimu kepadaNya.\nMenyembah Kristus Tuhan.' }, { label: 'Bait 3', text: 'Muliakan namaNya dan angkat tanganmu kepadaNya.' }], arr: 'Bait 1 → Bait 2 → Bait 3' },
  sahk: { id: 'sahk', hymnal: '', number: '', title: 'Sampai Akhir Hidupku', credits: 'Syair & Lagu: JPCC Worship, 2017', sections: [{ label: 'Bait 1', text: 'Baris bait satu\nBaris bait dua' }, { label: 'Chorus', text: 'Baris chorus satu\nBaris chorus dua' }], arr: 'Bait 1 → Chorus → Chorus' },
  kj410: { id: 'kj410', hymnal: 'KJ', number: '410', title: 'Tenanglah Kini Hatiku', credits: 'Syair: Joseph H. Gilmore · Lagu: W. B. Bradbury', sections: [{ label: 'Bait 1', text: 'Tenanglah kini hatiku:\nTuhan memimpin langkahku.' }, { label: 'Ref', text: 'Tuhanlah yang membimbingku;\ntanganku dipegang teguh.' }, { label: 'Bait 2', text: 'Di malam yang gelap benar,\ndi taman indah dan segar,' }, { label: 'Bait 3', text: 'Tak kusesalkan hidupku,' }], arr: 'Bait 1 → Ref → Bait 2 → Ref → Bait 3 → Ref' }
};
const svc = { id: '3', date: '2026-10-25', season: 'Bulan Keluarga', series: 'Glorious Purpose', sub: 'Body of Christ', pf: 'Sdr. Paul Sirait (GKP Tanjung Barat)', kp: '1 Korintus 12:12', baBook: 'Mazmur', baCh: '139', baVs: '23-24', pk: false,
  slots: { b2: 'kk34', b5: 'sahk', b7: 'kj410', b10: 'sahk', b18: 'kj410', b20: 'kk34', b22: null }, arr: {},
  variants: { b8: 'B', b9: '1×', b11: '767F', b21: 'ongko' }, enabled: { b15: true, b22: false }, lyrics: {}, texts: { call: 'Selamat pagi teman-teman, mari bersiap beribadah.', reading: 'Roma 12:1-8', baText: 'Selidikilah aku, ya Allah, dan kenallah hatiku.' } };
if (INPLACE) vm.runInContext('emptyBody_', ctx)(body);
vm.runInContext('buildLiturgy_', ctx)(doc, svc, songs, INPLACE ? { inPlace: true } : undefined);
if (INPLACE) {
  const oldTables = kids.filter(k => k.type === 'table' && k.rows.some(r => r.some(c => /old (table|bullet)/.test(c.kids.map(x => x.getText()).join('')))));
  console.log('in place: old paragraph gone', !kids.some(k => k.type === 'p' && k.getText() === 'old content'), '| old tables left', oldTables.length, '| footer →', oldFooter.getText());
}

// structural checks
const tables = kids.filter(k => k.type === 'table');
const W = vm.runInContext('LIT.width', ctx);
const bad = tables.filter(t => Math.abs(t.widths.reduce((a, b) => a + b, 0) - W) > 0.01 || t.border !== 0);
let blankRuns = 0;
for (let i = 1; i < kids.length; i++) if (kids[i].type === 'p' && !kids[i].getText().trim() && kids[i - 1].type === 'p' && !kids[i - 1].getText().trim() && !kids[i].runs.some(r => r.img)) blankRuns++;
console.log('elements', kids.length, 'tables', tables.length, 'bad widths/borders', bad.length, 'double blank paragraphs', blankRuns, 'width', W.toFixed(1));

// preview
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const imgs = { gki: 'gki.png', pemuda: 'pemuda.png', cover: 'cover.jpg', amin: 'amin.png', haleluyaAmin: 'haleluya_amin.png' };
const pHtml = p => {
  const pr = p.props;
  const st = `text-align:${pr.align || 'left'};padding-left:${pr.start || 0}pt;margin:${pr.before || 0}pt 0 ${pr.after || 0}pt;line-height:${(pr.line || 1) * 1.15}`;
  const inner = p.runs.map(r => r.img ? `<img src="assets/${imgs[r.img.key]}" style="width:${r.img.w}pt;vertical-align:middle">`
    : `<span style="font-family:'${r.a.font}';font-size:${r.a.size}pt;font-weight:${r.a.bold ? 700 : 400};font-style:${r.a.italic ? 'italic' : 'normal'};color:${r.a.color}">${esc(r.t)}</span>`).join('');
  const sz = (p.emptyAttrs && p.emptyAttrs.size) || (p.runs[0] && p.runs[0].a && p.runs[0].a.size) || 12;
  return `<p style="${st};font-size:${sz}pt">${inner || '&#8203;'}</p>`;
};
const m = vm.runInContext('LIT.page.margin', ctx);
let html = `<!doctype html><meta charset=utf-8><link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;700&family=Pacifico&display=swap" rel=stylesheet>
<style>body{background:#ccc;margin:0;padding:20px}.page{width:419.5pt;box-sizing:border-box;padding:${m}pt;background:#fff;margin:0 auto 20px;font-family:'Times New Roman',serif;position:relative}
.page:before{content:'';position:absolute;inset:${m}pt;outline:1px dashed #f3a;pointer-events:none}p{margin:0;white-space:pre-wrap}table{border-collapse:collapse;table-layout:fixed}td{vertical-align:top;padding:0}
.grid td{outline:${process.argv[4] ? '1px dotted #39f' : '0'}}</style><div class=page>`;
kids.forEach(k => {
  if (k.type === 'break') { html += '</div><div class=page>'; return; }
  if (k.type === 'table') {
    html += `<table class=grid style="width:${k.widths.reduce((a, b) => a + b, 0)}pt">` + k.rows.map(r => '<tr>' + r.map((c, i) => `<td style="width:${k.widths[i]}pt;padding-right:${c.pad.Right || 0}pt">${c.kids.map(pHtml).join('')}</td>`).join('') + '</tr>').join('') + '</table>';
    return;
  }
  html += pHtml(k);
});
html += `</div><p style="text-align:center;font:8pt serif">${esc(footer.getText())}</p>`;
fs.writeFileSync(__dirname + '/' + OUT, html);
