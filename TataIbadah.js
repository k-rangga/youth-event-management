var TI_SHEET = 'TataIbadah';
var SONGS_SHEET = 'Songs';
var TI_HEADERS = ['ID', 'Date', 'Season', 'Series', 'Sub-theme', 'Pelayan Firman', 'Nas kata pembuka', 'Nas berita anugerah', 'Perjamuan Kudus', 'Status', 'Data', 'Updated at'];
var SONG_HEADERS = ['ID', 'Hymnal', 'Number', 'Title', 'Credits', 'Language', 'Sections', 'Arrangement'];
var TI_STATUSES = ['Draft', 'Review', 'Published'];

/* Starter library so the picker isn't empty on first use. Lyrics are left blank to be filled in from the songbook. */
var SONG_SEED = [
  ['kj3', 'KJ', '3', 'Kami Puji dengan Riang', 'Henry van Dyke · Ludwig van Beethoven', 'Indonesia', ['Bait 1', 'Bait 2', 'Bait 3'], 'Bait 1 → Bait 2 → Bait 3'],
  ['kj392', 'KJ', '392', "'Ku Berbahagia", 'Fanny J. Crosby · Phoebe P. Knapp', 'Indonesia', ['Bait 1', 'Ref', 'Bait 2', 'Bait 3'], 'Bait 1 → Ref → Bait 2 → Ref → Bait 3 → Ref'],
  ['kj337', 'KJ', '337', 'Betapa Kita Tidak Bersyukur', 'Tradisional', 'Indonesia', ['Bait 1', 'Ref', 'Bait 2'], 'Bait 1 → Ref → Bait 2 → Ref'],
  ['goodness', '', '', 'Goodness of God', 'Ed Cash, Ben Fielding, Jason Ingram, Brian Johnson, Jenn Johnson', 'Inggris', ['Bait 1', 'Chorus', 'Bait 2', 'Bridge'], 'Bait 1 → Chorus → Bait 2 → Chorus → Bridge → Chorus'],
  ['waymaker', '', '', 'Way Maker', 'Osinachi Okoro (Sinach)', 'Inggris', ['Bait 1', 'Chorus', 'Tag'], 'Bait 1 → Chorus → Bait 1 → Chorus → Tag'],
  ['buildmylife', '', '', 'Build My Life', 'Pat Barrett, Matt Redman, Kari Jobe, Brett Younker, Karl Martin', 'Inggris', ['Bait 1', 'Chorus', 'Bridge'], 'Bait 1 → Chorus → Bridge → Chorus'],
  ['livinghope', '', '', 'Living Hope', 'Phil Wickham, Brian Johnson', 'Inggris', ['Bait 1', 'Bait 2', 'Chorus', 'Bridge'], 'Bait 1 → Bait 2 → Chorus → Bridge → Chorus'],
  ['firm', '', '', 'Firm Foundation (He Won’t)', 'Cody Carnes, Chandler Moore, Austin Davis', 'Inggris', ['Bait 1', 'Chorus', 'Bridge'], 'Bait 1 → Chorus → Bridge → Chorus'],
  ['greatare', '', '', 'Great Are You Lord', 'Jason Ingram, Leslie Jordan, David Leonard', 'Inggris', ['Bait 1', 'Chorus', 'Bridge'], 'Bait 1 → Chorus → Bridge → Chorus']
];

/** Returns the sheet, creating it with a header row (and optional seed rows) the first time. */
function getOrCreateSheet_(name, headers, seedRows) {
  var ss = getSs_();
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (seedRows && seedRows.length) sheet.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
  return sheet;
}

function parseJson_(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch (e) { return fallback; }
}

function getSongsSheet_() {
  var seed = SONG_SEED.map(function (s) {
    var sections = s[6].map(function (label) { return { label: label, text: '' }; });
    return [s[0], s[1], s[2], s[3], s[4], s[5], JSON.stringify(sections), s[7]];
  });
  return getOrCreateSheet_(SONGS_SHEET, SONG_HEADERS, seed);
}

