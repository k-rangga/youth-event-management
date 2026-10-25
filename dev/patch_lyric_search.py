"""Song search by lyrics: one cached index per song, phrase and typo-tolerant word matching, shared by picker and library."""
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(root, 'TataIbadahView.html')
s = open(path).read()


def rep(old, new, n=1):
    global s
    assert s.count(old) == n, (s.count(old), old[:80])
    s = s.replace(old, new)


SEARCH = r'''/* ---------- song search (title, number, credits, lyrics) ---------- */

/* Lowercase, punctuation dropped (so "Firman-Mu" matches "firmanmu"), whitespace collapsed. */
function tiNorm(s) {
  return String(s || '').toLowerCase().replace(/[’‘'`"“”!?.,:;()\[\]\/\-–—]/g, '').replace(/\s+/g, ' ').trim();
}

/* Search text per song, rebuilt only when the song object or its sections change. */
function tiSearchIndex(s) {
  var ix = tiState.searchIx[s.id];
  if (ix && ix.s === s && ix.sec === s.sections) return ix;
  var head = tiNorm(tiSongCode(s) + ' ' + s.title);
  var body = tiNorm(s.credits + ' ' + s.sections.map(function (x) { return x.text; }).join(' '));
  var words = {};
  (head + ' ' + body).split(' ').forEach(function (w) { if (w.length >= 3) words[w] = 1; });
  return (tiState.searchIx[s.id] = { s: s, sec: s.sections, head: head, title: tiNorm(s.title), body: body, words: Object.keys(words) });
}

/* At most one typo between two words: a letter added, dropped, changed or two swapped ("plita" ~ "pelita"). */
function tiNear(a, b) {
  var la = a.length, lb = b.length, i = 0;
  if (Math.abs(la - lb) > 1) return false;
  while (i < la && i < lb && a.charAt(i) === b.charAt(i)) i++;
  if (i === la && i === lb) return true;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1) || (a.charAt(i) === b.charAt(i + 1) && a.charAt(i + 1) === b.charAt(i) && a.slice(i + 2) === b.slice(i + 2));
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

function tiTokenIn(tok, ix) {
  if (ix.head.indexOf(tok) !== -1 || ix.body.indexOf(tok) !== -1) return 1;
  if (tok.length < 4) return 0;
  for (var i = 0; i < ix.words.length; i++) if (tiNear(tok, ix.words[i])) return 2;
  return 0;
}

/* 0 title starts with it · 1 in code/title · 2 phrase in lyrics or credits · 3 every word found · 4 with typos · -1 no match. */
function tiSongRank(s, q, toks) {
  var ix = tiSearchIndex(s);
  if (ix.title.indexOf(q) === 0 || ix.head.indexOf(q) === 0) return 0;
  if (ix.head.indexOf(q) !== -1) return 1;
  if (ix.body.indexOf(q) !== -1) return 2;
  var fuzzy = false;
  for (var i = 0; i < toks.length; i++) {
    var hit = tiTokenIn(toks[i], ix);
    if (!hit) return -1;
    if (hit === 2) fuzzy = true;
  }
  return fuzzy ? 4 : 3;
}

/* Ranks by song id for a query, cached until the query or the library changes. */
function tiSearchRanks(query) {
  var q = tiNorm(query), c = tiState.searchCache;
  if (c && c.q === q && c.songs === tiState.songs) return c;
  var toks = q ? q.split(' ') : [], ranks = {};
  tiState.songs.forEach(function (s) { var r = q ? tiSongRank(s, q, toks) : 0; if (r >= 0) ranks[s.id] = r; });
  return (tiState.searchCache = { q: q, toks: toks, songs: tiState.songs, ranks: ranks });
}

/* The lyric line that best matches the query, shown under results found by their lyrics. */
function tiLyricHit(s, toks) {
  var best = '', bestN = 0;
  s.sections.forEach(function (sec) {
    String(sec.text || '').split('\n').forEach(function (line) {
      var n = tiNorm(line), words = n.split(' '), hits = 0;
      toks.forEach(function (t) { if (n.indexOf(t) !== -1 || (t.length >= 4 && words.some(function (w) { return tiNear(t, w); }))) hits++; });
      if (hits > bestN) { bestN = hits; best = line; }
    });
  });
  return best;
}

'''

rep("function tiPickerMatches() {", SEARCH + "function tiPickerMatches() {")

