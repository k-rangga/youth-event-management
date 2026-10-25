"""Nyanyian persembahan: choose after which part the offering bags go round; the booklet splits the song there."""
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def patch(name, pairs):
    p = os.path.join(root, name)
    s = open(p).read()
    for o, n in pairs:
        assert s.count(o) == 1, (name, s.count(o), o[:80])
        s = s.replace(o, n)
    open(p, 'w').write(s)


patch('TataIbadahView.html', [
    ("  if (svc.ofBook == null) {", "  svc.breaks = svc.breaks || {};\n  if (svc.ofBook == null) {"),
    ("enabled: { b15: !!(next && next.pk), b22: false }, lyrics: {}, texts: {}", "enabled: { b15: !!(next && next.pk), b22: false }, lyrics: {}, breaks: {}, texts: {}"),
    ("    svc.lyrics = JSON.parse(JSON.stringify(prev.lyrics || {}));\n", "    svc.lyrics = JSON.parse(JSON.stringify(prev.lyrics || {}));\n    svc.breaks = JSON.parse(JSON.stringify(prev.breaks || {}));\n"),
    ("slots: svc.slots, arr: svc.arr,", "slots: svc.slots, arr: svc.arr, breaks: svc.breaks,"),
    ("          (arr ? '<span style=\"font-size:12.5px; font-weight:600; color:#6b5a38;\">' + esc(arr) + '</span>'",
     "          (arr ? '<span style=\"font-size:12.5px; font-weight:600; color:#6b5a38;\">' + (b.cue ? tiArrWithBreak(svc, b.k, arr) : esc(arr)) + '</span>'"),
    ("        (b.cue ? '<span style=\"font-size:13px; font-style:italic; font-weight:600; color:#31536f; margin-top:2px;\">' + esc(b.cue) + '</span>' : '') +",
     "        (b.cue ? tiBreakHtml(b, svc, arr) : '') +"),
    ("function tiBlockHtml(b) {",
     "/* Nyanyian persembahan pauses for the offering bags after a chosen part (svc.breaks[k] = parts sung before); by default before the last part. */\n"
     "function tiBreakAt(svc, k, n) {\n"
     "  var v = svc.breaks && svc.breaks[k];\n"
     "  return v != null ? Math.max(1, Math.min(Number(v), n)) : n >= 2 ? n - 1 : n;\n"
     "}\n\n"
     "function tiArrWithBreak(svc, k, arr) {\n"
     "  var order = arr.split(' → '), at = tiBreakAt(svc, k, order.length);\n"
     "  var mark = '<span style=\"color:#31536f; font-style:italic;\">persembahan diedarkan</span>';\n"
     "  return esc(order.slice(0, at).join(' → ')) + ' → ' + mark + (at < order.length ? ' → ' + esc(order.slice(at).join(' → ')) : '');\n"
     "}\n\n"
     "function tiBreakHtml(b, svc, arr) {\n"
     "  var order = arr ? arr.split(' → ') : [];\n"
     "  var cue = '<span style=\"font-size:13px; font-style:italic; font-weight:600; color:#31536f; margin-top:2px;\">' + esc(b.cue) + '</span>';\n"
     "  if (order.length < 2) return cue;\n"
     "  var at = tiBreakAt(svc, b.k, order.length);\n"
     "  var dup = order.some(function (l, i) { return order.indexOf(l) !== i; });\n"
     "  return cue + '<div style=\"display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:2px;\">' +\n"
     "    '<span style=\"font-size:12.5px; font-weight:600; color:#8a7952;\">Kantong diedarkan setelah</span>' +\n"
     "    '<div class=\"ti-seg\">' + order.map(function (l, i) {\n"
     "      return '<button data-ti=\"break\" data-k=\"' + b.k + '\" data-v=\"' + (i + 1) + '\" class=\"' + (at === i + 1 ? 'on' : '') + '\">' + esc((dup ? (i + 1) + '. ' : '') + l) + '</button>';\n"
     "    }).join('') + '</div></div>';\n"
     "}\n\n"
     "function tiBlockHtml(b) {"),
    ("  var editing = { toggle: 1, variant: 1, pick: 1,", "  var editing = { toggle: 1, variant: 1, break: 1, pick: 1,"),
    ("    case 'variant': svc.variants[k] = v; tiRenderBlock(k); tiRenderAside(); tiQueueSave(); break;",
     "    case 'variant': svc.variants[k] = v; tiRenderBlock(k); tiRenderAside(); tiQueueSave(); break;\n    case 'break': svc.breaks[k] = Number(v); tiRenderBlock(k); tiQueueSave(); break;"),
])

patch('TataIbadah.js', [
    ("    lyrics: data.lyrics || {},\n", "    lyrics: data.lyrics || {},\n    breaks: data.breaks || {},\n"),
    ("lyrics: p.lyrics || {},\n", "lyrics: p.lyrics || {}, breaks: p.breaks || {},\n"),
])

patch('Liturgi.js', [
    ("function writeSong_(w, svc, k, songs) {", "/* brk.write() runs where the song pauses (Nyanyian persembahan: offering bags); see tiBreakAt in the builder. */\nfunction writeSong_(w, svc, k, songs, brk) {"),
    ("""  var runs = [];
  order.forEach(function (l) {""", """  if (!brk) { writeSongRows_(w, svc, song, order, textOf, hymn); return; }
  var v = svc.breaks && svc.breaks[k], n = order.length;
  var at = v != null ? Math.max(1, Math.min(Number(v), n)) : n >= 2 ? n - 1 : n;
  writeSongRows_(w, svc, song, order.slice(0, at), textOf, hymn);
  brk.write();
  if (at < n) writeSongRows_(w, svc, song, order.slice(at), textOf, hymn);
}

/* The lyrics of one run of parts, as a numbered table (repeats become tags like "Ref. (2x)"). */
function writeSongRows_(w, svc, song, order, textOf, hymn) {
  var runs = [];
  order.forEach(function (l) {"""),
    ("""  writeSong_(w, svc, 'b18', songs);
  w.note('(Usher maju ke depan, Pnt menyerahkan kantong persembahan)');
  w.note('(instrumentalia sampai kantong persembahan selesai diedarkan)');
  w.note('(multimedia menayangkan QR persembahan)');
  w.p('(umat berdiri)', { italic: true, align: 'center', before: 8, after: LIT.space.note[1] });
""", """  writeSong_(w, svc, 'b18', songs, { write: function () {
    w.note('(Usher maju ke depan, Pnt menyerahkan kantong persembahan)');
    w.note('(instrumentalia sampai kantong persembahan selesai diedarkan)');
    w.note('(multimedia menayangkan QR persembahan)');
    w.p('(umat berdiri)', { italic: true, align: 'center', before: 8, after: LIT.space.note[1] });
  } });
"""),
])
print('ok')