function songFromRow_(r) {
  return {
    id: String(r[0]),
    hymnal: String(r[1] || ''),
    number: String(r[2] || ''),
    title: String(r[3] || ''),
    credits: String(r[4] || ''),
    language: String(r[5] || ''),
    sections: parseJson_(r[6], []),
    arr: String(r[7] || '')
  };
}

function readSongs_() {
  var sheet = getSongsSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, SONG_HEADERS.length).getValues()
    .filter(function (r) { return r[0] !== '' && r[0] !== null; })
    .map(songFromRow_);
}

function serviceFromRow_(r) {
  var data = parseJson_(r[10], {});
  return {
    id: String(r[0]),
    date: fmtDate_(r[1]),
    season: String(r[2] || ''),
    series: String(r[3] || ''),
    sub: String(r[4] || ''),
    pf: String(r[5] || ''),
    kp: String(r[6] || ''),
    baBook: data.baBook || '',
    baCh: data.baCh || '',
    baVs: data.baVs || '',
    pk: r[8] === true || String(r[8]).toUpperCase() === 'TRUE',
    status: TI_STATUSES.indexOf(String(r[9])) !== -1 ? String(r[9]) : 'Draft',
    slots: data.slots || {},
    arr: data.arr || {},
    variants: data.variants || {},
    enabled: data.enabled || {},
    lyrics: data.lyrics || {},
    doc: data.doc || null
  };
}

/**
 * Everything the Tata Ibadah screens need in one round trip: saved services,
 * the song library, and the Schedule rows (to prefill theme and pastor).
 */
function getTataIbadahData() {
  var tiSheet = getOrCreateSheet_(TI_SHEET, TI_HEADERS);
  var services = [];
  var last = tiSheet.getLastRow();
  if (last >= 2) {
    tiSheet.getRange(2, 1, last - 1, TI_HEADERS.length).getValues().forEach(function (r) {
      if (r[0] !== '' && r[0] !== null) services.push(serviceFromRow_(r));
    });
  }

  var songs = readSongs_();

  var schedule = [];
  var schedSheet = getSs_().getSheetByName(SCHEDULE_SHEET);
  if (schedSheet && schedSheet.getLastRow() >= 2) {
    schedSheet.getRange(2, 1, schedSheet.getLastRow() - 1, 5).getValues().forEach(function (r) {
      if (r[0] === '' || r[0] === null) return;
      schedule.push({ date: fmtDate_(r[1]), theme: String(r[2] || ''), pastor: String(r[3] || ''), tag: String(r[4] || '') });
    });
  }

  return { services: services, songs: songs, schedule: schedule };
}

/**
 * Creates or updates one service row. One service per date: saving onto a
 * date another service already has is refused.
 */
function saveTataIbadah(p) {
  p = p || {};
  var id = p.id ? String(p.id) : '';
  var date = String(p.date || '').trim();
  var dateObj = new Date(date + 'T00:00:00');
  if (!date || isNaN(dateObj)) return { success: false, message: 'Tanggal belum valid.' };
  var status = TI_STATUSES.indexOf(p.status) !== -1 ? p.status : 'Draft';
  var ba = p.baBook && p.baCh && p.baVs ? p.baBook + ' ' + p.baCh + ':' + p.baVs : '';
  var data = {
    baBook: p.baBook || '', baCh: String(p.baCh || ''), baVs: p.baVs || '',
    slots: p.slots || {}, arr: p.arr || {}, variants: p.variants || {}, enabled: p.enabled || {}, lyrics: p.lyrics || {}
  };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getOrCreateSheet_(TI_SHEET, TI_HEADERS);
    var last = sheet.getLastRow();
    var keys = last > 1 ? sheet.getRange(2, 1, last - 1, 2).getValues() : [];
    var rowIndex = -1, maxId = 0;
    for (var i = 0; i < keys.length; i++) {
      var rowId = String(keys[i][0]);
      var n = Number(keys[i][0]);
      if (!isNaN(n) && n > maxId) maxId = n;
      if (id && rowId === id) { rowIndex = i; continue; }
      if (rowId && fmtDate_(keys[i][1]) === date) {
        return { success: false, message: 'Sudah ada tata ibadah untuk tanggal ' + date + '.' };
      }
    }
    if (id && rowIndex === -1) return { success: false, message: 'Tata ibadah ini sudah dihapus.' };

    var now = new Date();
    var newId = id || String(maxId + 1);
    if (rowIndex !== -1) {
      var prev = parseJson_(sheet.getRange(rowIndex + 2, 11).getValue(), {});
      if (prev.doc) data.doc = prev.doc;
    }
    var row = [newId, dateObj, p.season || '', p.series || '', p.sub || '', p.pf || '', p.kp || '', ba, !!p.pk, status, JSON.stringify(data), now];
    if (rowIndex !== -1) sheet.getRange(rowIndex + 2, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    return { success: true, id: newId, savedAt: Utilities.formatDate(now, TZ, 'HH.mm') };
  } finally {
    lock.releaseLock();
  }
}