# picker: ranked, cached matches
rep('''function tiPickerMatches() {
  var pk = tiState.picker, q = pk.q.trim().toLowerCase();
  var matchQ = function (s) {
    if (!q) return true;
    var first = s.sections.length ? String(s.sections[0].text || '').split('\\n')[0] : '';
    return (tiSongCode(s) + ' ' + s.number + ' ' + s.title + ' ' + first).toLowerCase().indexOf(q) !== -1;
  };
  var matchH = function (s, h) { return h === 'Semua' || (h === 'Kontemporer' ? !s.hymnal : s.hymnal === h); };
  return { matchQ: matchQ, matchH: matchH, results: tiState.songs.filter(function (s) { return matchH(s, pk.h) && matchQ(s); }).sort(function (a, b) { return a.title.localeCompare(b.title); }) };
}''', '''function tiPickerMatches() {
  var pk = tiState.picker, sr = tiSearchRanks(pk.q), ranks = sr.ranks;
  var matchH = function (s, h) { return h === 'Semua' || (h === 'Kontemporer' ? !s.hymnal : s.hymnal === h); };
  if (!pk.sorted || pk.sorted.sr !== sr) {
    pk.sorted = { sr: sr, list: tiState.songs.filter(function (s) { return ranks[s.id] != null; })
      .sort(function (a, b) { return ranks[a.id] - ranks[b.id] || a.title.localeCompare(b.title); }) };
  }
  return { matchH: matchH, ranks: ranks, toks: sr.toks, all: pk.sorted.list, results: pk.sorted.list.filter(function (s) { return matchH(s, pk.h); }) };
}''')

rep("placeholder=\"Cari judul, nomor atau baris pertama\"", "placeholder=\"Cari judul, nomor, atau penggalan lirik\"")

# split the list part out so typing does not redraw the detail panel
rep('''function tiRenderPickerParts() {
  var pk = tiState.picker, svc = tiState.cur;
  if (!pk || !document.getElementById('tiPkResults')) return;
  var m = tiPickerMatches();
''', '''function tiRenderPickerParts() {
  var pk = tiState.picker, svc = tiState.cur;
  if (!pk || !document.getElementById('tiPkResults')) return;
  tiRenderPickerList();
''')
rep('''    var count = tiState.songs.filter(function (s) { return m.matchH(s, h) && m.matchQ(s); }).length;''',
    '''    var count = h === 'Semua' ? m.all.length : m.all.filter(function (s) { return m.matchH(s, h); }).length;''')

i = s.index("  document.getElementById('tiPkChips').innerHTML = TI_HYMNALS.map(")
j = s.index("  tiRenderOnline();\n", i) + len("  tiRenderOnline();\n")
listpart = s[i:j]
s = s[:i] + s[j:]
listfn = ('/* Hymnal chips, results and online matches: the part of the picker that follows the search box. */\n'
          'function tiRenderPickerList() {\n  var pk = tiState.picker, svc = tiState.cur, m = tiPickerMatches();\n' + listpart + '}\n\n')
rep("function tiRenderPickerParts() {", listfn + "function tiRenderPickerParts() {")

# lyric line under results found by their lyrics
old_credits = "        (s.credits ? '<span style=\"font-size:12px; color:#8a7952; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;\">' + esc(s.credits) + '</span>' : '') +\n"
assert s.count(old_credits) >= 1
k = s.index(old_credits, s.index('function tiRenderPickerList'))
hit = ("        (m.ranks[s.id] >= 2 && m.toks.length ? '<span style=\"font-size:12.5px; font-style:italic; color:#6E2621; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;\">“' + esc(tiLyricHit(s, m.toks) || '') + '”</span>' : '') +\n")
s = s[:k] + old_credits + hit + s[k + len(old_credits):]

rep("  if (p === 'q') { tiState.picker.q = t.value; tiRenderPickerParts(); tiOnlineSearchSoon(); return; }",
    "  if (p === 'q') { tiState.picker.q = t.value; tiRenderPickerList(); tiOnlineSearchSoon(); return; }")

# library uses the same search (number-only queries keep matching the hymn number)
rep('''  var matchQ = function (s) {
    if (!q) return true;
    if (num) return s.number.toLowerCase().indexOf(num) === 0;
    return (tiSongCode(s) + ' ' + s.title + ' ' + s.credits + ' ' + s.sections.map(function (x) { return x.text; }).join(' ')).toLowerCase().indexOf(q) !== -1;
  };''', '''  var ranks = !num && q ? tiSearchRanks(q).ranks : null;
  var matchQ = function (s) {
    if (!q) return true;
    if (num) return s.number.toLowerCase().indexOf(num) === 0;
    return ranks[s.id] != null;
  };''')
rep("    number: function (a, b) { return (num ? (a.number.toLowerCase() === num ? 0 : 1) - (b.number.toLowerCase() === num ? 0 : 1) : 0) || byNumber(a, b); },",
    "    number: function (a, b) { return (num ? (a.number.toLowerCase() === num ? 0 : 1) - (b.number.toLowerCase() === num ? 0 : 1) : ranks ? ranks[a.id] - ranks[b.id] : 0) || byNumber(a, b); },")

rep("  lib: { q: '',", "  searchIx: {}, searchCache: null,\n  lib: { q: '',")
open(path, 'w').write(s)
print('ok')
