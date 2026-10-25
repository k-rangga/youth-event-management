"""Tanggal from registered Service events, searchable Seri, optional Masa, one verse picker for kata pembuka / berita anugerah / persembahan."""
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def patch(name, pairs):
    path = os.path.join(root, name)
    s = open(path).read()
    for old, new, n in pairs:
        c = s.count(old)
        assert c == n, (name, c, n, old[:90])
        s = s.replace(old, new)
    open(path, 'w').write(s)


V = "/^(kp|ba|of)(Book|Ch|Vs)$/"

patch('TataIbadahView.html', [
    # css
    ("  .ti-link:hover { text-decoration: underline; }\n",
     "  .ti-link:hover { text-decoration: underline; }\n"
     "  .ti-combo { position: absolute; left: 0; right: 0; top: 100%; margin-top: 4px; z-index: 30; background: #fff; border: 1px solid #e6d8b6; border-radius: 12px; box-shadow: 0 12px 28px rgba(58,42,21,.14); max-height: 264px; overflow: auto; padding: 4px; }\n"
     "  .ti-combo[hidden] { display: none; }\n"
     "  .ti-combo-opt { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 9px 10px; border-radius: 8px; cursor: pointer; font-size: 14px; color: #3a2a15; }\n"
     "  .ti-combo-opt.on { background: #F3E9CE; }\n"
     "  .ti-combo-opt small { color: #8a7952; font-size: 12px; white-space: nowrap; }\n", 1),
    # blocks
    ("tiB('b4', 4, 'Kata pembuka', 'auto', 'Duduk')", "tiB('b4', 4, 'Kata pembuka', 'auto', 'Duduk', { verse: 'kp' })", 1),
    ("{ verse: true, opts:", "{ verse: 'ba', opts:", 1),
    ("tiB('b17', 17, 'Nas persembahan · Mazmur 116:12-14', 'text', 'Duduk', { field: 'offering',",
     "tiB('b17', 17, 'Nas persembahan', 'text', 'Duduk', { verse: 'of', field: 'offering',", 1),
    # state
    ("conflict: null, baFetch: { busy: false, error: '' },",
     "conflict: null, vFetch: { kp: {}, ba: {}, of: {} }, vTimers: {}, combo: null, dateFree: false,", 1),
    # helpers
    ("function tiBa(svc) { return svc.baBook && svc.baCh && TI_VS_RE.test(String(svc.baVs || '').trim()) ? svc.baBook + ' ' + svc.baCh + ':' + String(svc.baVs).trim() : ''; }\n",
     "/* Verses picked as book / chapter / verses: svc.kpBook, svc.kpCh, svc.kpVs and so on; their TB text is texts.kpText. */\n"
     "var TI_VERSES = { kp: 'Nas kata pembuka', ba: 'Nas berita anugerah', of: 'Nas persembahan' };\n"
     "function tiRef(svc, p) {\n"
     "  var vs = String(svc[p + 'Vs'] || '').trim();\n"
     "  return svc[p + 'Book'] && svc[p + 'Ch'] && TI_VS_RE.test(vs) ? svc[p + 'Book'] + ' ' + svc[p + 'Ch'] + ':' + vs : '';\n"
     "}\n", 1),
    ("  ['reading', 'baText', 'baTextRef'].forEach(function (k) { if (svc.texts[k] == null) svc.texts[k] = ''; });\n  return svc.texts;\n}\n",
     "  ['reading', 'kpText', 'kpTextRef', 'baText', 'baTextRef', 'ofText', 'ofTextRef'].forEach(function (k) { if (svc.texts[k] == null) svc.texts[k] = ''; });\n"
     "  tiVerseDefaults(svc);\n"
     "  return svc.texts;\n}\n\n"
     "/* Older services: Nas kata pembuka was free text, and the offering verse was the fixed one in LiturgiText.js. */\n"
     "function tiVerseDefaults(svc) {\n"
     "  if (svc.kp && !svc.kpBook) {\n"
     "    var m = /^(.+?)\\s+(\\d+)\\s*:\\s*(.+)$/.exec(String(svc.kp).trim());\n"
     "    var book = m && TI_BOOKS.filter(function (b) { return b.toLowerCase() === m[1].toLowerCase(); })[0];\n"
     "    if (book && TI_VS_RE.test(m[3].trim())) { svc.kpBook = book; svc.kpCh = m[2]; svc.kpVs = m[3].trim(); }\n"
     "  }\n"
     "  if (svc.ofBook == null) {\n"
     "    var ov = tiState.liturgy.offeringVerse || {}, om = /^(.+?)\\s+(\\d+):(.+)$/.exec(ov.ref || '');\n"
     "    svc.ofBook = om ? om[1] : ''; svc.ofCh = om ? om[2] : ''; svc.ofVs = om ? om[3] : '';\n"
     "    if (om && !svc.texts.ofText) { svc.texts.ofText = ov.text; svc.texts.ofTextRef = ov.ref; svc.texts.ofTextAuto = true; }\n"
     "  }\n"
     "}\n", 1),
    # checks
    ("['pf', 'Pelayan Firman', svc.pf], ['kp', 'Nas kata pembuka', svc.kp], ['baBook', 'Nas berita anugerah', tiBa(svc)]]",
     "['pf', 'Pelayan Firman', svc.pf], ['kpBook', 'Nas kata pembuka', tiRef(svc, 'kp') || svc.kp], ['baBook', 'Nas berita anugerah', tiRef(svc, 'ba')], ['ofBook', 'Nas persembahan', tiRef(svc, 'of')]]", 1),
    ("[['series', svc.series], ['sub', svc.sub], ['kp', svc.kp], ['season', svc.season]]",
     "[['series', svc.series], ['sub', svc.sub], ['season', svc.season]]", 1),
    ("  if (tiBa(svc) && !tx.baText.trim()) ambers.push({ text: 'Teks berita anugerah kosong', sub: tiBa(svc), to: 'tiF-baText' });\n",
     "  ['ba', 'of'].forEach(function (p) {\n"
     "    if (tiRef(svc, p) && !tx[p + 'Text'].trim()) ambers.push({ text: 'Teks ' + TI_VERSES[p].toLowerCase() + ' kosong', sub: tiRef(svc, p), to: 'tiF-' + p + 'Text' });\n"
     "  });\n", 1),
    ("['pf', 'Pelayan Firman'], ['kp', 'Nas kata pembuka']].forEach(function (f) {",
     "['pf', 'Pelayan Firman']].forEach(function (f) {", 1),
    ("    if (b.k === 'b8' && !tiBa(svc)) t.push({ id: 'tiF-baBook', label: 'Nas berita anugerah' });\n",
     "    if (b.verse && !tiRef(svc, b.verse) && !(b.verse === 'kp' && svc.kp)) t.push({ id: 'tiF-' + b.verse + 'Book', label: TI_VERSES[b.verse] });\n", 1),
    # payload
    ("    baBook: svc.baBook, baCh: svc.baCh, baVs: String(svc.baVs || '').trim(), pk: svc.pk, status: svc.status,\n",
     "    pk: svc.pk, status: svc.status,\n", 1),
    ("    texts: tiTexts(svc), baseUpdatedAt: svc.updatedAt || '', force: !!svc.forceSave\n  };\n",
     "    texts: tiTexts(svc), baseUpdatedAt: svc.updatedAt || '', force: !!svc.forceSave\n  };\n"
     "  Object.keys(TI_VERSES).forEach(function (p) {\n"
     "    payload[p + 'Book'] = svc[p + 'Book'] || ''; payload[p + 'Ch'] = svc[p + 'Ch'] || ''; payload[p + 'Vs'] = String(svc[p + 'Vs'] || '').trim();\n"
     "  });\n", 1),
    # new service: masa blank, offering verse carried from the previous service
    ("    id: null, date: date, season: tiSeason(date), series: prev ? prev.series : '', sub: '', pf: prev ? prev.pf : '', kp: '',\n    baBook: '', baCh: '', baVs: '', pk: false, status: 'Draft',\n",
     "    id: null, date: date, season: '', series: prev ? prev.series : '', sub: '', pf: prev ? prev.pf : '', kp: '',\n    kpBook: '', kpCh: '', kpVs: '', baBook: '', baCh: '', baVs: '', pk: false, status: 'Draft',\n", 1),
    ("  ['call', 'confession', 'offering'].forEach(function (k) { if (carry[k] != null) svc.texts[k] = carry[k]; });\n  tiTexts(svc);\n",
     "  ['call', 'confession', 'offering'].forEach(function (k) { if (carry[k] != null) svc.texts[k] = carry[k]; });\n"
     "  if (prev && prev.ofBook != null) {\n"
     "    svc.ofBook = prev.ofBook; svc.ofCh = prev.ofCh; svc.ofVs = prev.ofVs;\n"
     "    ['ofText', 'ofTextRef', 'ofTextAuto'].forEach(function (k) { if (carry[k] != null) svc.texts[k] = carry[k]; });\n"
     "  }\n"
     "  tiTexts(svc);\n", 1),
    # details card
    ("      field('date', 'Tanggal', 'type=\"date\"') +\n"
     "      field('season', 'Masa · kalender gerejawi') +\n"
     "      field('series', 'Seri', 'list=\"tiSeriesList\" placeholder=\"Pilih atau tulis seri\"') +\n",
     "      tiDateFieldHtml(svc) +\n"
     "      '<label class=\"ti-label\"><span>Masa · kalender gerejawi</span><input id=\"tiF-season\" data-tif=\"season\" class=\"ti-field\" value=\"' + esc(svc.season) + '\" placeholder=\"Opsional\"><span id=\"tiSeasonHint\">' + tiSeasonHintHtml() + '</span></label>' +\n"
     "      '<div class=\"ti-label\" style=\"position:relative;\"><span>Seri</span><div style=\"position:relative;\">' +\n"
     "        '<input id=\"tiF-series\" data-tif=\"series\" data-ticombo=\"series\" class=\"ti-field\" autocomplete=\"off\" value=\"' + esc(svc.series) + '\" placeholder=\"Cari atau tulis seri\" style=\"padding-right:38px;\">' +\n"
     "        '<span data-ti=\"comboToggle\" data-k=\"series\" style=\"position:absolute; right:8px; top:50%; transform:translateY(-50%); display:flex; padding:4px; color:#8a7952; cursor:pointer;\">' + icon('down', 16) + '</span>' +\n"
     "        '<div id=\"tiCombo-series\" class=\"ti-combo\" hidden></div></div></div>' +\n", 1),
    ("      field('kp', 'Nas kata pembuka', 'placeholder=\"Kitab pasal:ayat\"') +\n", "", 1),
    ("    tiDatalist('tiSeriesList', tiState.services.map(function (s) { return s.series; }).concat(tiState.schedule.map(function (e) { return e.theme.indexOf(':') !== -1 ? e.theme.split(':')[0] : ''; }))) +\n", "", 1),
    # block parts
    ("    h += '<span style=\"' + pad + ' font-size:12.5px; color:#8a7952; line-height:1.5;\">Dicetak setelah ajakan: <b>Dasar Persembahan kita adalah ' + esc(ov.ref) + '</b> <i>(' + esc(ov.text) + ')</i></span>';\n",
     "    h += '<span style=\"' + pad + ' font-size:12.5px; color:#8a7952; line-height:1.5;\">Dicetak setelah ajakan: <b>Dasar Persembahan kita adalah ' + esc(tiRef(svc, 'of') || '…') + '</b>, lalu teks ayatnya</span>';\n", 1),
    ("    var ov = tiState.liturgy.offeringVerse || {};\n", "", 1),
    ("    if (b.k === 'b0') note = tiDateLong(svc.date) + ' · ' + (svc.season || 'masa belum diisi') + ' · ' + (svc.pf || 'PF belum dipilih');\n"
     "    if (b.k === 'b4') note = 'Nas: ' + (svc.kp || 'belum diisi') + ' · diambil dari detail ibadah';\n",
     "    if (b.k === 'b0') note = [tiDateLong(svc.date), svc.season, svc.pf || 'PF belum dipilih'].filter(Boolean).join(' · ');\n"
     "    if (b.k === 'b4') note = 'Liturgos menyampaikan tema dan nas ' + (tiRef(svc, 'kp') || svc.kp || '(belum dipilih)');\n", 1),
])


