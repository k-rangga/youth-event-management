/* ---------- pasted lyrics → sections ---------- */

var TI_HEADING_RE = /^[\[\(]?\s*(bait|verse|ayat|v|reff?|refrain|chorus|korus|bridge|jembatan|pre[\s-]?chorus|pre[\s-]?reff?|tag|coda|ending|outro|intro|interlude|ad[\s-]?lib)\s*(\d+)?\s*[\]\)]?\s*[:.]?\s*(.*)$/i;
var TI_CHORD_RE = /\[[A-G][#b]?(m|maj|min|sus|dim|aug|add)?\d*(\/[A-G][#b]?)?\]/g;
var TI_FOOTER_RE = /^(ccli|©|\(c\)|copyright|for use solely|note: reproduction|all rights reserved|admin\.? by|lisensi)/i;
var TI_FOOTER_SKIP_RE = /^(ccli (song|license)|for use solely|note: reproduction)/i;
var TI_REPEAT_RE = /\s*[\(\[]?\s*(?:x\s*(\d)|(\d)\s*x)\s*[\)\]]?\s*$/i;

/* Canonical label for a heading word: verses become "Bait N", the rest keep a tidy English/Indonesian name. */
function tiHeadingLabel(word, num, counters) {
  var w = word.toLowerCase().replace(/[\s-]/g, '');
  if (w === 'bait' || w === 'verse' || w === 'ayat' || w === 'v') {
    var n = num ? Number(num) : (counters.verse + 1);
    counters.verse = Math.max(counters.verse, n);
    return 'Bait ' + n;
  }
  var names = { ref: 'Ref', reff: 'Ref', refrain: 'Ref', chorus: 'Chorus', korus: 'Chorus', bridge: 'Bridge', jembatan: 'Bridge',
    prechorus: 'Pre-Chorus', preref: 'Pre-Ref', prereff: 'Pre-Ref', tag: 'Tag', coda: 'Coda', ending: 'Ending', outro: 'Outro',
    intro: 'Intro', interlude: 'Interlude', adlib: 'Ad lib' };
  return (names[w] || word) + (num ? ' ' + num : '');
}

/*
 * Turns pasted lyrics into { title, credits, sections:[{label,text}], arr }.
 * Understands section headings ("Verse 1", "Reff:", "[Chorus]", "1."),
 * ChordPro ({title:}, {soc}, [G] chords), SongSelect text exports (title
 * line + CCLI footer) and "(2x)" repeats. Without headings, blank-line
 * paragraphs become verses and a paragraph that repeats becomes the Ref.
 */
function tiParseLyrics(raw) {
  var lines = String(raw || '').replace(/\r\n?/g, '\n').split('\n');
  var title = '', credits = [], blocks = [], cur = null, counters = { verse: 0 }, sawHeading = false, footer = false;

  var start = function (label) { cur = { label: label, lines: [], repeat: 1 }; blocks.push(cur); };
  var push = function (text) {
    if (!cur) start(null);
    var rep = text.match(TI_REPEAT_RE);
    if (rep) { cur.repeat = Number(rep[1] || rep[2]); text = text.replace(rep[0], ''); }
    if (text.trim()) cur.lines.push(text);
  };

  lines.forEach(function (line) {
    var t = line.replace(TI_CHORD_RE, '').replace(/\s+$/, '');
    var trimmed = t.trim();
    var dir = trimmed.match(/^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i);
    if (dir) {
      var key = dir[1].toLowerCase(), val = (dir[2] || '').trim();
      if (key === 'title' || key === 't') title = val;
      else if (/^(subtitle|st|artist|composer|lyricist|copyright)$/.test(key)) { if (val) credits.push(val); }
      else if (key === 'soc' || key === 'start_of_chorus') { sawHeading = true; start(tiHeadingLabel(val || 'Chorus', '', counters)); }
      else if (key === 'sov' || key === 'start_of_verse') { sawHeading = true; start(tiHeadingLabel('Verse', (val.match(/\d+/) || [''])[0], counters)); }
      else if (key === 'sob' || key === 'start_of_bridge') { sawHeading = true; start('Bridge'); }
      else if (/^(c|comment|ci|comment_italic)$/.test(key)) {
        var hm = val.match(TI_HEADING_RE);
        if (hm && !hm[3]) { sawHeading = true; start(tiHeadingLabel(hm[1], hm[2], counters)); }
      } else if (/^(eoc|end_of_chorus|eov|end_of_verse|eob|end_of_bridge)$/.test(key)) cur = null;
      return;
    }
    if (TI_FOOTER_RE.test(trimmed) || (footer && trimmed)) {
      footer = true;
      if (!TI_FOOTER_SKIP_RE.test(trimmed)) credits.push(trimmed.replace(/^(©|\(c\))\s*/i, '© ').replace(/\s*\|\s*/g, ', '));
      return;
    }
    if (!trimmed) { if (cur && cur.lines.length) cur = null; return; }

    var num = trimmed.match(/^(\d+)\s*[.)]\s*(.*)$/);
    if (num && Number(num[1]) < 30) {
      sawHeading = true;
      start(tiHeadingLabel('Bait', num[1], counters));
      if (num[2]) push(num[2]);
      return;
    }
    var repM = trimmed.match(TI_REPEAT_RE);
    var head = repM ? trimmed.replace(repM[0], '').trim() : trimmed;
    var hm2 = head.length <= 40 || /[:\]]/.test(head) ? head.match(TI_HEADING_RE) : null;
    if (hm2 && (!hm2[3] || /^[\[\(]?\s*\w[\w\s-]*\d*\s*[\]\):]/.test(head))) {
      sawHeading = true;
      start(tiHeadingLabel(hm2[1], hm2[2], counters));
      if (repM) cur.repeat = Number(repM[1] || repM[2]);
      if (hm2[3]) push(hm2[3].trim());
      return;
    }
    push(trimmed);
  });

  /* SongSelect / slide exports put the title alone on the first line. */
  if (!title && blocks.length > 1 && !blocks[0].label && blocks[0].lines.length === 1 && blocks[0].lines[0].length <= 60 && (footer || sawHeading)) {
    title = blocks.shift().lines[0];
  }

  var sections = [], order = [], textByLabel = {}, labelByText = {};
  if (!sawHeading) {
    var count = {};
    blocks.forEach(function (b) { var k = b.lines.join('\n'); count[k] = (count[k] || 0) + 1; });
    var refText = Object.keys(count).filter(function (k) { return count[k] > 1; }).sort(function (a, b) { return count[b] - count[a]; })[0];
    var v = 0;
    blocks.forEach(function (b) {
      var k = b.lines.join('\n');
      b.label = k === refText ? 'Ref' : labelByText[k] || 'Bait ' + (++v);
      labelByText[k] = b.label;
    });
  }

  var unnamed = 0;
  blocks.forEach(function (b) {
    var text = b.lines.join('\n').trim();
    var label = b.label || (sections.length ? 'Bagian ' + (++unnamed + 1) : 'Bait 1');
    if (!text) {
      if (textByLabel[label] != null) for (var r = 0; r < b.repeat; r++) order.push(label);
      return;
    }
    if (textByLabel[label] != null && textByLabel[label] !== text) {
      for (var n = 2; textByLabel[label + ' ' + n] != null && textByLabel[label + ' ' + n] !== text; n++);
      label = label + ' ' + n;
    }
    if (textByLabel[label] == null) { textByLabel[label] = text; sections.push({ label: label, text: text }); }
    for (var i = 0; i < b.repeat; i++) order.push(label);
  });

  return { title: title, credits: credits.join(' · '), sections: sections, arr: order.join(' → ') };
}

if (typeof module !== 'undefined') module.exports = tiParseLyrics;
