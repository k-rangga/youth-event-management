var SPREADSHEET_ID = '1SpQz4kICxBbqNJu625RFd3JrX14heXsn8YTm_1BBbyQ';
var SCHEDULE_SHEET = 'Schedule';
var MEMBERS_SHEET = 'Members';
var TZ = 'Asia/Jakarta';

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
      .setTitle('Event Input')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

var ssCache_ = null;

/* The spreadsheet, opened once per execution (openById is slow and was called several times per request). */
function getSs_() {
  return ssCache_ || (ssCache_ = SpreadsheetApp.openById(SPREADSHEET_ID));
}

function getScheduleSheet_() {
  var sheet = getSs_().getSheetByName(SCHEDULE_SHEET);
  if (!sheet) throw new Error('Schedule sheet not found');
  return sheet;
}

function fmtDate_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, TZ, 'yyyy-MM-dd');
  return String(value || '').trim().substring(0, 10);
}

function fmtTime_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, TZ, 'HH:mm');
  return String(value || '').trim().substring(0, 5);
}

function parsePic_(value) {
  return String(value || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean);
}

/**
 * { id, name } rows from the Members sheet, read-only. Picks whichever
 * columns' headers contain "id" and "name" (falling back to column A for
 * name) so it doesn't depend on the sheet's exact layout.
 */
function getMemberDirectory_() {
  var sheet = getSs_().getSheetByName(MEMBERS_SHEET);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var nameCol = 0, idCol = -1;
  for (var c = 0; c < header.length; c++) {
    var h = String(header[c] || '').toLowerCase();
    if (idCol === -1 && h.indexOf('id') !== -1) idCol = c;
    if (h.indexOf('name') !== -1) nameCol = c;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var name = String(values[i][nameCol] || '').trim();
    if (!name) continue;
    var id = idCol !== -1 ? String(values[i][idCol] || '').trim() : name;
    if (!id) continue;
    out.push({ id: id, name: name });
  }
  return out;
}

/** Unique { id, name } pool for the PIC autocomplete, sorted by name. */
function getMemberPool() {
  var seen = {};
  var out = [];
  getMemberDirectory_().forEach(function (m) {
    if (seen[m.id]) return;
    seen[m.id] = true;
    out.push(m);
  });
  out.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return out;
}

/**
 * Resolves stored PIC tokens (member IDs going forward, or legacy plain
 * names from before this sheet had an ID column) to { id, name } for
 * display. A token that matches neither is shown as-is.
 */
function resolvePic_(tokens, dirById, dirByName) {
  return tokens.map(function (t) {
    if (dirById[t]) return { id: dirById[t].id, name: dirById[t].name };
    var m = dirByName[t.toLowerCase()];
    if (m) return { id: m.id, name: m.name };
    return { id: t, name: t };
  });
}

/**
 * Reads the existing Schedule sheet as-is: Event ID | Date | Theme | Pastor | tag | Notes | PIC | Time start | Time end.
 */
function getSchedule() {
  var sheet = getScheduleSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var dirById = {}, dirByName = {};
  getMemberDirectory_().forEach(function (m) {
    dirById[m.id] = m;
    dirByName[m.name.toLowerCase()] = m;
  });

  var data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var id = data[i][0];
    if (id === '' || id === null) continue;
    out.push({
      id: String(id),
      date: fmtDate_(data[i][1]),
      theme: String(data[i][2] || ''),
      pastor: String(data[i][3] || ''),
      tag: String(data[i][4] || ''),
      notes: String(data[i][5] || ''),
      pic: resolvePic_(parsePic_(data[i][6]), dirById, dirByName),
      timeStart: fmtTime_(data[i][7]),
      timeEnd: fmtTime_(data[i][8])
    });
  }
  return out;
}

/**
 * Saves a Schedule row. When it is a Sunday's service row, that day's Tata
 * Ibadah gets the same theme and Pelayan Firman (syncScheduleToService_).
 */
function saveEvent(payload) {
  var res = saveEventRow_(payload);
  if (res.success) {
    try { res.tataIbadah = syncScheduleToService_(String(payload.date || '').trim(), res.id); }
    catch (e) { console.warn('Tata Ibadah sync skipped: ' + e.message); }
  }
  return res;
}

/** Creates a new row (auto-incrementing Event ID) or updates an existing one in place. */
function saveEventRow_(payload) {
  payload = payload || {};
  var date = String(payload.date || '').trim();
  var theme = String(payload.theme || '').trim();
  var pastor = String(payload.pastor || '').trim();
  var tag = String(payload.tag || '').trim();
  var notes = String(payload.notes || '').trim();
  var pic = (Array.isArray(payload.pic) ? payload.pic : []).map(function (s) { return String(s || '').trim(); }).filter(Boolean).join('; ');
  var timeStart = String(payload.timeStart || '').trim();
  var timeEnd = String(payload.timeEnd || '').trim();
  var id = payload.id ? String(payload.id).trim() : '';

  if (!date) return { success: false, message: 'Pick a date for this event.' };
  if (!theme) return { success: false, message: 'Give the event a theme or title.' };

  var dateObj = new Date(date + 'T00:00:00');
  if (isNaN(dateObj)) return { success: false, message: 'That date looks invalid.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getScheduleSheet_();
    var lastRow = sheet.getLastRow();
    var data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 5).getValues() : [];

    if (id) {
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][0]) === id) {
          sheet.getRange(i + 2, 2, 1, 8).setValues([[dateObj, theme, pastor, tag, notes, pic, timeStart, timeEnd]]);
          return { success: true, message: 'Event updated', id: id };
        }
      }
      return { success: false, message: 'Event not found.' };
    }

    var maxId = 0;
    for (var j = 0; j < data.length; j++) {
      var n = Number(data[j][0]);
      if (!isNaN(n) && n > maxId) maxId = n;
    }
    var newId = maxId + 1;
    sheet.appendRow([newId, dateObj, theme, pastor, tag, notes, pic, timeStart, timeEnd]);
    return { success: true, message: 'Event added to schedule', id: String(newId) };
  } finally {
    lock.releaseLock();
  }
}

function deleteEvent(id) {
  id = String(id || '').trim();
  if (!id) return { success: false, message: 'Missing event id.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getScheduleSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'Event not found.' };

    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = data.length - 1; i >= 0; i--) {
      if (String(data[i][0]) === id) {
        sheet.deleteRow(i + 2);
        return { success: true, message: 'Event deleted' };
      }
    }
    return { success: false, message: 'Event not found.' };
  } finally {
    lock.releaseLock();
  }
}