def cut(name, start, end, new):
    path = os.path.join(root, name)
    s = open(path).read()
    i = s.index(start)
    j = s.index(end, i) + len(end)
    assert s.count(start) == 1
    open(path, 'w').write(s[:i] + new + s[j:])


VERSE_FNS = r'''/* Nas row (book, chapter, verses) and the editable TB text, for one of TI_VERSES. */
function tiVerseHtml(p, area) {
  var svc = tiState.cur, sm = 'padding:9px 12px; font-size:14px;';
  return '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">' +
      '<span style="font-size:12.5px; font-weight:700; color:#8a7952;">Nas</span>' +
      '<select id="tiF-' + p + 'Book" data-tif="' + p + 'Book" class="ti-field" style="flex:1 1 170px; width:auto; ' + sm + '">' +
        '<option value="">Pilih kitab</option>' + TI_BOOKS.map(function (bk) { return '<option' + (svc[p + 'Book'] === bk ? ' selected' : '') + '>' + bk + '</option>'; }).join('') +
      '</select>' +
      '<input data-tif="' + p + 'Ch" type="number" min="1" value="' + esc(svc[p + 'Ch']) + '" placeholder="Pasal" class="ti-field" style="width:84px; ' + sm + '">' +
      '<span style="color:#8a7952; font-weight:700;">:</span>' +
      '<input data-tif="' + p + 'Vs" value="' + esc(svc[p + 'Vs']) + '" placeholder="Ayat, mis. 1-2" class="ti-field" style="width:130px; ' + sm + '">' +
      '<span style="font-size:11px; font-weight:700; padding:3px 7px; border:1px solid #e6d8b6; border-radius:6px; color:#8a7952;">TB</span>' +
    '</div>' +
    '<span id="tiVMsg-' + p + '">' + tiVerseMsgHtml(p) + '</span>' +
    area(p + 'Text', p === 'kp' ? 'Teks ayat (opsional, dicetak di liturgi)' : 'Teks ayat (dicetak di liturgi)', 3, 'Terisi otomatis dari Alkitab TB setelah nas lengkap') +
    '<span id="tiVFetch-' + p + '">' + tiVerseFetchHtml(p) + '</span>';
}

function tiVerseMsgHtml(p) {
  var svc = tiState.cur, vs = String(svc[p + 'Vs'] || '').trim(), ref = tiRef(svc, p);
  if (vs && !TI_VS_RE.test(vs)) return '<span style="font-size:12.5px; font-weight:600; color:#a3420e;">Format ayat: 1, 1-3, atau 1,4</span>';
  if (!ref && p === 'kp' && svc.kp) return '<span style="font-size:12.5px; font-weight:600; color:#a3420e;">Tertulis “' + esc(svc.kp) + '”. Pilih kitab, pasal, dan ayat.</span>';
  return ref ? '<span class="ti-pill" style="background:#F3E9CE; color:#6E2621;">' + esc(ref) + ' · Alkitab TB</span>' : '';
}

function tiVerseFetchHtml(p) {
  var f = tiState.vFetch[p], tx = tiTexts(tiState.cur), ref = tiRef(tiState.cur, p), text = tx[p + 'Text'], from = tx[p + 'TextRef'];
  var link = function (label) { return '<span data-ti="fetchVerse" data-k="' + p + '" class="ti-link">' + label + '</span>'; };
  if (f.busy) return '<span style="font-size:12px; color:#9a8763;">Mengambil teks ' + esc(ref) + '…</span>';
  if (f.error) return '<span style="font-size:12px; font-weight:600; color:#a3420e;">' + esc(f.error) + '</span> ' + link('Coba lagi');
  if (!ref) return '';
  var stale = text && from && from !== ref;
  return '<span style="font-size:12px; color:' + (stale ? '#a3420e' : '#9a8763') + ';">' +
    (stale ? 'Teks ini untuk ' + esc(from) + ', bukan ' + esc(ref) + '. ' : text ? 'Sumber: Alkitab TB (SABDA) · bisa diedit. ' : '') +
    '</span>' + link(text ? 'Ambil ulang teks' : 'Ambil teks');
}

function tiVerseChanged(p) {
  var svc = tiState.cur;
  if (p === 'kp') svc.kp = tiRef(svc, 'kp');
  tiState.vFetch[p] = {};
  clearTimeout(tiState.vTimers[p]);
  tiState.vTimers[p] = setTimeout(function () { tiFetchVerse(p, false); }, 700);
}

/* Fills a verse's text from Alkitab TB; force replaces text the user edited. */
function tiFetchVerse(p, force) {
  var svc = tiState.cur, ref = svc && tiRef(svc, p);
  if (!ref) return;
  var tx = tiTexts(svc);
  if (!force && tx[p + 'Text'] && (tx[p + 'TextRef'] === ref || !tx[p + 'TextAuto'])) { tiRenderVerse(p); return; }
  tiState.vFetch[p] = { busy: true };
  tiRenderVerse(p);
  google.script.run
    .withSuccessHandler(function (res) {
      tiState.vFetch[p] = { error: res.success ? '' : res.message };
      if (res.success && tiState.cur === svc && tiRef(svc, p) === ref) {
        tx[p + 'Text'] = res.text; tx[p + 'TextRef'] = ref; tx[p + 'TextAuto'] = true;
        var el = document.getElementById('tiF-' + p + 'Text');
        if (el) el.value = res.text;
        tiRenderAside();
        tiQueueSave();
      }
      tiRenderVerse(p);
    })
    .withFailureHandler(function (err) { tiState.vFetch[p] = { error: err && err.message ? err.message : String(err) }; tiRenderVerse(p); })
    .fetchBibleText(svc[p + 'Book'], svc[p + 'Ch'], String(svc[p + 'Vs'] || '').trim());
}

function tiRenderVerse(p) {
  var msg = document.getElementById('tiVMsg-' + p), f = document.getElementById('tiVFetch-' + p);
  if (msg) msg.innerHTML = tiVerseMsgHtml(p);
  if (f) f.innerHTML = tiVerseFetchHtml(p);
}

'''

