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
    kpBook: data.kpBook || '', kpCh: data.kpCh || '', kpVs: data.kpVs || '',
    baBook: data.baBook || '',
    baCh: data.baCh || '',
    baVs: data.baVs || '',
    // Left undefined on services saved before the offering verse was per service: they print LITURGI_OFFERING_VERSE.
    ofBook: data.ofBook, ofCh: data.ofCh, ofVs: data.ofVs,
    pk: r[8] === true || String(r[8]).toUpperCase() === 'TRUE',
    status: TI_STATUSES.indexOf(String(r[9])) !== -1 ? String(r[9]) : 'Draft',
    slots: data.slots || {},
    arr: data.arr || {},
    variants: data.variants || {},
    enabled: data.enabled || {},
    lyrics: data.lyrics || {},
    texts: data.texts || {},
    doc: data.doc || null,
    updatedAt: stamp_(r[11])
  };
}

/* Row timestamp as a comparable string, to the second ('' when never saved). */
function stamp_(v) {
  return v instanceof Date ? Utilities.formatDate(v, 'UTC', "yyyy-MM-dd'T'HH:mm:ss") : String(v || '');
}

/**
 * Everything the Tata Ibadah screens need in one round trip: saved services,
 * the song library, and the Schedule rows (to prefill theme and pastor).
 */
