/*
 * Liturgy output: builds the whole "Tata Ibadah Minggu" booklet (A5, as in
 * the Pemuda liturgy) as a Google Doc from a saved service, with the fixed
 * wording from LiturgiText.js and the service's weekly texts. Downloads
 * return .docx or .pdf; "Buat Google Doc" keeps an editable Doc in the
 * shared Tata Ibadah folder (TI_OUTPUT_FOLDER_ID).
 */

/* Shared Drive folder for the liturgy Google Docs; the account the web app runs as needs edit access. */
var TI_OUTPUT_FOLDER_ID = '1TWKE5taosfH3N5Dy9iyXRZGtFMkRH9dM';

var ID_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
var LIT_BLUE = '#0070c0';

function idDate_(iso) {
  var p = String(iso).split('-');
  return Number(p[2]) + ' ' + ID_MONTHS[Number(p[1]) - 1] + ' ' + p[0];
}

/* { sheet, row, svc, data } for one saved service, or null. */
function findService_(id) {
  var sheet = getOrCreateSheet_(TI_SHEET, TI_HEADERS);
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var rows = sheet.getRange(2, 1, last - 1, TI_HEADERS.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) return { sheet: sheet, row: i + 2, svc: serviceFromRow_(rows[i]), data: parseJson_(rows[i][10], {}) };
  }
  return null;
}

function liturgySongs_() {
  var songs = {};
  readSongs_().forEach(function (s) { songs[s.id] = s; });
  return songs;
}

var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
var PAGE_MARK = '{{PAGE}}';

/* Builds the booklet as a new Google Doc in My Drive and returns its Drive file. */
function makeLiturgyDoc_(svc, name) {
  var doc = DocumentApp.create(name);
  var file = DriveApp.getFileById(doc.getId());
  try {
    buildLiturgy_(doc, svc, liturgySongs_());
    doc.saveAndClose();
  } catch (e) {
    file.setTrashed(true);
    throw e;
  }
  return file;
}