FIELD_FNS = r'''/* Tanggal is picked from the Service events registered in Event input; "Tanggal lain…" falls back to any date. */
function tiServiceEvents(svc) {
  var from = iso(shiftDays(startOfToday(), -35)), byDate = {};
  tiState.schedule.forEach(function (e) { if (tiIsService(e) && (e.date >= from || e.date === svc.date) && !byDate[e.date]) byDate[e.date] = e; });
  return Object.keys(byDate).sort().map(function (d) { return byDate[d]; });
}

function tiDateFieldHtml(svc) {
  var evs = tiServiceEvents(svc), input;
  var day = function (d) { return tiShort(d) + ' ' + d.slice(0, 4); };
  if (tiState.dateFree || !evs.length) {
    input = '<input id="tiF-date" data-tif="date" type="date" class="ti-field" value="' + esc(svc.date) + '">' +
      (evs.length ? '<span><span data-ti="dateList" class="ti-link">Pilih dari jadwal</span></span>' : '<span style="font-size:12px; color:#8a7952;">Belum ada ibadah terdaftar di Event input</span>');
  } else {
    var listed = evs.some(function (e) { return e.date === svc.date; });
    input = '<select id="tiF-date" data-tif="date" class="ti-field">' +
      (listed ? '' : '<option value="' + esc(svc.date) + '" selected>' + esc(svc.date ? day(svc.date) + ' · belum di jadwal' : 'Pilih ibadah') + '</option>') +
      evs.map(function (e) {
        var taken = tiByDate(e.date, svc);
        return '<option value="' + e.date + '"' + (e.date === svc.date ? ' selected' : '') + (taken ? ' disabled' : '') + '>' +
          esc(day(e.date) + ' · ' + (e.theme || 'tanpa tema') + (taken ? ' (sudah ada)' : '')) + '</option>';
      }).join('') +
      '<option value="__free">Tanggal lain…</option>' +
    '</select>';
  }
  return '<div id="tiDateField" class="ti-label"><span>Tanggal · ibadah terdaftar</span>' + input + '</div>';
}

function tiRenderDateField() {
  var el = document.getElementById('tiDateField');
  if (el) el.outerHTML = tiDateFieldHtml(tiState.cur);
}

/* A Service picked as the date brings its theme and Pelayan Firman from the schedule. */
function tiTakeSchedule(svc) {
  var sched = tiScheduleOn(svc.date);
  if (!sched || !(String(sched.theme || '').trim() || sched.pastor)) return;
  tiApplySchedule(svc, sched);
  ['series', 'sub', 'pf'].forEach(function (k) { var el = document.getElementById('tiF-' + k); if (el) el.value = svc[k]; });
}

/* Masa is optional: blank by default, with the church-calendar season offered as a one-click suggestion. */
function tiSeasonHintHtml() {
  var svc = tiState.cur, s = !svc.season && tiSeason(svc.date);
  return s ? '<span style="font-size:12px; color:#8a7952;">Saran: <span data-ti="seasonUse" class="ti-link">' + esc(s) + '</span></span>' : '';
}

/* Seri: a searchable list of the series already used, newest first; typing a new name keeps it as a new series. */
function tiSeriesOptions() {
  var last = {};
  var add = function (v, date) { v = String(v || '').trim(); if (v && !(last[v] >= date)) last[v] = date || ''; };
  tiState.services.forEach(function (s) { add(s.series, s.date); });
  tiState.schedule.forEach(function (e) { var t = String(e.theme || ''); if (tiIsService(e) && t.indexOf(':') !== -1) add(t.split(':')[0], e.date); });
  return Object.keys(last).sort(function (a, b) { return last[a] < last[b] ? 1 : last[a] > last[b] ? -1 : a.localeCompare(b); })
    .map(function (v) { return { v: v, date: last[v] }; });
}

function tiComboItems() {
  var q = String(tiState.cur.series || '').trim(), ql = q.toLowerCase(), all = tiSeriesOptions();
  var exact = all.some(function (o) { return o.v.toLowerCase() === ql; });
  var items = exact || !q ? all : all.filter(function (o) { return o.v.toLowerCase().indexOf(ql) !== -1; });
  return q && !exact ? [{ v: q, fresh: true }].concat(items) : items;
}

function tiRenderCombo() {
  var c = tiState.combo, box = document.getElementById('tiCombo-series');
  if (!box) return;
  if (!c) { box.hidden = true; return; }
  c.items = tiComboItems();
  c.hi = Math.max(0, Math.min(c.hi, c.items.length - 1));
  box.hidden = !c.items.length;
  box.innerHTML = c.items.map(function (o, i) {
    return '<div class="ti-combo-opt' + (i === c.hi ? ' on' : '') + '" data-ticopt="' + i + '"><span>' + (o.fresh ? 'Seri baru: “' + esc(o.v) + '”' : esc(o.v)) + '</span>' +
      (o.date ? '<small>' + esc(tiShort(o.date) + ' ' + o.date.slice(0, 4)) + '</small>' : '') + '</div>';
  }).join('');
  var on = box.querySelector('.on');
  if (on && on.offsetTop < box.scrollTop) box.scrollTop = on.offsetTop;
  else if (on && on.offsetTop + on.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = on.offsetTop + on.offsetHeight - box.clientHeight;
}

function tiComboOpen() { tiState.combo = { hi: 0 }; tiRenderCombo(); }
function tiComboClose() { tiState.combo = null; tiRenderCombo(); }

function tiComboPick(i) {
  var c = tiState.combo, o = c && c.items && c.items[i], svc = tiState.cur;
  if (o && svc) {
    svc.series = o.v;
    document.getElementById('tiF-series').value = o.v;
    tiRenderDynamic();
    tiQueueSave();
  }
  tiComboClose();
}

function tiComboKey(e) {
  var c = tiState.combo;
  if (!c) { if (e.key === 'ArrowDown') { e.preventDefault(); tiComboOpen(); } return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); c.hi += e.key === 'ArrowDown' ? 1 : -1; tiRenderCombo(); }
  else if (e.key === 'Enter') { e.preventDefault(); tiComboPick(c.hi); }
  else if (e.key === 'Escape') { e.preventDefault(); tiComboClose(); }
  else if (e.key === 'Tab') tiComboClose();
}

/* Combo options and its chevron act on mousedown so the input keeps focus. */
function tiOnMouseDown(e) {
  var opt = e.target.closest && e.target.closest('[data-ticopt]');
  if (opt) { e.preventDefault(); tiComboPick(Number(opt.getAttribute('data-ticopt'))); return; }
  if (!(e.target.closest && e.target.closest('[data-ti=comboToggle]'))) return;
  e.preventDefault();
  var inp = document.getElementById('tiF-series');
  if (!inp || inp.matches(':disabled')) return;
  if (tiState.combo) tiComboClose();
  else if (document.activeElement === inp) tiComboOpen();
  else inp.focus();
}

'''