function deleteTataIbadah(id) {
  id = String(id || '').trim();
  if (!id) return { success: false, message: 'ID tidak ada.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getOrCreateSheet_(TI_SHEET, TI_HEADERS);
    var last = sheet.getLastRow();
    if (last < 2) return { success: false, message: 'Tata ibadah tidak ditemukan.' };
    var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === id) {
        sheet.deleteRow(i + 2);
        return { success: true, message: 'Tata ibadah dihapus' };
      }
    }
    return { success: false, message: 'Tata ibadah tidak ditemukan.' };
  } finally {
    lock.releaseLock();
  }
}

/** Adds a song to the library, or updates it when p.id matches an existing row. */
function saveSong(p) {
  p = p || {};
  var title = String(p.title || '').trim();
  if (!title) return { success: false, message: 'Judul lagu wajib diisi.' };
  var sections = (Array.isArray(p.sections) ? p.sections : []).map(function (s) {
    return { label: String(s.label || '').trim(), text: String(s.text || '') };
  }).filter(function (s) { return s.label; });
  if (!sections.length) return { success: false, message: 'Tambahkan minimal satu bagian lagu.' };
  var arr = String(p.arr || '').trim() || sections.map(function (s) { return s.label; }).join(' → ');
  var hymnal = String(p.hymnal || '').trim();
  var number = String(p.number || '').trim();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSongsSheet_();
    var last = sheet.getLastRow();
    var ids = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    var id = p.id ? String(p.id) : '';
    var rowIndex = id ? ids.indexOf(id) : -1;
    if (id && rowIndex === -1) return { success: false, message: 'Lagu tidak ditemukan.' };
    if (!id) {
      var base = (hymnal ? hymnal + number : title).toLowerCase().replace(/[^a-z0-9]+/g, '') || 'lagu';
      id = base;
      for (var k = 2; ids.indexOf(id) !== -1; k++) id = base + '-' + k;
    }
    var row = [id, hymnal, number, title, String(p.credits || '').trim(), String(p.language || '').trim(), JSON.stringify(sections), arr];
    if (rowIndex !== -1) sheet.getRange(rowIndex + 2, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    return { success: true, message: rowIndex !== -1 ? 'Lagu diperbarui' : 'Lagu ditambahkan ke perpustakaan', song: songFromRow_(row) };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- online hymnal lookup (Alkitab Mobile SABDA) ---------- */

var HYMNAL_SOURCE = 'https://alkitab.mobi/kidung/';
var HYMNAL_CODES = { KJ: 'kj', KK: 'kk', PKJ: 'pkj', NKB: 'nkb' };

function decodeHtml_(s) {
  var named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—' };
  return String(s || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (m, e) {
    if (e.charAt(0) === '#') return String.fromCharCode(e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return named[e.toLowerCase()] != null ? named[e.toLowerCase()] : m;
  });
}

/* KK titles come in all caps; everything else is kept as published. */
function hymnalTitle_(title) {
  title = decodeHtml_(title).trim();
  if (title !== title.toUpperCase()) return title;
  return title.toLowerCase().replace(/(^|[\s(“"‘'\-])(\S)/g, function (m, pre, ch) { return pre + ch.toUpperCase(); });
}

/** [[number, title], ...] for one hymnal, cached for six hours. */
function getHymnalIndex_(hymnal) {
  var code = HYMNAL_CODES[hymnal];
  var cache = CacheService.getScriptCache();
  var hit = cache.get('hymnal-index-' + code);
  if (hit) return JSON.parse(hit);
  var html = UrlFetchApp.fetch(HYMNAL_SOURCE + code + '/', { muteHttpExceptions: true }).getContentText();
  var re = new RegExp('kidung/' + code + '/(\\d+[a-z]?)/">' + hymnal + ' \\S+ - ([^<]*)', 'g');
  var out = [], m, seen = {};
  while ((m = re.exec(html))) {
    if (seen[m[1]]) continue;
    seen[m[1]] = true;
    out.push([m[1], hymnalTitle_(m[2])]);
  }
  if (out.length) cache.put('hymnal-index-' + code, JSON.stringify(out), 21600);
  return out;
}

function normSearch_(s) {
  return String(s || '').toLowerCase().replace(/[’‘'`"“”!?.,:;()\-]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Searches the online KJ / KK / PKJ / NKB indexes by number ("392", "KJ 392")
 * or title. `hymnal` limits it to one book; anything else searches all four.
 */
function searchHymnalOnline(query, hymnal) {
  var q = normSearch_(query);
  if (q.length < 1) return { success: true, results: [] };
  var books = HYMNAL_CODES[hymnal] ? [hymnal] : Object.keys(HYMNAL_CODES);
  var m = q.match(/^(kj|kk|pkj|nkb)\s*(\S*)$/);
  if (m) { books = [m[1].toUpperCase()]; q = m[2]; }

  var have = {};
  readSongs_().forEach(function (s) { if (s.hymnal) have[s.hymnal + '|' + s.number] = s.id; });

  var results = [];
  books.forEach(function (book) {
    getHymnalIndex_(book).forEach(function (row) {
      var num = row[0], title = normSearch_(row[1]), rank;
      if (!q) rank = 3;
      else if (num === q) rank = 0;
      else if (/^\d/.test(q) && num.indexOf(q) === 0) rank = 1;
      else if (title.indexOf(q) === 0) rank = 2;
      else if (title.indexOf(q) !== -1) rank = 3;
      else return;
      results.push({ hymnal: book, number: num, title: row[1], rank: rank, songId: have[book + '|' + num] || '' });
    });
  });
  results.sort(function (a, b) { return a.rank - b.rank || (parseInt(a.number, 10) - parseInt(b.number, 10)); });
  return { success: true, results: results.slice(0, 40), source: 'alkitab.mobi' };
}

/* Text of one song (or one version of it) from a page chunk: { credits, sections:[{label,text}], arr }. */
function parseHymnalChunk_(chunk) {
  var creditsM = chunk.match(/<small><em>([\s\S]*?)<\/em><\/small>/);
  var credits = creditsM ? decodeHtml_(creditsM[1].replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').replace(/^[\s·]+|[\s·]+$/g, '') : '';
  var cut = chunk.indexOf('<small><em>');
  if (cut !== -1) chunk = chunk.slice(0, cut);

  var sections = [], order = [], byLabel = {}, m;
  var pRe = /<p>([\s\S]*?)<\/p>/g;
  while ((m = pRe.exec(chunk))) {
    var p = m[1], label;
    var verse = p.match(/<i>\s*<strong>\s*(\d+)\s*<\/strong>\s*\.?\s*<\/i>/);
    if (verse) label = 'Bait ' + verse[1];
    else if (/<i>\s*Reff?\s*:?\s*<\/i>/i.test(p)) label = 'Ref';
    else label = sections.length ? 'Bagian ' + (sections.length + 1) : 'Bait 1';
    var text = decodeHtml_(p.replace(/<i>[\s\S]*?<\/i>/, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
      .split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean).join('\n');
    if (!text) continue;
    order.push(label);
    if (!byLabel[label]) { byLabel[label] = true; sections.push({ label: label, text: text }); }
  }
  return { credits: credits, sections: sections, arr: order.join(' → ') };
}

/**
 * Parses one song page. Some numbers (e.g. KK 767) hold several versions on
 * one page, marked "KK 767a", "KK 767b"…; pass `variant` ("767h") to pick one,
 * otherwise those pages return { title, variants:[{number, preview, credits}] }.
 */
function parseHymnalPage_(html, variant) {
  var start = html.lastIndexOf('class="paragraphtitle"');
  if (start === -1) return null;
  var body = html.slice(start);
  var end = body.indexOf('<div class="share"');
  if (end !== -1) body = body.slice(0, end);
  var titleM = body.match(/<strong>([^<]*)<\/strong>/);
  var title = titleM ? decodeHtml_(titleM[1]).replace(/^\S+\s+\S+\s+-\s+/, '') : '';

  var markRe = /<p><strong>\s*\S+\s+(\d+[a-z])\s*<\/strong><\/p>/gi, marks = [], m;
  while ((m = markRe.exec(body))) marks.push({ number: m[1].toLowerCase(), at: m.index, after: m.index + m[0].length });
  if (!marks.length) {
    var one = parseHymnalChunk_(body.slice(titleM ? body.indexOf(titleM[0]) + titleM[0].length : 0));
    return one.sections.length ? { title: title, credits: one.credits, sections: one.sections, arr: one.arr } : null;
  }

  var chunks = marks.map(function (mk, i) {
    var c = parseHymnalChunk_(body.slice(mk.after, i + 1 < marks.length ? marks[i + 1].at : body.length));
    c.number = mk.number;
    return c;
  });
  if (!variant) {
    return { title: title, variants: chunks.map(function (c) {
      return { number: c.number, preview: c.sections.length ? c.sections[0].text.split('\n')[0] : '', credits: c.credits };
    }) };
  }
  var pick = chunks.filter(function (c) { return c.number === String(variant).toLowerCase(); })[0];
  return pick && pick.sections.length ? { title: title, credits: pick.credits, sections: pick.sections, arr: pick.arr } : null;
}

/**
 * Adds one hymn from the online hymnal to the library. `number` may carry a
 * version letter ("767h"). A library song with the same book and number is
 * filled in only if its lyrics are still blank, so edits made here are never
 * overwritten. Numbers with several versions come back as
 * { success:false, variants } for the caller to choose from.
 */
function importHymnalSong(hymnal, number) {
  var code = HYMNAL_CODES[hymnal];
  number = String(number || '').trim().toLowerCase();
  var nm = number.match(/^(\d+)([a-z]?)$/);
  if (!code || !nm) return { success: false, message: 'Nomor lagu tidak valid.' };

  var existing = readSongs_().filter(function (s) { return s.hymnal === hymnal && s.number.toLowerCase() === number; })[0];
  var blank = existing && !existing.sections.some(function (s) { return String(s.text || '').trim(); });
  if (existing && !blank) return { success: true, message: 'Lagu sudah ada di perpustakaan', song: existing };

  var res = UrlFetchApp.fetch(HYMNAL_SOURCE + code + '/' + nm[1] + '/', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { success: false, message: 'Gagal mengambil ' + hymnal + ' ' + number + ' (HTTP ' + res.getResponseCode() + ').' };
  var parsed = parseHymnalPage_(res.getContentText(), nm[2] ? number : '');
  if (parsed && parsed.variants) return { success: false, message: hymnal + ' ' + nm[1] + ' punya beberapa versi. Pilih salah satu.', title: hymnalTitle_(parsed.title), variants: parsed.variants };
  if (!parsed) return { success: false, message: 'Lirik ' + hymnal + ' ' + number + ' tidak ditemukan di sumber.' };

  return saveSong({
    id: existing ? existing.id : '',
    hymnal: hymnal,
    number: number,
    title: existing ? existing.title : hymnalTitle_(parsed.title),
    credits: (existing && existing.credits) || parsed.credits,
    language: (existing && existing.language) || 'Indonesia',
    arr: parsed.arr,
    sections: parsed.sections
  });
}