function exportDocx_(fileId) {
  var res = UrlFetchApp.fetch('https://docs.google.com/document/d/' + fileId + '/export?format=docx', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Ekspor .docx gagal (HTTP ' + res.getResponseCode() + ').');
  return res.getBlob().setContentType(DOCX_MIME);
}

/*
 * Word XML edits Apps Script cannot make on a Doc: the footer's {{PAGE}}
 * becomes a PAGE field, and the section gets a separate (empty) first-page
 * footer so the cover has none.
 */
function pageNumberXml_(name, xml) {
  if (/^word\/footer\d*\.xml$/.test(name) && xml.indexOf(PAGE_MARK) !== -1) {
    return xml.replace(/<w:r(?:\s[^>]*)?>(?:(?!<w:r[\s>])[\s\S])*?\{\{PAGE\}\}[\s\S]*?<\/w:r>/, function (run) {
      var rPr = (run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
      var text = (run.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/) || ['', PAGE_MARK])[1].split(PAGE_MARK);
      var plain = rPr.replace(/<w:b(?:Cs)?(?:\s[^>]*)?\/>/g, '');
      var r = function (inner, pr) { return '<w:r>' + pr + inner + '</w:r>'; };
      var t = function (str) { return str ? r('<w:t xml:space="preserve">' + str + '</w:t>', rPr) : ''; };
      return t(text[0]) +
        r('<w:fldChar w:fldCharType="begin"/>', plain) + r('<w:instrText xml:space="preserve"> PAGE </w:instrText>', plain) +
        r('<w:fldChar w:fldCharType="separate"/>', plain) + r('<w:t>1</w:t>', plain) + r('<w:fldChar w:fldCharType="end"/>', plain) +
        t(text[1]);
    });
  }
  if (name === 'word/document.xml') {
    var at = xml.lastIndexOf('<w:sectPr');
    if (at === -1) return xml;
    var end = xml.indexOf('</w:sectPr>', at);
    var sect = xml.slice(at, end);
    if (/<w:titlePg[^>]*\/>/.test(sect)) sect = sect.replace(/<w:titlePg[^>]*\/>/, '<w:titlePg/>');
    else {
      var m = sect.search(/<w:(textDirection|bidi|rtlGutter|docGrid|printerSettings)\b/);
      sect = m === -1 ? sect + '<w:titlePg/>' : sect.slice(0, m) + '<w:titlePg/>' + sect.slice(m);
    }
    return xml.slice(0, at) + sect + xml.slice(end);
  }
  return xml;
}

function addPageNumbers_(docx) {
  var marked = false;
  var parts = Utilities.unzip(docx.setContentType('application/zip')).map(function (b) {
    var name = b.getName();
    if (!/^word\/(document|footer\d*)\.xml$/.test(name)) return b;
    var xml = b.getDataAsString('UTF-8'), out = pageNumberXml_(name, xml);
    if (out !== xml && name !== 'word/document.xml') marked = true;
    return out === xml ? b : Utilities.newBlob(out, 'application/xml', name);
  });
  if (!marked) throw new Error('page marker not found in footer');
  return Utilities.zip(parts, 'liturgi.docx').setContentType(DOCX_MIME);
}

/* Without page numbers: drop the marker from the Doc's footer. */
function stripPageMark_(fileId) {
  var doc = DocumentApp.openById(fileId), footer = doc.getFooter();
  if (footer) footer.replaceText('\\{\\{PAGE\\}\\}\\s*\\|\\s*', '');
  doc.saveAndClose();
}

/*
 * The finished booklet as kind 'docx' or 'pdf' (a blob) or 'gdoc' (a Drive
 * file to keep). Page numbers come from the .docx route; PDF and Google Doc
 * re-import that .docx through the Drive API. If any step is unavailable
 * the plain Doc is used, without page numbers. Temporary files are trashed.
 */
function produceLiturgy_(svc, name, kind) {
  var temp = makeLiturgyDoc_(svc, name);
  var trash = [temp], keep = null;
  try {
    var docx = null;
    try { docx = addPageNumbers_(exportDocx_(temp.getId())); } catch (e) { console.warn('Page numbers skipped: ' + e.message); }
    if (kind === 'docx') {
      if (!docx) { stripPageMark_(temp.getId()); docx = exportDocx_(temp.getId()); }
      return docx.setName(name + '.docx');
    }
    var source = null;
    if (docx) {
      try {
        var created = Drive.Files.create({ name: name, mimeType: MimeType.GOOGLE_DOCS }, docx);
        source = DriveApp.getFileById(created.id);
        trash.push(source);
      } catch (e) { console.warn('Drive import unavailable: ' + e.message); }
    }
    if (!source) { stripPageMark_(temp.getId()); source = temp; }
    if (kind === 'pdf') return source.getAs(MimeType.PDF).setName(name + '.pdf');
    keep = source;
    return source;
  } finally {
    trash.forEach(function (f) { if (f !== keep) { try { f.setTrashed(true); } catch (e) { /* already gone */ } } });
  }
}

/** format: 'docx' or 'pdf'. Returns { success, filename, mimeType, base64 }. */
function downloadLiturgy(serviceId, format) {
  format = format === 'pdf' ? 'pdf' : 'docx';
  var found = findService_(serviceId);
  if (!found) return { success: false, message: 'Simpan tata ibadah ini dulu.' };
  var name = 'Liturgi Pemuda ' + idDate_(found.svc.date);
  var blob = produceLiturgy_(found.svc, name, format);
  return {
    success: true,
    filename: name + '.' + format,
    mimeType: format === 'pdf' ? 'application/pdf' : DOCX_MIME,
    base64: Utilities.base64Encode(blob.getBytes())
  };
}

/**
 * Creates an editable Google Doc of the liturgy in the shared Tata Ibadah folder
 * and remembers it on the service. Earlier Docs are kept (they may hold edits).
 */
function createLiturgyDoc(serviceId) {
  var found = findService_(serviceId);
  if (!found) return { success: false, message: 'Simpan tata ibadah ini dulu.' };
  var folder = outputFolder_();
  var file = produceLiturgy_(found.svc, 'Liturgi Pemuda ' + idDate_(found.svc.date), 'gdoc');
  try { file.moveTo(folder); } catch (e) { file.setTrashed(true); throw new Error('Tidak bisa menyimpan ke folder Drive tata ibadah: ' + e.message); }
  var doc = { id: file.getId(), url: file.getUrl(), at: Utilities.formatDate(new Date(), TZ, 'd MMM, HH.mm') };
  found.data.doc = doc;
  found.sheet.getRange(found.row, 11).setValue(JSON.stringify(found.data));
  return { success: true, message: 'Google Doc dibuat di folder Drive tata ibadah', doc: doc };
}

/**
 * Rewrites the service's existing Google Doc in place: same file, link and
 * sharing, new content (the old content stays in the Doc's version history).
 * The footer is kept, with only its date updated, so a Doc made with page
 * numbers keeps them.
 */
function updateLiturgyDoc(serviceId) {
  var found = findService_(serviceId);
  if (!found) return { success: false, message: 'Simpan tata ibadah ini dulu.' };
  var doc = found.data.doc;
  if (!doc || !doc.id) return { success: false, message: 'Belum ada Google Doc. Buat dulu.' };
  var file;
  try {
    file = DriveApp.getFileById(doc.id);
    if (file.isTrashed()) return { success: false, gone: true, message: 'Google Doc itu ada di sampah. Buat Google Doc baru.' };
  } catch (e) {
    return { success: false, gone: true, message: 'Google Doc tidak ditemukan. Buat Google Doc baru.' };
  }
  var gdoc = DocumentApp.openById(doc.id);
  emptyBody_(gdoc.getBody());
  buildLiturgy_(gdoc, found.svc, liturgySongs_(), { inPlace: true });
  gdoc.setName('Liturgi Pemuda ' + idDate_(found.svc.date));
  gdoc.saveAndClose();
  moveToOutput_(file);
  doc.updatedAt = Utilities.formatDate(new Date(), TZ, 'd MMM, HH.mm');
  found.data.doc = doc;
  found.sheet.getRange(found.row, 11).setValue(JSON.stringify(found.data));
  return { success: true, message: 'Google Doc diperbarui', doc: doc };
}

/*
 * Removes everything from a Doc's body, leaving one empty paragraph.
 * Body.clear() is not used: it can leave tables (our bullet and speaker
 * columns) behind, which then reappear after the rewritten content.
 */
function emptyBody_(body) {
  var keep = body.appendParagraph('');
  for (var i = body.getNumChildren() - 2; i >= 0; i--) body.removeChild(body.getChild(i));
  keep.setHeading(DocumentApp.ParagraphHeading.NORMAL);
}

function outputFolder_() {
  try {
    return DriveApp.getFolderById(TI_OUTPUT_FOLDER_ID);
  } catch (e) {
    throw new Error('Folder Drive tata ibadah tidak bisa dibuka. Pastikan akun web app punya akses edit ke folder itu.');
  }
}

/* Docs made before the shared folder (My Drive › Tata Ibadah › <year>) move into it when updated. */
function moveToOutput_(file) {
  try {
    if (file.getParents().hasNext() && file.getParents().next().getId() === TI_OUTPUT_FOLDER_ID) return;
    file.moveTo(outputFolder_());
  } catch (e) {
    console.warn('Doc not moved to the shared folder: ' + e.message);
  }
}

/* ---------- writer ---------- */

/*
 * Layout grid (points). Every element lines up on these columns: speaker
 * label | ":" | text, item title | posture, and for songs/lists a number
 * column before the text. Columns are invisible tables so they align the
 * same in Google Docs, Word and the PDF.
 */
var LIT = {
  page: { w: 419.5, h: 595.3, margin: 42.5 },
  who: 44, colon: 10,          // speech text starts at who + colon
  num: 18,                     // "1." column for steps and verses
  posture: 72,                 // right-hand "(berdiri)" column
  space: { part: [18, 8], item: [12, 4], row: 2, note: [4, 2], section: 6 }
};
LIT.text = LIT.who + LIT.colon;
LIT.width = LIT.page.w - 2 * LIT.page.margin;

function litAttrs_(o) {
  var A = DocumentApp.Attribute, a = {};
  a[A.FONT_FAMILY] = o.font || 'Times New Roman';
  a[A.FONT_SIZE] = o.size || 12;
  a[A.BOLD] = !!o.bold;
  a[A.ITALIC] = !!o.italic;
  a[A.UNDERLINE] = false;
  a[A.FOREGROUND_COLOR] = o.color || '#000000';
  return a;
}

function litMerge_(a, b) {
  var o = {}, k;
  for (k in a || {}) o[k] = a[k];
  for (k in b || {}) o[k] = b[k];
  return o;
}

function litRuns_(runs) { return typeof runs === 'string' ? [[runs, {}]] : runs; }

/* Writes runs into a paragraph and applies paragraph opts (align, indent, before, after, line). */
function litFill_(para, runs, opts) {
  opts = opts || {};
  litRuns_(runs).forEach(function (r) {
    if (r[0]) para.appendText(r[0]).setAttributes(litAttrs_(litMerge_(opts, r[1])));
  });
  var H = DocumentApp.HorizontalAlignment;
  para.setAlignment({ center: H.CENTER, right: H.RIGHT, justify: H.JUSTIFY }[opts.align] || H.LEFT);
  para.setIndentStart(opts.indent || 0);
  para.setIndentFirstLine(opts.indent || 0);
  para.setIndentEnd(0);
  para.setSpacingBefore(opts.before || 0);
  para.setSpacingAfter(opts.after || 0);
  para.setLineSpacing(opts.line || 1.0);
  return para;
}

function LitWriter_(body) {
  this.body = body;
  this.fresh = body.getChild(0).asParagraph();
  this.rows = [];
}

LitWriter_.prototype.p = function (runs, opts) {
  this.flush();
  var para = this.fresh || this.body.appendParagraph('');
  this.fresh = null;
  return litFill_(para, runs, opts);
};

/*
 * Appends an invisible table. rows: [[cell, …], …], each cell a list of
 * paragraphs [[runs, opts], …]. Returns the table's cells as [row][col].
 * Docs keeps an empty paragraph after a table at the end of the body; it is
 * reused for whatever comes next, or shrunk if another table follows.
 */
LitWriter_.prototype.table = function (widths, rows) {
  if (this.fresh) { litFill_(this.fresh, [[' ', { size: 1 }]], {}); this.fresh = null; }
  var table = this.body.appendTable(rows.map(function (r) { return r.map(function () { return ''; }); }));
  table.setBorderWidth(0);
  widths.forEach(function (w, i) { table.setColumnWidth(i, w); });
  var cells = rows.map(function (r, ri) {
    return r.map(function (paras, ci) {
      var cell = table.getCell(ri, ci);
      cell.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(ci === r.length - 1 ? 0 : 2);
      (paras.length ? paras : [['', {}]]).forEach(function (pp, pi) {
        litFill_(pi === 0 ? cell.getChild(0).asParagraph() : cell.appendParagraph(''), pp[0], pp[1]);
      });
      return cell;
    });
  });
  var tail = this.body.getChild(this.body.getNumChildren() - 1);
  if (tail.getType() === DocumentApp.ElementType.PARAGRAPH && !tail.asParagraph().getText()) this.fresh = tail.asParagraph();
  return cells;
};

/* Consecutive speaker lines collect into one table; anything else written flushes them. */
LitWriter_.prototype.flush = function () {
  if (!this.rows.length) return;
  var rows = this.rows;
  this.rows = [];
  this.table([LIT.who, LIT.colon, LIT.width - LIT.text], rows);
};

/* "L : text", text in its own column; who '' continues the previous speaker. */
LitWriter_.prototype.say = function (who, runs, opts) {
  var style = who === 'U' ? { bold: true, italic: true } : {};
  var o = litMerge_({ after: LIT.space.row }, opts);
  var row = { after: o.after };
  this.rows.push([
    [[[[who, style]], row]],
    [[[[who ? ':' : '', style]], row]],
    [[litRuns_(runs).map(function (r) { return [r[0], litMerge_(style, r[1])]; }), o]]
  ]);
};

/* Part heading: UMAT BERHIMPUN, PELAYANAN FIRMAN … */
LitWriter_.prototype.part = function (title) {
  return this.p(title, { font: 'Arial Black', size: 14, align: 'center', before: LIT.space.part[0], after: LIT.space.part[1] });
};

/* Liturgy element: bold title, posture right-aligned on the same line. */
LitWriter_.prototype.item = function (title, posture) {
  var sp = { before: LIT.space.item[0], after: LIT.space.item[1] };
  if (!posture) return this.p([[title, { bold: true }]], sp);
  this.flush();
  this.table([LIT.width - LIT.posture, LIT.posture], [[
    [[[[title, { bold: true }]], sp]],
    [[[['(' + posture + ')', { italic: true }]], litMerge_(sp, { align: 'right' })]]
  ]]);
};

LitWriter_.prototype.note = function (runs, opts) {
  return this.p(runs, litMerge_({ italic: true, color: LIT_BLUE, align: 'center', before: LIT.space.note[0], after: LIT.space.note[1] }, opts));
};

/* Right-aligned posture change between elements, e.g. "(duduk)". */
LitWriter_.prototype.posture = function (text) {
  return this.p('(' + text + ')', { italic: true, align: 'right', before: LIT.space.note[0], after: LIT.space.note[1] });
};

/* Bulleted steps: "•" in the number column, text beside it. */
LitWriter_.prototype.steps = function (items) {
  this.flush();
  this.table([LIT.num, LIT.width - LIT.num], items.map(function (runs, i) {
    var o = { before: i ? 3 : 0 };
    return [[[[['•', {}]], o]], [[runs, o]]];
  }));
};

LitWriter_.prototype.image = function (key, width, opts) {
  var para = this.p('', litMerge_({ align: 'center' }, opts));
  var a = LITURGI_ASSETS[key];
  var img = para.appendInlineImage(Utilities.newBlob(Utilities.base64Decode(a.data), a.type, key));
  img.setHeight(Math.round(img.getHeight() * width / img.getWidth())).setWidth(width);
  return para;
};

/* ---------- songs ---------- */

/* "1-3", "1,3" … from the verse numbers an arrangement uses. */
function verseList_(order) {
  var nums = [];
  order.forEach(function (l) { var m = l.match(/^Bait (\d+)$/); if (m && nums.indexOf(Number(m[1])) === -1) nums.push(Number(m[1])); });
  nums.sort(function (a, b) { return a - b; });
  var parts = [], i = 0;
  while (i < nums.length) {
    var j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    parts.push(j > i + 1 ? nums[i] + '-' + nums[j] : (j === i + 1 ? nums[i] + ',' + nums[j] : String(nums[i])));
    i = j + 1;
  }
  return parts.join(',');
}

/*
 * "♫ KJ 410:1-3 TITLE", credits, then the lyrics on the grid: each section
 * printed once in arrangement order as a row (verse number | lines, with
 * "Ref." above refrain lines). A section sung again becomes a tag after the
 * previous line ("Ref."), as in the printed liturgy.
 */
function writeSong_(w, svc, k, songs) {
  var song = songs[svc.slots[k]];
  if (!song) { w.p('♫ (lagu belum dipilih)', { bold: true, align: 'center', before: 4, after: 4 }); return; }
  var order = String(svc.arr[k] || song.arr || '').split(' → ').filter(Boolean);
  if (!order.length) order = song.sections.map(function (s) { return s.label; });
  var hymn = !!song.hymnal;
  var vl = hymn ? verseList_(order) : '';
  w.p('♫ ' + (hymn ? song.hymnal + ' ' + song.number + (vl ? ':' + vl : '') + ' ' : '') + song.title.toUpperCase(), { bold: true, align: 'center', before: 4, after: 1 });
  String(song.credits || '').split(' · ').filter(Boolean).forEach(function (c) { w.p(c, { italic: true, size: 10, align: 'center' }); });

  var textOf = function (label) {
    var o = svc.lyrics[song.id + '|' + label];
    if (o != null) return o;
    var sec = song.sections.filter(function (s) { return s.label === label; })[0];
    return sec ? sec.text : '';
  };
  var runs = [];
  order.forEach(function (l) {
    if (runs.length && runs[runs.length - 1].label === l) runs[runs.length - 1].n++;
    else runs.push({ label: l, n: 1 });
  });
  var tagOf = function (label, n) {
    var t = /^(ref|reff|chorus)$/i.test(label) ? 'Ref.' : label;
    return n > 1 ? t + ' (' + n + 'x)' : t;
  };

  /* rows: { num, paras, top }; tags: [rowIndex, text] appended to that row's last line */
  var rows = [], tags = [], printed = {};
  runs.forEach(function (r) {
    if (printed[r.label] && rows.length) { tags.push([rows.length - 1, ' ' + tagOf(r.label, r.n)]); return; }
    printed[r.label] = true;
    var lines = textOf(r.label).split('\n').filter(function (l) { return l.trim(); });
    if (!lines.length) return;
    var verse = r.label.match(/^Bait (\d+)$/);
    var isRef = /^(ref|reff|chorus|pre-chorus|pre-ref|bridge|tag|coda)/i.test(r.label);
    var top = rows.length ? LIT.space.section : 6;
    var paras = [];
    var head = isRef ? tagOf(r.label, r.n) : (!verse || !hymn) && r.n > 1 ? '(' + r.n + 'x)' : '';
    if (head) paras.push([[[head, { bold: true, italic: true }]], {}]);
    lines.forEach(function (line) { paras.push([line.trim(), { line: 1.15 }]); });
    paras[0][1] = litMerge_(paras[0][1], { before: top });
    if (verse && hymn && r.n > 1) tags.push([rows.length, ' (' + r.n + 'x)']);
    rows.push({ num: verse && hymn ? verse[1] + '.' : '', paras: paras, top: top });
  });
  if (!rows.length) return;

  w.flush();
  var cells = w.table([LIT.text, LIT.num, LIT.width - LIT.text - LIT.num], rows.map(function (r) {
    return [[['', {}]], [[r.num, { before: r.top, line: 1.15 }]], r.paras];
  }));
  tags.forEach(function (t) {
    var cell = cells[t[0]][2];
    cell.getChild(cell.getNumChildren() - 1).asParagraph().appendText(t[1]).setAttributes(litAttrs_({ bold: true, italic: true }));
  });
  w.p('', { size: 4, after: 2 });
}

/* ---------- the booklet ---------- */

/* "*bold* _italic_ ~blue italic~ ^blue^" (LiturgiText.js marks) → runs. */
function litMarks_(text) {
  var runs = [], buf = '', st = { bold: false, italic: false, bi: false, blue: false };
  var keys = { '*': 'bold', '_': 'italic', '~': 'bi', '^': 'blue' };
  var flush = function () {
    if (!buf) return;
    var o = {};
    if (st.bold) o.bold = true;
    if (st.italic || st.bi) o.italic = true;
    if (st.bi || st.blue) o.color = LIT_BLUE;
    runs.push([buf, o]);
    buf = '';
  };
  for (var i = 0; i < text.length; i++) {
    var key = keys[text.charAt(i)];
    if (key) { flush(); st[key] = !st[key]; } else buf += text.charAt(i);
  }
  flush();
  return runs;
}

/* Writes one fixed block from LiturgiText.js. */
function writeFixed_(w, k) {
  (LITURGI_FIXED[k] || []).forEach(function (e) {
    switch (e[0]) {
      case 'say': w.say(e[1], litMarks_(e[2])); break;
      case 'note': w.note(litMarks_(e[1])); break;
      case 'p': w.p(litMarks_(e[1]), { align: 'center', before: LIT.space.note[0], after: LIT.space.note[1] }); break;
      case 'line': w.p(litMarks_(e[1]), { before: 6, after: 2 }); break;
      case 'steps': w.steps(e[1].map(litMarks_)); break;
      case 'image': w.image(e[1], e[2], { before: 2, after: 4 }); break;
      case 'posture': w.posture(e[1]); break;
    }
  });
}

/* opts.inPlace: rewriting an existing Doc, whose footer (and page numbers) is kept. */
function buildLiturgy_(doc, svc, songs, opts) {
  var body = doc.getBody();
  var m = LIT.page.margin;
  body.setPageWidth(LIT.page.w).setPageHeight(LIT.page.h).setMarginTop(m).setMarginBottom(m).setMarginLeft(m).setMarginRight(m);
  body.setHeadingAttributes(DocumentApp.ParagraphHeading.NORMAL, litAttrs_({}));

  var theme = (svc.series ? svc.series + ': ' : '') + svc.sub;
  var date = idDate_(svc.date);
  var ba = svc.baBook && svc.baCh && svc.baVs ? svc.baBook + ' ' + svc.baCh + ':' + svc.baVs : '…';
  var texts = litMerge_(LITURGI_DEFAULT_TEXTS, svc.texts || {});
  var on = function (k) { return !!svc.enabled[k]; };
  var blueI = { italic: true, color: LIT_BLUE };
  var w = new LitWriter_(body);
  var sora = { font: 'Sora', align: 'center', after: 0 };

  // cover
  var logos = w.p('', { align: 'center', after: 6 });
  [['gki', 0], ['pemuda', 1]].forEach(function (l) {
    var a = LITURGI_ASSETS[l[0]];
    if (l[1]) logos.appendText('     ');
    logos.appendInlineImage(Utilities.newBlob(Utilities.base64Decode(a.data), a.type, l[0])).setWidth(36).setHeight(36);
  });
  w.p([['TATA IBADAH MINGGU', { bold: true, size: 20 }]], sora);
  if (svc.season) w.p(svc.season, litMerge_(sora, { size: 12 }));
  w.p('Pemuda GKI Kota Wisata', litMerge_(sora, { size: 12 }));
  w.p(date, litMerge_(sora, { size: 12, after: 10 }));
  w.image('cover', 205, { after: 10 });
  w.p([[theme, { font: 'Pacifico', size: 22, bold: true }]], { align: 'center', after: 12 });
  w.p('Pelayan Firman:', litMerge_(sora, { size: 12 }));
  w.p(svc.pf || '…', litMerge_(sora, { size: 12 }));
  body.appendPageBreak();
  w.fresh = body.appendParagraph('');

  // persiapan (b1)
  w.item('PERSIAPAN');
  writeFixed_(w, 'b1');

  // umat berhimpun
  w.part('UMAT BERHIMPUN');
  w.item('PANGGILAN BERIBADAH', 'berdiri');
  w.say('Liturgos', [[texts.call || '…', { color: LIT_BLUE }]]);
  writeSong_(w, svc, 'b2', songs);

  w.item('VOTUM DAN SALAM');
  writeFixed_(w, 'b3');

  w.item('KATA PEMBUKA', 'duduk');
  w.say('L', [['(menyampaikan tema: ' + theme + ' dan Firman Tuhan ' + (svc.kp || '…') + ')', { bold: true, color: LIT_BLUE }]]);
  if (String(texts.kpText || '').trim()) w.say('', [['(' + String(texts.kpText).trim() + ')', blueI]]);

  w.item('NYANYIAN UMAT');
  writeSong_(w, svc, 'b5', songs);

  w.item('PENGAKUAN DOSA');
  w.say('L', [[texts.confession || '…', { color: LIT_BLUE }]]);
  w.p('(Umat menaikkan doa pengakuan dosa secara pribadi)', { italic: true, align: 'center', before: LIT.space.note[0], after: LIT.space.note[1] });

  w.item('NYANYIAN UMAT');
  writeSong_(w, svc, 'b7', songs);

  w.item('BERITA ANUGERAH', 'berdiri');
  w.say('L', [['Kini terimalah berita anugerah dari Tuhan menurut ', {}], [ba, { bold: true }]]);
  if (String(texts.baText || '').trim()) w.say('', [['(' + String(texts.baText).trim() + ')', blueI]]);
  if (svc.variants.b8 === 'A') {
    w.say('', 'Demikianlah berita anugerah dari Tuhan.');
    w.say('U', 'Syukur kepada Allah!');
  } else {
    w.say('', 'Di dalam Kristus, engkau telah diampuni!');
    w.say('U', 'Di dalam Kristus, engkau pun telah diampuni!');
    w.say('L', 'Damai Kristus bagimu');
    w.say('U', 'Damai Kristus bagimu juga');
  }
  w.p('(Umat bersalaman satu sama lain sambil mengucapkan, “Salam Damai”)', { italic: true, align: 'center', before: 8, after: LIT.space.note[1] });
  w.note([['diiringi PNJ yang menyanyikan ', {}], ['“Bersukacitalah Selalu” ' + ({ '2×': '2x', '3×': '3x' }[svc.variants.b9] || '1x saja'), { color: '#000000' }]]);

  w.item('NYANYIAN UMAT');
  writeSong_(w, svc, 'b10', songs);
  w.posture('duduk');

  // pelayanan firman
  w.part('PELAYANAN FIRMAN');
  w.p([['DOA PELAYANAN FIRMAN ', { bold: true }], ['(oleh PF)', { italic: true, color: LIT_BLUE }]], { before: LIT.space.item[0], after: LIT.space.item[1] });
  w.item('PEMBACAAN ALKITAB');
  w.say('PF', [['Pembacaan Firman Tuhan menurut ', {}], [String(texts.reading || '').trim() || '…', { bold: true }]]);
  w.say('', '….. Demikianlah Firman Tuhan. Berbahagialah mereka yang mendengarkan Firman Allah dan yang memeliharanya.');
  w.say('', [['Haleluya!', { bold: true, italic: true }]]);
  w.say('U', '(menyanyikan KK ' + (svc.variants.b11 || '767h') + ') ♫ Haleluya, Haleluya, Haleluya');
  w.posture('duduk');
  w.item('KHOTBAH : ' + theme.toUpperCase());
  w.item('SAAT HENING');
  writeFixed_(w, 'b13');

  w.item('PENGAKUAN IMAN RASULI', 'berdiri');
  writeFixed_(w, 'b14');

  if (on('b15')) {
    w.item('PERSIAPAN PERJAMUAN KUDUS (SENSURA MORUM)', 'duduk');
    w.say('Pnt', '(membacakan Sensura Morum)');
  }

  w.item('DOA SYAFAAT');
  writeFixed_(w, 'b16');

  // persembahan
  w.part('PELAYANAN PERSEMBAHAN');
  w.item('NAS PERSEMBAHAN');
  var fixedOf = svc.ofBook == null;
  var ofRef = fixedOf ? LITURGI_OFFERING_VERSE.ref : svc.ofBook && svc.ofCh && svc.ofVs ? svc.ofBook + ' ' + svc.ofCh + ':' + svc.ofVs : '…';
  var ofText = fixedOf ? LITURGI_OFFERING_VERSE.text : String(texts.ofText || '').trim();
  w.say('Pnt', [[(String(texts.offering || '').trim() || '…') + ' Dasar Persembahan kita adalah ' + ofRef, { color: LIT_BLUE }]]);
  if (ofText) w.say('', [['(' + ofText + ')', blueI]]);

  w.item('NYANYIAN PERSEMBAHAN');
  writeSong_(w, svc, 'b18', songs);
  w.note('(Usher maju ke depan, Pnt menyerahkan kantong persembahan)');
  w.note('(instrumentalia sampai kantong persembahan selesai diedarkan)');
  w.note('(multimedia menayangkan QR persembahan)');
  w.p('(umat berdiri)', { italic: true, align: 'center', before: 8, after: LIT.space.note[1] });

  w.item('DOA PERSEMBAHAN', 'berdiri');
  writeFixed_(w, 'b19');

  // pengutusan
  w.part('PENGUTUSAN');
  w.item('NYANYIAN UMAT');
  writeSong_(w, svc, 'b20', songs);

  w.item('PENGUTUSAN');
  [['PF', 'Arahkanlah hatimu kepada Tuhan'], ['U', 'Kami mengarahkan hati kami kepada Tuhan'], ['PF', 'Jadilah saksi Kristus'],
   ['U', 'Mampukan dan layakkan kami, ya Tuhan'], ['PF', 'Terpujilah Tuhan'], ['U', 'Kini dan selamanya']].forEach(function (l) { w.say(l[0], l[1]); });

  w.item('BERKAT');
  w.say('PF', 'Pergilah dan terimalah berkat Tuhan :');
  ['Tuhan memberkati engkau dan melindungi engkau', 'Tuhan menyinari engkau dengan wajah-Nya', 'dan memberi engkau kasih karunia.',
   'Tuhan menghadapkan wajah-Nya kepadamu', 'dan memberi engkau damai sejahtera.'].forEach(function (l) {
    w.say('', [[l, blueI]], { after: 0 });
  });
  if (svc.variants.b21 === '768b') {
    w.say('U', '(menyanyikan) ♫ KK 768b');
  } else {
    w.say('U', '(menyanyikan) ♫ HALELUYA AMIN');
    w.p('Syair dan lagu Untung Ongkowidjaja', { italic: true, size: 10, align: 'center', after: 4 });
    w.image('haleluyaAmin', 300, { after: 6 });
  }
  w.note([['(PF turun dari mimbar ', {}], ['SAAT', { bold: true }], [' nyanyian ordinarium “Amin” dinyanyikan umat)', {}]], { before: 4 });
  w.p('(serah terima Alkitab)', { italic: true, align: 'center', after: LIT.space.note[1] });
  w.posture('duduk');

  if (on('b22')) {
    w.item('NYANYIAN PENUTUP');
    writeSong_(w, svc, 'b22', songs);
  }

  w.item('SAAT TEDUH');
  writeFixed_(w, 'b23');
  w.flush();

  writeFooter_(doc, date, opts && opts.inPlace);
}

/*
 * New Docs get "{{PAGE}}  |  PEMUDA … , DATE"; the marker becomes the page
 * number in the .docx route (addPageNumbers_). An existing Doc's footer is
 * kept and only its date replaced, so its page number field survives.
 */
function writeFooter_(doc, date, inPlace) {
  var label = 'TATA IBADAH MINGGU, ' + date.toUpperCase();
  var footer = doc.getFooter();
  if (inPlace && footer) {
    if (/TATA IBADAH MINGGU, /.test(footer.getText())) footer.replaceText('TATA IBADAH MINGGU, .*', label);
    return;
  }
  if (!footer) footer = doc.addFooter();
  var fp = footer.getNumChildren() ? footer.getChild(0).asParagraph() : footer.appendParagraph('');
  fp.setText('');
  fp.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  if (!inPlace) fp.appendText(PAGE_MARK).setAttributes(litAttrs_({ size: 8, color: '#555555', bold: true }));
  fp.appendText((inPlace ? '' : '  |  ') + 'PEMUDA KOTA WISATA – ' + label).setAttributes(litAttrs_({ size: 8, color: '#555555' }));
}