cut('TataIbadahView.html', "  if (b.verse) {\n", "'<span id=\"tiBaFetch\">' + tiBaFetchHtml() + '</span>';\n  }\n",
    "  if (b.verse) inputs += tiVerseHtml(b.verse, area);\n")
cut('TataIbadahView.html', "function tiBaFetchHtml() {", "function tiRenderBaFetch() {\n  var el = document.getElementById('tiBaFetch');\n  if (el) el.innerHTML = tiBaFetchHtml();\n}\n\n", VERSE_FNS)
cut('TataIbadahView.html', "function tiBaMsgHtml() {", "}\n\nfunction tiRenderBlock", "function tiRenderBlock")

patch('TataIbadahView.html', [
    ("function tiBuilderHtml() {\n", FIELD_FNS + "function tiBuilderHtml() {\n", 1),
    ("function tiOpenService(svc) {\n  tiTexts(svc);\n", "function tiOpenService(svc) {\n  tiTexts(svc);\n  tiState.dateFree = false;\n  tiState.combo = null;\n", 1),
    ("  tiRenderBaFetch();\n  tiRenderBanner();\n  var baMsg = document.getElementById('tiBaMsg');\n  if (baMsg) baMsg.innerHTML = tiBaMsgHtml();\n",
     "  Object.keys(TI_VERSES).forEach(tiRenderVerse);\n  var sh = document.getElementById('tiSeasonHint');\n  if (sh) sh.innerHTML = tiSeasonHintHtml();\n  tiRenderBanner();\n", 1),
    ("  if (f && svc) {\n    if (f === 'pk') svc.pk = t.checked;\n",
     "  if (f && svc) {\n    if (f === 'date' && t.value === '__free') { tiState.dateFree = true; tiRenderDateField(); return; }\n    if (f === 'pk') svc.pk = t.checked;\n", 1),
    ("    if (f === 'date') {\n      svc.season = tiSeason(t.value) || svc.season;\n      document.getElementById('tiF-season').value = svc.season;\n    }\n"
     "    if (f === 'baBook' || f === 'baCh' || f === 'baVs') {\n      tiState.baFetch = { busy: false, error: '' };\n      clearTimeout(tiState.baTimer);\n      tiState.baTimer = setTimeout(function () { tiFetchBa(false); }, 700);\n    }\n",
     "    if (f === 'date') tiTakeSchedule(svc);\n    if (f === 'series' && tiState.combo) { tiState.combo.hi = 0; tiRenderCombo(); }\n"
     "    var vp = " + V + ".exec(f);\n    if (vp) tiVerseChanged(vp[1]);\n", 1),
    ("    if (tt === 'baText') { texts.baTextAuto = false; if (!texts.baTextRef) texts.baTextRef = tiBa(svc); tiRenderBaFetch(); }\n",
     "    var tp = /^(kp|ba|of)Text$/.exec(tt);\n    if (tp) { texts[tp[1] + 'TextAuto'] = false; if (!texts[tp[1] + 'TextRef']) texts[tp[1] + 'TextRef'] = tiRef(svc, tp[1]); tiRenderVerse(tp[1]); }\n", 1),
    ("  var editing = { toggle: 1, variant: 1, pick: 1, fetchBa: 1 };", "  var editing = { toggle: 1, variant: 1, pick: 1, fetchVerse: 1, seasonUse: 1, dateList: 1 };", 1),
    ("    case 'fetchBa': tiFetchBa(true); break;\n",
     "    case 'fetchVerse': tiFetchVerse(k, true); break;\n"
     "    case 'seasonUse': e.preventDefault(); svc.season = tiSeason(svc.date); document.getElementById('tiF-season').value = svc.season; tiRenderDynamic(); tiQueueSave(); break;\n"
     "    case 'dateList': tiState.dateFree = false; tiRenderDateField(); break;\n", 1),
    ("    return;\n  }\n  if (e.key === 'Escape') {\n    if (tiState.songForm)",
     "    return;\n  }\n  if (e.target.getAttribute && e.target.getAttribute('data-ticombo')) { tiComboKey(e); return; }\n  if (e.key === 'Escape') {\n    if (tiState.songForm)", 1),
    ("document.addEventListener('keydown', tiOnKey);\n",
     "document.addEventListener('keydown', tiOnKey);\ndocument.addEventListener('mousedown', tiOnMouseDown);\n"
     "document.addEventListener('focusin', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-ticombo')) tiComboOpen(); });\n"
     "document.addEventListener('focusout', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-ticombo')) tiComboClose(); });\n", 1),
])