function getTataIbadahData() {
  try { reconcileServicesWithSchedule_(); } catch (e) { console.warn('Service sync skipped: ' + e.message); }
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
      schedule.push({ id: String(r[0]), date: fmtDate_(r[1]), theme: String(r[2] || ''), pastor: String(r[3] || ''), tag: String(r[4] || '') });
    });
  }

  return { services: services, songs: songs, schedule: schedule, liturgy: getLiturgyText_() };
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
    kpBook: p.kpBook || '', kpCh: String(p.kpCh || ''), kpVs: p.kpVs || '',
    baBook: p.baBook || '', baCh: String(p.baCh || ''), baVs: p.baVs || '',
    ofBook: p.ofBook || '', ofCh: String(p.ofCh || ''), ofVs: p.ofVs || '',
    slots: p.slots || {}, arr: p.arr || {}, variants: p.variants || {}, enabled: p.enabled || {}, lyrics: p.lyrics || {},
    texts: p.texts || {}
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

    var now = new Date(Math.floor(Date.now() / 1000) * 1000);
    var newId = id || String(maxId + 1);
    if (rowIndex !== -1) {
      var current = sheet.getRange(rowIndex + 2, 1, 1, TI_HEADERS.length).getValues()[0];
      // Someone else saved since this browser loaded the service: hand back their version instead of overwriting it.
      if (!p.force && p.baseUpdatedAt && stamp_(current[11]) && stamp_(current[11]) !== p.baseUpdatedAt) {
        return { success: false, conflict: true, message: 'Tata ibadah ini baru disimpan dari perangkat lain.', latest: serviceFromRow_(current) };
      }
      var prev = parseJson_(current[10], {});
      if (prev.doc) data.doc = prev.doc;
    }
    var row = [newId, dateObj, p.season || '', p.series || '', p.sub || '', p.pf || '', p.kp || '', ba, !!p.pk, status, JSON.stringify(data), now];
    if (rowIndex !== -1) sheet.getRange(rowIndex + 2, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    var sync = null;
    try { sync = pushServiceToSchedule_(date, p.series, p.sub, p.pf); } catch (e) { console.warn('Schedule sync skipped: ' + e.message); }
    return { success: true, id: newId, savedAt: Utilities.formatDate(now, TZ, 'HH.mm'), updatedAt: stamp_(now),
      schedule: sync ? sync.event : null, scheduleChanged: !!(sync && sync.changed) };
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

/* At most one typo between two words (as tiNear in the client). */
function nearWord_(a, b) {
  var la = a.length, lb = b.length, i = 0;
  if (Math.abs(la - lb) > 1) return false;
  while (i < la && i < lb && a.charAt(i) === b.charAt(i)) i++;
  if (i === la && i === lb) return true;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1) || (a.charAt(i) === b.charAt(i + 1) && a.charAt(i + 1) === b.charAt(i) && a.slice(i + 2) === b.slice(i + 2));
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
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

  var toks = /^\d/.test(q) ? [] : q.split(' ').filter(Boolean);
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
      else if (toks.length && toks.every(function (t) { return title.indexOf(t) !== -1 || (t.length >= 4 && title.split(' ').some(function (w) { return nearWord_(t, w); })); })) rank = 4;
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

/* A hymnal page's HTML, cached for six hours (versions of one number share a page). */
function hymnalPage_(code, num) {
  var key = 'hymnal-page-' + code + '-' + num;
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return { code: 200, html: hit };
  var res = UrlFetchApp.fetch(HYMNAL_SOURCE + code + '/' + num + '/', { muteHttpExceptions: true });
  var html = res.getContentText();
  if (res.getResponseCode() === 200 && html.length < 90000) cache.put(key, html, 21600);
  return { code: res.getResponseCode(), html: html };
}

/**
 * Adds one hymn from the online hymnal to the library. `number` may carry a
 * version letter ("767h"). A library song with the same book and number is
 * filled in only if its lyrics are still blank, so edits made here are never
 * overwritten. Numbers with several versions come back as
 * { success:false, variants } for the caller to choose from.
 * Reads only the key columns and the one matching row, and writes only that
 * row, so it stays fast with the full hymnals in the library.
 */
function importHymnalSong(hymnal, number) {
  var started = Date.now();
  var code = HYMNAL_CODES[hymnal];
  number = String(number || '').trim().toLowerCase();
  var nm = number.match(/^(\d+)([a-z]?)$/);
  if (!code || !nm) return { success: false, message: 'Nomor lagu tidak valid.' };

  var sheet = getSongsSheet_();
  var findRow = function () {
    var last = sheet.getLastRow();
    var keys = last > 1 ? sheet.getRange(2, 1, last - 1, 3).getValues() : [];
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][1]) === hymnal && String(keys[i][2]).toLowerCase() === number) return { index: i, keys: keys };
    }
    return { index: -1, keys: keys };
  };
  var found = findRow();
  var existing = found.index !== -1 ? songFromRow_(sheet.getRange(found.index + 2, 1, 1, SONG_HEADERS.length).getValues()[0]) : null;
  var hasLyrics = existing && existing.sections.some(function (s) { return String(s.text || '').trim(); });
  if (hasLyrics) return { success: true, message: 'Lagu sudah ada di perpustakaan', song: existing, ms: Date.now() - started };

  var page = hymnalPage_(code, nm[1]);
  if (page.code !== 200) return { success: false, message: 'Gagal mengambil ' + hymnal + ' ' + number + ' (HTTP ' + page.code + ').' };
  var parsed = parseHymnalPage_(page.html, nm[2] ? number : '');
  if (parsed && parsed.variants) return { success: false, message: hymnal + ' ' + nm[1] + ' punya beberapa versi. Pilih salah satu.', title: hymnalTitle_(parsed.title), variants: parsed.variants };
  if (!parsed) return { success: false, message: 'Lirik ' + hymnal + ' ' + number + ' tidak ditemukan di sumber.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    found = findRow();   // rows may have moved while the page was fetched
    var id;
    if (found.index !== -1) id = String(found.keys[found.index][0]);
    else {
      var ids = {};
      found.keys.forEach(function (k) { ids[String(k[0])] = true; });
      var base = (hymnal + number).toLowerCase();
      id = base;
      for (var n = 2; ids[id]; n++) id = base + '-' + n;
    }
    var row = [id, hymnal, number,
      existing ? existing.title : hymnalTitle_(parsed.title),
      (existing && existing.credits) || parsed.credits,
      (existing && existing.language) || 'Indonesia',
      JSON.stringify(parsed.sections), parsed.arr];
    if (found.index !== -1) sheet.getRange(found.index + 2, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    return { success: true, message: found.index !== -1 ? 'Lirik diambil' : 'Lagu ditambahkan ke perpustakaan', song: songFromRow_(row), ms: Date.now() - started };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Bible text (Alkitab Mobile SABDA, TB) ---------- */

var BIBLE_BOOKS = ['Kejadian', 'Keluaran', 'Imamat', 'Bilangan', 'Ulangan', 'Yosua', 'Hakim-hakim', 'Rut', '1 Samuel', '2 Samuel', '1 Raja-raja', '2 Raja-raja', '1 Tawarikh', '2 Tawarikh', 'Ezra', 'Nehemia', 'Ester', 'Ayub', 'Mazmur', 'Amsal', 'Pengkhotbah', 'Kidung Agung', 'Yesaya', 'Yeremia', 'Ratapan', 'Yehezkiel', 'Daniel', 'Hosea', 'Yoel', 'Amos', 'Obaja', 'Yunus', 'Mikha', 'Nahum', 'Habakuk', 'Zefanya', 'Hagai', 'Zakharia', 'Maleakhi', 'Matius', 'Markus', 'Lukas', 'Yohanes', 'Kisah Para Rasul', 'Roma', '1 Korintus', '2 Korintus', 'Galatia', 'Efesus', 'Filipi', 'Kolose', '1 Tesalonika', '2 Tesalonika', '1 Timotius', '2 Timotius', 'Titus', 'Filemon', 'Ibrani', 'Yakobus', '1 Petrus', '2 Petrus', '1 Yohanes', '2 Yohanes', '3 Yohanes', 'Yudas', 'Wahyu'];
var BIBLE_ABBR = ['Kej', 'Kel', 'Im', 'Bil', 'Ul', 'Yos', 'Hak', 'Rut', '1Sam', '2Sam', '1Raj', '2Raj', '1Taw', '2Taw', 'Ezr', 'Neh', 'Est', 'Ayb', 'Mzm', 'Ams', 'Pkh', 'Kid', 'Yes', 'Yer', 'Rat', 'Yeh', 'Dan', 'Hos', 'Yl', 'Am', 'Ob', 'Yun', 'Mi', 'Nah', 'Hab', 'Zef', 'Hag', 'Za', 'Mal', 'Mat', 'Mrk', 'Luk', 'Yoh', 'Kis', 'Rm', '1Kor', '2Kor', 'Gal', 'Ef', 'Flp', 'Kol', '1Tes', '2Tes', '1Tim', '2Tim', 'Tit', 'Flm', 'Ibr', 'Yak', '1Ptr', '2Ptr', '1Yoh', '2Yoh', '3Yoh', 'Yud', 'Why'];

/* { verseNumber: text } for one chapter, cached for six hours. */
function bibleChapter_(abbr, ch) {
  var key = 'tb-' + abbr + '-' + ch;
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var res = UrlFetchApp.fetch('https://alkitab.mobi/tb/' + abbr + '/' + ch + '/', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  var verses = {}, m;
  var re = /<span class="reftext"><a name=v(\d+)[^>]*>\d+<\/a><\/span>([\s\S]*?)<\/p>/g;
  var html = res.getContentText();
  while ((m = re.exec(html))) verses[m[1]] = decodeHtml_(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  if (Object.keys(verses).length) cache.put(key, JSON.stringify(verses), 21600);
  return verses;
}

/** Verse text for "Book ch:vs" (vs like "1", "1-3", "1,4"). Returns { success, ref, text, verses:[{n, text}] }. */
function fetchBibleText(book, ch, vs) {
  var i = BIBLE_BOOKS.indexOf(String(book || ''));
  ch = parseInt(ch, 10);
  vs = String(vs || '').replace(/\s+/g, '').replace(/–/g, '-');
  if (i === -1 || !(ch > 0) || !/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(vs)) return { success: false, message: 'Nas belum lengkap.' };
  var nums = [];
  vs.split(',').forEach(function (part) {
    var ab = part.split('-').map(Number);
    for (var n = ab[0]; n <= (ab[1] || ab[0]) && nums.length < 60; n++) nums.push(n);
  });
  var chapter = bibleChapter_(BIBLE_ABBR[i], ch);
  if (!chapter) return { success: false, message: 'Teks Alkitab tidak bisa diambil sekarang.' };
  var verses = nums.filter(function (n) { return chapter[n]; }).map(function (n) { return { n: n, text: chapter[n] }; });
  if (!verses.length) return { success: false, message: BIBLE_BOOKS[i] + ' ' + ch + ':' + vs + ' tidak ditemukan.' };
  return { success: true, ref: BIBLE_BOOKS[i] + ' ' + ch + ':' + vs, text: verses.map(function (v) { return v.text; }).join(' '), verses: verses };
}

/* ---------- Schedule sync ---------- */

/* Tata Ibadah is for services only: a day's service is its Schedule row tagged "Service". */
function isServiceTag_(tag) {
  return String(tag || '').trim().toLowerCase() === 'service';
}

function pickScheduleEvent_(events) {
  return events.filter(function (e) { return isServiceTag_(e.tag); })[0] || null;
}

/* ---------- song library ---------- */

/**
 * Deletes a song. If services still use it, `replaceWith` (another song id)
 * takes its place in their slots and per-service lyrics; without one the
 * delete is refused and the usage count returned.
 */
function deleteSong(id, replaceWith) {
  id = String(id || '');
  replaceWith = replaceWith ? String(replaceWith) : '';
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var songSheet = getSongsSheet_();
    var lastSong = songSheet.getLastRow();
    var ids = lastSong > 1 ? songSheet.getRange(2, 1, lastSong - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    var at = ids.indexOf(id);
    if (at === -1) return { success: false, message: 'Lagu tidak ditemukan.' };
    if (replaceWith && (replaceWith === id || ids.indexOf(replaceWith) === -1)) return { success: false, message: 'Lagu pengganti tidak valid.' };

    var tiSheet = getOrCreateSheet_(TI_SHEET, TI_HEADERS);
    var last = tiSheet.getLastRow();
    var used = 0;
    var cells = last > 1 ? tiSheet.getRange(2, 11, last - 1, 1).getValues() : [];
    var updated = cells.map(function (c) {
      var data = parseJson_(c[0], {});
      var hit = false;
      Object.keys(data.slots || {}).forEach(function (k) {
        if (data.slots[k] === id) { hit = true; if (replaceWith) data.slots[k] = replaceWith; }
      });
      Object.keys(data.lyrics || {}).forEach(function (key) {
        if (key.indexOf(id + '|') === 0) { hit = true; if (replaceWith) { data.lyrics[replaceWith + key.slice(id.length)] = data.lyrics[key]; delete data.lyrics[key]; } }
      });
      if (hit) used++;
      return [hit && replaceWith ? JSON.stringify(data) : c[0]];
    });
    if (used && !replaceWith) return { success: false, used: used, message: 'Lagu dipakai di ' + used + ' tata ibadah. Pilih lagu pengganti dulu.' };
    if (used) tiSheet.getRange(2, 11, updated.length, 1).setValues(updated);
    songSheet.deleteRow(at + 2);
    return { success: true, message: used ? 'Lagu digabungkan ke pengganti (' + used + ' tata ibadah diperbarui)' : 'Lagu dihapus' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Adds every KJ, KK, PKJ and NKB title from the online index to the library
 * (book, number, title only). Songs already there are left alone; lyrics are
 * fetched later, the first time a song is used (importHymnalSong).
 * Returns { success, added: { KJ: n, … }, total }.
 */
function importHymnalIndex() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSongsSheet_();
    var songs = readSongs_();
    var have = {}, ids = {};
    songs.forEach(function (s) { ids[s.id] = true; if (s.hymnal) have[s.hymnal + '|' + s.number.toLowerCase()] = true; });
    var rows = [], added = {};
    Object.keys(HYMNAL_CODES).forEach(function (book) {
      added[book] = 0;
      getHymnalIndex_(book).forEach(function (entry) {
        var number = entry[0].toLowerCase();
        // a book number whose versions are already in the library (e.g. KK 767h) still gets its plain entry
        if (have[book + '|' + number]) return;
        var id = (book + number).toLowerCase(), base = id;
        for (var k = 2; ids[id]; k++) id = base + '-' + k;
        ids[id] = true;
        rows.push([id, book, number, entry[1], '', 'Indonesia', '[]', '']);
        added[book]++;
      });
    });
    if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, SONG_HEADERS.length).setValues(rows);
    return { success: true, added: added, total: rows.length };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Tata Ibadah ↔ Schedule (theme and Pelayan Firman) ---------- */

/* Schedule theme from a service: "Series: Sub-theme", or just the sub-theme. */
function themeOf_(series, sub) {
  series = String(series || '').trim(); sub = String(sub || '').trim();
  return sub ? (series ? series + ': ' + sub : sub) : '';
}

/* Event input rows can carry "Untitled event" as their theme: treat it as no theme. */
function cleanTheme_(theme) {
  theme = String(theme || '').trim();
  return /^untitled(\s+event)?$/i.test(theme) ? '' : theme;
}

/* The reverse of themeOf_. */
function splitTheme_(theme) {
  theme = cleanTheme_(theme);
  var i = theme.indexOf(':');
  return i === -1 ? { series: '', sub: theme } : { series: theme.slice(0, i).trim(), sub: theme.slice(i + 1).trim() };
}

function scheduleEventsOn_(sheet, date) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var out = [];
  sheet.getRange(2, 1, last - 1, 5).getValues().forEach(function (r, i) {
    if (r[0] !== '' && r[0] !== null && fmtDate_(r[1]) === date) {
      out.push({ row: i + 2, id: String(r[0]), date: date, theme: String(r[2] || ''), pastor: String(r[3] || ''), tag: String(r[4] || '') });
    }
  });
  return out;
}

/*
 * After a Tata Ibadah save (inside its lock): writes theme and PF to that
 * Sunday's service row, adding a "Service" row if the day has none. Empty
 * values never blank the Schedule. Returns { event, changed } or null.
 */
function pushServiceToSchedule_(date, series, sub, pf) {
  var sheet = getScheduleSheet_();
  var theme = themeOf_(series, sub);
  pf = String(pf || '').trim();
  var ev = pickScheduleEvent_(scheduleEventsOn_(sheet, date));
  if (ev) {
    var newTheme = theme || ev.theme, newPastor = pf || ev.pastor;
    var changed = newTheme !== ev.theme || newPastor !== ev.pastor;
    if (changed) sheet.getRange(ev.row, 3, 1, 2).setValues([[newTheme, newPastor]]);
    return { event: { id: ev.id, date: date, theme: newTheme, pastor: newPastor, tag: ev.tag }, changed: changed };
  }
  if (!theme) return null;
  var last = sheet.getLastRow(), maxId = 0;
  if (last > 1) sheet.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) { var n = Number(r[0]); if (!isNaN(n) && n > maxId) maxId = n; });
  sheet.appendRow([maxId + 1, new Date(date + 'T00:00:00'), theme, pf, 'Service', '', '', '', '']);
  return { event: { id: String(maxId + 1), date: date, theme: theme, pastor: pf, tag: 'Service' }, changed: true };
}

/*
 * After an Event input save: if that row is the day's service row, the Tata
 * Ibadah on that date takes its theme and Pastor (and its saved-at time moves
 * on, so an open builder sees the change). Returns { id, changed } or null.
 * Most events have no Tata Ibadah on their date, so that is checked first
 * from the date column alone; the lock is taken only to write.
 */
function syncScheduleToService_(date, eventId) {
  if (!date) return null;
  var sheet = getOrCreateSheet_(TI_SHEET, TI_HEADERS);
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var dates = sheet.getRange(2, 1, last - 1, 2).getValues();
  var at = -1;
  for (var i = 0; i < dates.length; i++) {
    if (dates[i][0] !== '' && fmtDate_(dates[i][1]) === date) { at = i; break; }
  }
  if (at === -1) return null;

  var ev = pickScheduleEvent_(scheduleEventsOn_(getScheduleSheet_(), date));
  if (!ev || ev.id !== String(eventId)) return null;
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var row = sheet.getRange(at + 2, 1, 1, 6).getValues()[0];
    if (fmtDate_(row[1]) !== date) return null;   // rows moved since the check
    var t = cleanTheme_(ev.theme) ? splitTheme_(ev.theme) : { series: String(row[3]), sub: String(row[4]) };
    var pf = ev.pastor.trim() || String(row[5]);
    if (t.series === String(row[3]) && t.sub === String(row[4]) && pf === String(row[5])) return { id: String(row[0]), changed: false };
    sheet.getRange(at + 2, 4, 1, 3).setValues([[t.series, t.sub, pf]]);
    sheet.getRange(at + 2, 12).setValue(new Date(Math.floor(Date.now() / 1000) * 1000));
    return { id: String(row[0]), changed: true };
  } finally {
    lock.releaseLock();
  }
}

/*
 * Lines up every Tata Ibadah with its Service row in the Schedule (theme and
 * Pelayan Firman ↔ Pastor), for services set before the two were synced on
 * save. A blank side takes the other's value; when both are filled and differ
 * the Tata Ibadah wins (edits since then sync both ways on save, so only older
 * data can differ). Runs when either screen loads; returns the number of rows
 * changed. Skips quietly if the sheets are busy.
 */
function reconcileServicesWithSchedule_() {
  var ti = getOrCreateSheet_(TI_SHEET, TI_HEADERS), sched = getScheduleSheet_();
  var tl = ti.getLastRow(), sl = sched.getLastRow();
  if (tl < 2 || sl < 2) return 0;
  var tiRows = ti.getRange(2, 1, tl - 1, 6).getValues();
  var sRows = sched.getRange(2, 1, sl - 1, 5).getValues();
  var serviceAt = {};
  sRows.forEach(function (r, i) {
    var d = fmtDate_(r[1]);
    if (r[0] !== '' && isServiceTag_(r[4]) && serviceAt[d] == null) serviceAt[d] = i;
  });
  var schedWrites = [], tiWrites = [];
  tiRows.forEach(function (r, i) {
    var d = fmtDate_(r[1]), si = serviceAt[d];
    if (r[0] === '' || si == null) return;
    var ev = sRows[si];
    var series = String(r[3] || '').trim(), sub = String(r[4] || '').trim(), pf = String(r[5] || '').trim();
    var evTheme = String(ev[2] || '').trim(), evPastor = String(ev[3] || '').trim();
    var tiTheme = themeOf_(series, sub);
    var newEvTheme = tiTheme || evTheme, newEvPastor = pf || evPastor;
    if (newEvTheme !== evTheme || newEvPastor !== evPastor) schedWrites.push([si + 2, newEvTheme, newEvPastor]);
    if (!tiTheme && evTheme || !pf && evPastor) {
      var t = tiTheme ? { series: series, sub: sub } : splitTheme_(evTheme);
      tiWrites.push([i + 2, t.series, t.sub, pf || evPastor]);
    }
  });
  if (!schedWrites.length && !tiWrites.length) return 0;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return 0;
  try {
    schedWrites.forEach(function (w) { sched.getRange(w[0], 3, 1, 2).setValues([[w[1], w[2]]]); });
    var stamp = new Date(Math.floor(Date.now() / 1000) * 1000);
    tiWrites.forEach(function (w) {
      ti.getRange(w[0], 4, 1, 3).setValues([[w[1], w[2], w[3]]]);
      ti.getRange(w[0], 12).setValue(stamp);
    });
    return schedWrites.length + tiWrites.length;
  } finally {
    lock.releaseLock();
  }
}