s = open(os.path.join(root, 'TataIbadahView.html')).read()
assert 'tiBa(' not in s and 'baFetch' not in s and 'tiSeriesList' not in s, [w for w in ('tiBa(', 'baFetch', 'tiSeriesList') if w in s]

patch('TataIbadah.js', [
    ("    baBook: data.baBook || '',\n    baCh: data.baCh || '',\n    baVs: data.baVs || '',\n",
     "    kpBook: data.kpBook || '', kpCh: data.kpCh || '', kpVs: data.kpVs || '',\n"
     "    baBook: data.baBook || '',\n    baCh: data.baCh || '',\n    baVs: data.baVs || '',\n"
     "    // Left undefined on services saved before the offering verse was per service: they print LITURGI_OFFERING_VERSE.\n"
     "    ofBook: data.ofBook, ofCh: data.ofCh, ofVs: data.ofVs,\n", 1),
    ("    baBook: p.baBook || '', baCh: String(p.baCh || ''), baVs: p.baVs || '',\n",
     "    kpBook: p.kpBook || '', kpCh: String(p.kpCh || ''), kpVs: p.kpVs || '',\n"
     "    baBook: p.baBook || '', baCh: String(p.baCh || ''), baVs: p.baVs || '',\n"
     "    ofBook: p.ofBook || '', ofCh: String(p.ofCh || ''), ofVs: p.ofVs || '',\n", 1),
])

patch('Liturgi.js', [
    ("  w.p(svc.season || '', litMerge_(sora, { size: 12 }));\n", "  if (svc.season) w.p(svc.season, litMerge_(sora, { size: 12 }));\n", 1),
    ("  w.say('L', [['(menyampaikan tema: ' + theme + ' dan Firman Tuhan ' + (svc.kp || '…') + ')', { bold: true, color: LIT_BLUE }]]);\n",
     "  w.say('L', [['(menyampaikan tema: ' + theme + ' dan Firman Tuhan ' + (svc.kp || '…') + ')', { bold: true, color: LIT_BLUE }]]);\n"
     "  if (String(texts.kpText || '').trim()) w.say('', [['(' + String(texts.kpText).trim() + ')', blueI]]);\n", 1),
    ("  w.say('Pnt', [[(String(texts.offering || '').trim() || '…') + ' Dasar Persembahan kita adalah ' + LITURGI_OFFERING_VERSE.ref, { color: LIT_BLUE }]]);\n"
     "  w.say('', [['(' + LITURGI_OFFERING_VERSE.text + ')', blueI]]);\n",
     "  var fixedOf = svc.ofBook == null;\n"
     "  var ofRef = fixedOf ? LITURGI_OFFERING_VERSE.ref : svc.ofBook && svc.ofCh && svc.ofVs ? svc.ofBook + ' ' + svc.ofCh + ':' + svc.ofVs : '…';\n"
     "  var ofText = fixedOf ? LITURGI_OFFERING_VERSE.text : String(texts.ofText || '').trim();\n"
     "  w.say('Pnt', [[(String(texts.offering || '').trim() || '…') + ' Dasar Persembahan kita adalah ' + ofRef, { color: LIT_BLUE }]]);\n"
     "  if (ofText) w.say('', [['(' + ofText + ')', blueI]]);\n", 1),
])

patch('LiturgiText.js', [
    ("/* The offering verse printed after the weekly introduction (Nas persembahan). */",
     "/* Nas persembahan for a new service with no previous one to carry it from, and for services saved before it was per service. */", 1),
])
print('ok')
