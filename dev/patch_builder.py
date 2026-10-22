"""One-off patch for TataIbadahView.html (weekly texts, shared liturgy text, schedule sync,
conflicts, Published lock, song library). Kept in dev/ for the record."""
import re, sys
p = sys.argv[1]
s = open(p).read()


def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:80], s.count(a))
    s = s.replace(a, b)


def between(start, end, new):
    global s
    i = s.index(start)
    j = s.index(end, i)
    s = s[:i] + new + s[j:]


# ---------- template ----------
s = re.sub(r"(tiB\('b(?:1|3|13|14|16|19|23)', \d+, '[^']*', 'fixed', '[^']*'), \{ body: '(?:[^'\\]|\\.)*' \}\)", r"\1)", s)
rep("tiB('b2', 2, 'Panggilan beribadah', 'song', 'Berdiri'),",
    "tiB('b2', 2, 'Panggilan beribadah', 'song', 'Berdiri', { field: 'call', fieldLabel: 'Kata liturgos' }),")
rep("tiB('b6', 6, 'Pengakuan dosa', 'fixed', 'Duduk', { body: 'L: Marilah kita mengaku dosa di hadapan Allah yang Mahakasih…' }),",
    "tiB('b6', 6, 'Pengakuan dosa', 'text', 'Duduk', { field: 'confession', fieldLabel: 'Narasi liturgos' }),")
rep("tiB('b11', 11, 'Doa, pembacaan Alkitab, Haleluya', 'variant', 'Duduk', { opts:",
    "tiB('b11', 11, 'Doa, pembacaan Alkitab, Haleluya', 'variant', 'Duduk', { reading: true, opts:")
rep("tiB('b17', 17, 'Nas persembahan · Mazmur 116:12-14', 'fixed', 'Duduk', { body: 'Bagaimana akan kubalas kepada TUHAN segala kebajikan-Nya kepadaku?…' }),",
    "tiB('b17', 17, 'Nas persembahan · Mazmur 116:12-14', 'text', 'Duduk', { field: 'offering', fieldLabel: 'Ajakan persembahan (Pnt)' }),")
assert "body:" not in s[s.index('var TI_TPL'):s.index('var TI_BLOCKS')], 'fixed bodies left'

# ---------- state ----------
rep("""  dl: { busy: '', error: '' }
};""", """  dl: { busy: '', error: '' },
  liturgy: { fixed: {}, defaults: {}, offeringVerse: { ref: '', text: '' } },
  conflict: null, baFetch: { busy: false, error: '' },
  lib: { q: '', h: 'Semua', merge: null, mergeTo: '' }
};""")

# ---------- helpers: texts, marks, schedule ----------
rep("""function tiScheduleOn(date) {
  return tiState.schedule.filter(function (e) { return e.date === date; }).sort(function (a, b) { return a.tag === 'Service' ? -1 : b.tag === 'Service' ? 1 : 0; })[0];
}""", """/* Tags that are never the Sunday service itself (same rule as pickScheduleEvent_ on the server). */
var TI_SCHEDULE_SKIP = ['Meeting', 'Fellowship', 'OFF'];

function tiScheduleOn(date) {
  var usable = tiState.schedule.filter(function (e) { return e.date === date && TI_SCHEDULE_SKIP.indexOf(e.tag) === -1; });
  return usable.filter(function (e) { return e.tag === 'Service'; })[0] || usable[0];
}

/* The service's weekly liturgist texts, with missing ones filled from the defaults. */
function tiTexts(svc) {
  var d = tiState.liturgy.defaults || {};
  svc.texts = svc.texts || {};
  ['call', 'confession', 'offering'].forEach(function (k) { if (svc.texts[k] == null) svc.texts[k] = d[k] || ''; });
  ['reading', 'baText', 'baTextRef'].forEach(function (k) { if (svc.texts[k] == null) svc.texts[k] = ''; });
  return svc.texts;
}

/* LiturgiText.js marks (*bold* _italic_ ~blue italic~ ^blue^) as HTML. */
function tiMarksHtml(text) {
  var st = {}, out = '', keys = { '*': 'b', '_': 'i', '~': 'bi', '^': 'blue' };
  var open = function () {
    var css = (st.b ? 'font-weight:700;' : '') + (st.i || st.bi ? 'font-style:italic;' : '') + (st.bi || st.blue ? 'color:#31536f;' : '');
    return css ? '<span style="' + css + '">' : '<span>';
  };
  out = open();
  String(text).split('').forEach(function (c) {
    if (keys[c]) { st[keys[c]] = !st[keys[c]]; out += '</span>' + open(); } else out += esc(c);
  });
  return out + '</span>';
}

/* A fixed block's wording, as the booklet prints it. */
function tiFixedHtml(k) {
  var line = 'style="margin:0 0 4px;"';
  return (tiState.liturgy.fixed[k] || []).map(function (e) {
    switch (e[0]) {
      case 'say': return '<p ' + line + '><span style="display:inline-block; min-width:34px; font-weight:700;">' + esc(e[1]) + '</span>' + (e[1] ? ': ' : '') + tiMarksHtml(e[2]) + '</p>';
      case 'note': case 'p': return '<p style="margin:0 0 4px; text-align:center; font-style:italic;">' + tiMarksHtml(e[1]) + '</p>';
      case 'line': return '<p ' + line + '>' + tiMarksHtml(e[1]) + '</p>';
      case 'steps': return e[1].map(function (x, i) { return '<p ' + line + '>' + (i + 1) + '. ' + tiMarksHtml(x) + '</p>'; }).join('');
      case 'image': return '<p style="margin:0 0 4px; text-align:center; color:#9a8763;">[notasi ' + esc(e[1]) + ']</p>';
      case 'posture': return '<p style="margin:0 0 4px; text-align:right; font-style:italic;">(' + esc(e[1]) + ')</p>';
    }
    return '';
  }).join('');
}

/* Runs fn once any pending autosave has reached the sheet. */
function tiAfterSave(fn) {
  if (tiState.pending) tiFlushSave();
  (function go() {
    if (tiState.saving || tiState.pending) { setTimeout(go, 300); return; }
    fn();
  })();
}""")

rep("""function tiApplySchedule(svc, sched) {
  var theme = String(sched.theme || '');
  var i = theme.indexOf(':');
  if (i !== -1) { svc.series = theme.slice(0, i).trim(); svc.sub = theme.slice(i + 1).trim(); }
  else if (theme) svc.sub = theme.trim();
  if (sched.pastor) svc.pf = sched.pastor;
}""", """function tiApplySchedule(svc, sched) {
  var theme = String(sched.theme || '').trim();
  var i = theme.indexOf(':');
  if (i !== -1) { svc.series = theme.slice(0, i).trim(); svc.sub = theme.slice(i + 1).trim(); }
  else if (theme) { svc.series = ''; svc.sub = theme; }
  if (sched.pastor) svc.pf = sched.pastor;
}""")

# ---------- checks ----------
rep("""  var prev = tiPrevService(svc);
  if (prev) {
    TI_VARIANT_KEYS.forEach(function (k) {""", """  var tx = tiTexts(svc);
  if (!tx.call.trim() || /\\.\\.\\.\\s*$/.test(tx.call)) ambers.push({ text: 'Kata liturgos panggilan beribadah belum diisi', to: 'tiF-call' });
  if (!tx.reading.trim()) ambers.push({ text: 'Bacaan Alkitab belum diisi', to: 'tiF-reading' });
  if (tiBa(svc) && !tx.baText.trim()) ambers.push({ text: 'Teks berita anugerah kosong', sub: tiBa(svc), to: 'tiF-baText' });

  var prev = tiPrevService(svc);
  if (prev && prev.texts && prev.texts.confession && prev.texts.confession === tx.confession) {
    ambers.push({ text: 'Narasi pengakuan dosa sama dengan minggu lalu', sub: 'Pastikan disengaja', to: 'tiF-confession' });
  }
  if (prev) {
    TI_VARIANT_KEYS.forEach(function (k) {""")
rep("""    if (b.k === 'b8' && !tiBa(svc)) t.push({ id: 'tiF-baBook', label: 'Nas berita anugerah' });""",
    """    if (b.k === 'b2' && /\\.\\.\\.\\s*$|^\\s*$/.test(tiTexts(svc).call)) t.push({ id: 'tiF-call', label: 'Kata liturgos' });
    if (b.k === 'b8' && !tiBa(svc)) t.push({ id: 'tiF-baBook', label: 'Nas berita anugerah' });
    if (b.k === 'b11' && !tiTexts(svc).reading.trim()) t.push({ id: 'tiF-reading', label: 'Bacaan Alkitab' });""")

# ---------- load ----------
rep("""      tiState.schedule = data.schedule || [];
      tiSetSongs(data.songs || []);""", """      tiState.schedule = data.schedule || [];
      if (data.liturgy) tiState.liturgy = data.liturgy;
      tiSetSongs(data.songs || []);""")

# ---------- save: texts, conflict ----------
rep("""  if (!svc || tiState.saving) return;
  tiState.pending = null;""", """  if (!svc || tiState.saving) return;
  if (tiState.conflict && tiState.conflict.svc === svc && !svc.forceSave) { tiState.pending = null; return; }
  tiState.pending = null;""")
rep("""    slots: svc.slots, arr: svc.arr, variants: svc.variants, enabled: svc.enabled, lyrics: svc.lyrics
  };""", """    slots: svc.slots, arr: svc.arr, variants: svc.variants, enabled: svc.enabled, lyrics: svc.lyrics,
    texts: tiTexts(svc), baseUpdatedAt: svc.updatedAt || '', force: !!svc.forceSave
  };""")
rep("""      if (res.success) {
        svc.id = res.id;
        tiState.saveLabel = 'Tersimpan otomatis · ' + res.savedAt;
        tiState.saveError = false;
      } else {""", """      if (res.success) {
        svc.id = res.id;
        svc.updatedAt = res.updatedAt;
        svc.forceSave = false;
        tiState.saveLabel = 'Tersimpan otomatis · ' + res.savedAt;
        tiState.saveError = false;
      } else if (res.conflict) {
        tiState.conflict = { svc: svc, latest: res.latest };
        tiState.saveLabel = 'Belum tersimpan: ada versi lebih baru';
        tiState.saveError = true;
        tiRenderBanner();
      } else {""")

# ---------- new service / open ----------
rep("""    slots: {}, arr: {}, variants: {}, enabled: { b15: !!(next && next.pk), b22: false }, lyrics: {}
  };""", """    slots: {}, arr: {}, variants: {}, enabled: { b15: !!(next && next.pk), b22: false }, lyrics: {}, texts: {}
  };
  var carry = (prev && prev.texts) || {};
  ['call', 'confession', 'offering'].forEach(function (k) { if (carry[k] != null) svc.texts[k] = carry[k]; });
  tiTexts(svc);""")
rep("""function tiOpenService(svc) {
  tiState.cur = svc;""", """function tiOpenService(svc) {
  tiTexts(svc);
  tiState.cur = svc;
  tiState.conflict = null;""")

# ---------- render: tabs, list/library ----------
rep("""function tiRender() {
  var root = document.getElementById('viewTata');
  if (tiState.screen === 'builder' && tiState.cur) root.innerHTML = tiBuilderHtml();
  else root.innerHTML = tiListHtml();""", """function tiRender() {
  var root = document.getElementById('viewTata');
  if (tiState.screen === 'builder' && tiState.cur) root.innerHTML = tiBuilderHtml();
  else if (tiState.screen === 'library') { root.innerHTML = tiLibraryHtml(); tiRenderLibraryList(); }
  else root.innerHTML = tiListHtml();""")
rep("""function tiHeader(eyebrow, title, right) {""", """function tiTabs(active) {
  return '<div style="display:flex; gap:6px; margin-top:10px;">' + [['list', 'Ibadah'], ['library', 'Perpustakaan lagu']].map(function (t) {
    return '<button data-ti="tab" data-v="' + t[0] + '" class="pill-btn' + (active === t[0] ? ' on' : '') + '">' + t[1] + '</button>';
  }).join('') + '</div>';
}

function tiHeader(eyebrow, title, right) {""")
rep("""        '<h1 style="margin:0; font-weight:800; letter-spacing:-.025em; font-size:34px; line-height:1.15; color:#3a2a15; text-wrap:pretty;">' + title + '</h1>' +
      '</div>' + right +""", """        '<h1 style="margin:0; font-weight:800; letter-spacing:-.025em; font-size:34px; line-height:1.15; color:#3a2a15; text-wrap:pretty;">' + title + '</h1>' +
        tiTabs(tiState.screen === 'library' ? 'library' : 'list') +
      '</div>' + right +""")

# ---------- builder: banner, fieldset lock ----------
rep("""  html += '<main class="page-pad" style="flex:1; padding:24px 32px 80px;"><div style="max-width:1320px; margin:0 auto; display:flex; flex-direction:column; gap:22px;">';

  var field = function""", """  var locked = svc.status === 'Published';
  html += '<main class="page-pad" style="flex:1; padding:24px 32px 80px;"><div style="max-width:1320px; margin:0 auto; display:flex; flex-direction:column; gap:22px;">' +
    '<div id="tiBanner"></div>';

  var field = function""")
rep("""  html += '<section class="ti-card" style="padding:22px 24px; display:flex; flex-direction:column; gap:16px;">' +
    '<div style="display:grid;""", """  html += '<fieldset' + (locked ? ' disabled' : '') + ' style="border:0; padding:0; margin:0; min-width:0;"><section class="ti-card" style="padding:22px 24px; display:flex; flex-direction:column; gap:16px;">' +
    '<div style="display:grid;""")
rep("""      '<span id="tiSchedHint"></span>' +
    '</div>' +
  '</section>';""", """      '<span id="tiSchedHint"></span>' +
    '</div>' +
  '</section></fieldset>';""")
rep("""    '<section style="flex:1 1 600px; min-width:0; display:flex; flex-direction:column; gap:26px;">' +""",
    """    '<fieldset' + (locked ? ' disabled' : '') + ' style="border:0; padding:0; margin:0; flex:1 1 600px; min-width:0; display:flex; flex-direction:column; gap:26px;">' +""")
rep("""        sec.blocks.map(function (b) { return '<div id="tiBlk-' + b.k + '">' + tiBlockHtml(b) + '</div>'; }).join('') +
      '</div>';
    }).join('') +
    '</section>' +""", """        sec.blocks.map(function (b) { return '<div id="tiBlk-' + b.k + '">' + tiBlockHtml(b) + '</div>'; }).join('') +
      '</div>';
    }).join('') +
    '</fieldset>' +""")

# ---------- blocks: redrawn part + inputs part ----------
between("function tiBlockHtml(b) {", "function tiBaMsgHtml() {", r"""/*
 * One block is a card with a part that is redrawn on every change (tiMain-k)
 * and an inputs part drawn once, so typing in it keeps focus.
 * Returns { style, main, inputs }.
 */
function tiBlockParts(b) {
  var svc = tiState.cur;
  var n = tiN(b.n);
  if (b.kind === 'fixed') {
    var open = !!tiState.open[b.k];
    return { style: 'background:#F3E9CE; border-radius:12px;', inputs: '', main:
      '<button data-ti="expand" data-k="' + b.k + '" style="width:100%; cursor:pointer; display:grid; grid-template-columns:24px 14px minmax(0,1fr) auto; gap:10px; align-items:center; padding:10px 14px; text-align:left;">' +
        '<span style="font-size:12px; font-weight:700; color:#b3a37c; font-variant-numeric:tabular-nums;">' + n + '</span>' + TI_LOCK_SVG +
        '<span style="font-size:14px; font-weight:600; color:#6b5a38;">' + esc(b.title) + '</span>' +
        '<span class="ti-posture">' + esc(b.posture) + '</span>' +
      '</button>' +
      (open ? '<div style="padding:0 16px 14px 62px; font-size:13.5px; line-height:1.55; color:#6b5a38;">' + tiFixedHtml(b.k) + '</div>' : '') };
  }

  var on = tiIsOn(svc, b);
  var isSong = b.kind === 'song';
  var song = isSong ? tiState.songById[svc.slots[b.k]] : null;
  var hasToggle = !!(b.optional || b.kind === 'optional');
  var typeLabel = b.kind === 'variant' ? (b.verse ? 'Slot + variasi' : 'Variasi') : hasToggle ? 'Opsional' : b.kind === 'auto' ? 'Otomatis' : b.kind === 'text' ? 'Teks liturgos' : 'Slot';
  var border = !on ? '1px solid #f1e7cd' : (isSong && !song) ? '1px dashed #E85511' : '1px solid #ece0c2';
  var pad = 'padding-left:34px;';
  var tx = tiTexts(svc);

  var h = '<div style="display:grid; grid-template-columns:24px minmax(0,1fr) auto; gap:10px; align-items:center;">' +
      '<span style="font-size:12px; font-weight:800; color:#E85511; font-variant-numeric:tabular-nums;">' + n + '</span>' +
      '<span style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; min-width:0;">' +
        '<span style="font-size:14.5px; font-weight:700; color:#3a2a15;">' + esc(b.title) + '</span>' +
        '<span style="font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#E85511;">' + typeLabel + '</span>' +
      '</span>' +
      '<span style="display:flex; align-items:center; gap:8px;">' +
        (hasToggle ? '<button data-ti="toggle" data-k="' + b.k + '" aria-label="Aktifkan blok" style="width:36px; height:21px; border-radius:20px; background:' + (on ? '#E85511' : '#d9c79b') + '; position:relative; cursor:pointer; padding:0; flex-shrink:0;"><span style="position:absolute; top:2.5px; left:' + (on ? '17px' : '3px') + '; width:16px; height:16px; border-radius:50%; background:#fff; transition:left .15s;"></span></button>' : '') +
        '<span class="ti-posture">' + esc(b.posture) + '</span>' +
      '</span>' +
    '</div>';

  if (isSong && on && song) {
    var u = tiSongUsage(song.id, svc);
    var recent = u && u.weeks <= TI_RECENT_WEEKS;
    var arr = svc.arr[b.k] || '';
    h += '<div style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap; ' + pad + '">' +
      '<div style="flex:1 1 260px; min-width:0; display:flex; flex-direction:column; gap:4px;">' +
        '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">' +
          (tiSongCode(song) ? '<span style="font-size:12px; font-weight:700; background:#F3E9CE; color:#6E2621; padding:2px 7px; border-radius:6px;">' + esc(tiSongCode(song)) + '</span>' : '') +
          '<span style="font-family:\'Bricolage Grotesque\',sans-serif; font-size:17px; font-weight:700; color:#3a2a15;">' + esc(song.title) + '</span>' +
          (recent ? '<span class="ti-pill" style="background:#fdf0e6; color:#a3420e; font-weight:600;">Dipakai ' + esc(tiShort(u.date)) + '</span>' : '') +
        '</div>' +
        (song.credits ? '<span style="font-size:12.5px; color:#8a7952;">' + esc(song.credits) + '</span>' : '') +
        '<div style="display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; margin-top:2px;">' +
          (arr ? '<span style="font-size:12.5px; font-weight:600; color:#6b5a38;">' + esc(arr) + '</span>' : '<span style="font-size:12.5px; font-weight:600; color:#a3420e;">Urutan belum diisi</span>') +
          '<span data-ti="pick" data-k="' + b.k + '" class="ti-link">Ubah urutan</span>' +
        '</div>' +
        (b.cue ? '<span style="font-size:13px; font-style:italic; font-weight:600; color:#31536f; margin-top:2px;">' + esc(b.cue) + '</span>' : '') +
      '</div>' +
      '<button data-ti="pick" data-k="' + b.k + '" class="ti-btn-outline">Ganti lagu</button>' +
    '</div>';
  } else if (isSong && on) {
    h += '<div style="' + pad + '"><button data-ti="pick" data-k="' + b.k + '" style="width:100%; border:1px dashed #E85511; background:#fdf0e6; color:#a3420e; font-size:13.5px; font-weight:700; padding:12px; border-radius:10px; cursor:pointer; text-align:left;">+ Pilih lagu</button></div>';
  } else if (isSong) {
    h += '<span style="' + pad + ' font-size:13px; color:#9a8763; font-weight:600;">Tidak dipakai minggu ini</span>';
  }

  if (b.kind === 'variant') {
    h += '<div style="' + pad + ' display:flex; flex-direction:column; gap:6px; align-items:flex-start;">' +
      '<div class="ti-seg">' + b.opts.map(function (o) {
        return '<button data-ti="variant" data-k="' + b.k + '" data-v="' + esc(o[0]) + '" class="' + (svc.variants[b.k] === o[0] ? 'on' : '') + '">' + esc(o[1]) + '</button>';
      }).join('') + '</div>' +
      '<span style="font-size:12.5px; color:#8a7952;">' + esc(b.notes[svc.variants[b.k]] || '') + '</span>' +
    '</div>';
  }

  if (b.k === 'b17') {
    var ov = tiState.liturgy.offeringVerse || {};
    h += '<span style="' + pad + ' font-size:12.5px; color:#8a7952; line-height:1.5;">Dicetak setelah ajakan: <b>Dasar Persembahan kita adalah ' + esc(ov.ref) + '</b> <i>(' + esc(ov.text) + ')</i></span>';
  }

  if (b.kind === 'auto' || b.kind === 'optional') {
    var theme = tiTheme(svc), main = theme, note = '';
    if (b.k === 'b0') note = tiDateLong(svc.date) + ' · ' + (svc.season || 'masa belum diisi') + ' · ' + (svc.pf || 'PF belum dipilih');
    if (b.k === 'b4') note = 'Nas: ' + (svc.kp || 'belum diisi') + ' · diambil dari detail ibadah';
    if (b.k === 'b12') note = 'Judul khotbah otomatis dari tema · ' + (svc.pf || 'PF belum dipilih');
    if (b.k === 'b15') {
      var nextPk = svc.date ? tiByDate(tiAddDays(svc.date, 7)) : null;
      nextPk = nextPk && nextPk.pk ? nextPk : null;
      main = on ? 'Dipakai minggu ini' : 'Tidak dipakai minggu ini';
      note = nextPk ? 'Minggu depan (' + tiShort(nextPk.date) + ') Perjamuan Kudus' : 'Nyalakan bila Minggu depan Perjamuan Kudus';
    }
    h += '<div style="' + pad + ' display:flex; flex-direction:column; gap:2px;">' +
      '<span style="font-family:\'Bricolage Grotesque\',sans-serif; font-size:16px; font-weight:700; color:' + (on ? '#3a2a15' : '#9a8763') + ';">' + esc(main) + '</span>' +
      '<span style="font-size:12px; color:#8a7952;">' + esc(note) + '</span>' +
    '</div>';
  }

  var inputs = '';
  var area = function (key, label, rows, placeholder) {
    return '<label class="ti-label"><span>' + label + '</span><textarea id="tiF-' + key + '" data-tit="' + key + '" rows="' + rows + '" placeholder="' + esc(placeholder || '') + '" class="ti-field" style="resize:vertical; line-height:1.5; font-family:inherit; font-size:14px;">' + esc(tx[key]) + '</textarea></label>';
  };
  if (b.field) inputs += area(b.field, b.fieldLabel, b.field === 'call' ? 2 : 5, b.field === 'call' ? 'Ajakan singkat liturgos sebelum lagu' : '');
  if (b.reading) {
    inputs += '<label class="ti-label"><span>Bacaan Alkitab (dibacakan PF)</span><input id="tiF-reading" data-tit="reading" value="' + esc(tx.reading) + '" placeholder="mis. Roma 12:1-8" class="ti-field" style="padding:9px 12px; font-size:14px;"></label>';
  }
  if (b.verse) {
    inputs += '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">' +
        '<span style="font-size:12.5px; font-weight:700; color:#8a7952;">Nas</span>' +
        '<select id="tiF-baBook" data-tif="baBook" class="ti-field" style="flex:1 1 170px; width:auto; padding:9px 12px; font-size:14px;">' +
          '<option value="">Pilih kitab</option>' + TI_BOOKS.map(function (bk) { return '<option' + (svc.baBook === bk ? ' selected' : '') + '>' + bk + '</option>'; }).join('') +
        '</select>' +
        '<input data-tif="baCh" type="number" min="1" value="' + esc(svc.baCh) + '" placeholder="Pasal" class="ti-field" style="width:84px; padding:9px 12px; font-size:14px;">' +
        '<span style="color:#8a7952; font-weight:700;">:</span>' +
        '<input data-tif="baVs" value="' + esc(svc.baVs) + '" placeholder="Ayat, mis. 1-2" class="ti-field" style="width:130px; padding:9px 12px; font-size:14px;">' +
        '<span style="font-size:11px; font-weight:700; padding:3px 7px; border:1px solid #e6d8b6; border-radius:6px; color:#8a7952;">TB</span>' +
      '</div>' +
      '<span id="tiBaMsg">' + tiBaMsgHtml() + '</span>' +
      area('baText', 'Teks ayat (dicetak di liturgi)', 3, 'Terisi otomatis dari Alkitab TB setelah nas lengkap') +
      '<span id="tiBaFetch">' + tiBaFetchHtml() + '</span>';
  }

  return {
    style: 'background:' + (on ? '#fff' : '#FEFBF2') + '; border:' + border + '; border-radius:14px; padding:12px 14px 14px;',
    main: h,
    inputs: inputs
  };
}

function tiBlockHtml(b) {
  var p = tiBlockParts(b);
  return '<div data-ring id="tiCard-' + b.k + '" style="' + p.style + '">' +
    '<div id="tiMain-' + b.k + '" style="display:flex; flex-direction:column; gap:10px;">' + p.main + '</div>' +
    (p.inputs ? '<div style="padding-left:34px; display:flex; flex-direction:column; gap:8px; margin-top:10px;">' + p.inputs + '</div>' : '') +
  '</div>';
}

function tiBaFetchHtml() {
  var f = tiState.baFetch, svc = tiState.cur, tx = tiTexts(svc), ref = tiBa(svc);
  if (f.busy) return '<span style="font-size:12px; color:#9a8763;">Mengambil teks ' + esc(ref) + '…</span>';
  if (f.error) return '<span style="font-size:12px; font-weight:600; color:#a3420e;">' + esc(f.error) + '</span> <span data-ti="fetchBa" class="ti-link">Coba lagi</span>';
  if (!ref) return '';
  var stale = tx.baText && tx.baTextRef && tx.baTextRef !== ref;
  return '<span style="font-size:12px; color:' + (stale ? '#a3420e' : '#9a8763') + ';">' +
    (stale ? 'Teks ini untuk ' + esc(tx.baTextRef) + ', bukan ' + esc(ref) + '. ' : tx.baText ? 'Sumber: Alkitab TB (SABDA) · bisa diedit. ' : '') +
    '</span><span data-ti="fetchBa" class="ti-link">' + (tx.baText ? 'Ambil ulang teks' : 'Ambil teks') + '</span>';
}

/* Fills the Berita anugerah verse text from Alkitab TB; force replaces text the user edited. */
function tiFetchBa(force) {
  var svc = tiState.cur, ref = svc && tiBa(svc);
  if (!ref) return;
  var tx = tiTexts(svc);
  if (!force && tx.baText && (tx.baTextRef === ref || !tx.baTextAuto)) { tiRenderBaFetch(); return; }
  tiState.baFetch = { busy: true, error: '' };
  tiRenderBaFetch();
  google.script.run
    .withSuccessHandler(function (res) {
      tiState.baFetch = { busy: false, error: res.success ? '' : res.message };
      if (res.success && tiState.cur === svc && tiBa(svc) === ref) {
        tx.baText = res.text; tx.baTextRef = ref; tx.baTextAuto = true;
        var el = document.getElementById('tiF-baText');
        if (el) el.value = res.text;
        tiRenderAside();
        tiQueueSave();
      }
      tiRenderBaFetch();
    })
    .withFailureHandler(function (err) { tiState.baFetch = { busy: false, error: err && err.message ? err.message : String(err) }; tiRenderBaFetch(); })
    .fetchBibleText(svc.baBook, svc.baCh, String(svc.baVs || '').trim());
}

function tiRenderBaFetch() {
  var el = document.getElementById('tiBaFetch');
  if (el) el.innerHTML = tiBaFetchHtml();
}

/* Banner above the form: an edit conflict, or the Published lock. */
function tiRenderBanner() {
  var el = document.getElementById('tiBanner'), svc = tiState.cur;
  if (!el || !svc) return;
  var box = function (bg, bd, fg, text, buttons) {
    return '<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; background:' + bg + '; border:1px solid ' + bd + '; border-radius:16px; padding:14px 18px; font-size:14px;">' +
      '<span style="line-height:1.5; color:' + fg + ';">' + text + '</span><span style="display:flex; gap:8px; flex-wrap:wrap;">' + buttons + '</span></div>';
  };
  var c = tiState.conflict;
  if (c && c.svc === svc) {
    el.innerHTML = box('#fdf0e6', '#f6cfb3', '#a3420e', '<strong>Tata ibadah ini baru disimpan dari perangkat lain' + (c.latest && c.latest.updatedAt ? '' : '') + '.</strong> Perubahan Anda belum tersimpan.',
      '<button data-ti="conflictLoad" class="ti-btn-outline">Muat versi terbaru</button><button data-ti="conflictForce" class="ti-btn-outline" style="background:#6E2621; color:#fff; border-color:#6E2621;">Simpan versi saya</button>');
  } else if (svc.status === 'Published') {
    el.innerHTML = box('#e3ebdc', '#c5d4b8', '#24401F', '<strong>Sudah diterbitkan.</strong> Terkunci agar tidak berubah tanpa sengaja. Ubah status ke Review untuk mengedit.',
      '<button data-ti="status" data-v="Review" class="ti-btn-outline">Buka kunci (Review)</button>');
  } else el.innerHTML = '';
}

""")

rep("""function tiRenderBlock(k) {
  var el = document.getElementById('tiBlk-' + k);
  if (el) el.innerHTML = tiBlockHtml(TI_BLOCK[k]);
}""", """function tiRenderBlock(k) {
  var card = document.getElementById('tiCard-' + k), main = document.getElementById('tiMain-' + k);
  if (!card || !main) return;
  var p = tiBlockParts(TI_BLOCK[k]);
  card.style.cssText = p.style;
  main.innerHTML = p.main;
}""")

# dynamic render: schedule hint with sync, all blocks, banner
rep("""  var sched = tiScheduleOn(svc.date);
  var hint = document.getElementById('tiSchedHint');
  var schedTheme = sched ? (sched.theme || '') : '';
  var differs = sched && (schedTheme !== tiTheme(svc) || (sched.pastor && sched.pastor !== svc.pf));
  hint.innerHTML = sched ? '<span style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:13px; color:#8a7952; font-weight:600;">Di jadwal: ' + esc(schedTheme || 'tanpa tema') + (sched.pastor ? ' · ' + esc(sched.pastor) : '') +
    (differs ? '<span data-ti="useSchedule" class="ti-link">Pakai dari jadwal</span>' : '') + '</span>' : '';
  TI_BLOCKS.forEach(function (b) { if (b.k !== 'b8' && b.kind !== 'fixed') tiRenderBlock(b.k); });""", """  var sched = tiScheduleOn(svc.date);
  var hint = document.getElementById('tiSchedHint');
  var schedTheme = sched ? (sched.theme || '') : '';
  var differs = sched && (schedTheme !== tiTheme(svc) || (sched.pastor || '') !== (svc.pf || ''));
  var row = function (inner) { return '<span style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:13px; color:#8a7952; font-weight:600;">' + inner + '</span>'; };
  if (sched) {
    hint.innerHTML = row('Di jadwal: ' + esc(schedTheme || 'tanpa tema') + (sched.pastor ? ' · ' + esc(sched.pastor) : '') +
      (differs ? '<span data-ti="useSchedule" class="ti-link">Pakai dari jadwal</span><span data-ti="syncSchedule" class="ti-link">Perbarui jadwal</span>' : ' <span style="color:#24401F;">✓ sama</span>'));
  } else {
    hint.innerHTML = svc.id && svc.date ? row('Belum ada di jadwal <span data-ti="syncSchedule" class="ti-link">Tambahkan ke jadwal</span>') : '';
  }
  TI_BLOCKS.forEach(function (b) { if (b.kind !== 'fixed') tiRenderBlock(b.k); });
  tiRenderBaFetch();
  tiRenderBanner();""")

# ---------- download uses tiAfterSave ----------
rep("""  dl.busy = fmt; dl.error = '';
  tiRenderAside();
  if (tiState.pending) tiFlushSave();
  var go = function () {
    if (tiState.saving || tiState.pending) { setTimeout(go, 300); return; }
    google.script.run""", """  dl.busy = fmt; dl.error = '';
  tiRenderAside();
  tiAfterSave(function () {
    google.script.run""")
rep("""      [fmt === 'gdoc' ? 'createLiturgyDoc' : 'downloadLiturgy'](svc.id, fmt);
  };
  go();
}""", """      [fmt === 'gdoc' ? 'createLiturgyDoc' : 'downloadLiturgy'](svc.id, fmt);
  });
}

/* Copies theme and Pelayan Firman to the Schedule sheet (adds the Sunday if missing). */
function tiSyncSchedule() {
  var svc = tiState.cur;
  tiAfterSave(function () {
    google.script.run
      .withSuccessHandler(function (res) {
        if (!res.success) { flash(res.message); return; }
        tiState.schedule = res.schedule;
        tiRenderDynamic();
        if (typeof fetchSchedule === 'function') fetchSchedule();
        flash(res.message);
      })
      .withFailureHandler(function (err) { flash('Gagal memperbarui jadwal: ' + (err && err.message ? err.message : err)); })
      .syncScheduleFromService(svc.id);
  });
}""")

# ---------- song library ----------
rep("""/* ---------- song picker ---------- */""", r"""/* ---------- song library ---------- */

/* { count, last } of services using a song. */
function tiSongStats(id) {
  var count = 0, last = '';
  tiState.services.forEach(function (s) {
    var used = Object.keys(s.slots || {}).some(function (k) { return s.slots[k] === id; });
    if (used) { count++; if (s.date > last) last = s.date; }
  });
  return { count: count, last: last };
}

function tiLibraryHtml() {
  var html = tiHeader('Tata Ibadah · Pemuda GKI Kota Wisata', 'Perpustakaan lagu',
    '<button data-ti="newSong" class="ti-btn-orange" style="height:44px; padding:0 20px; font-size:15px;">+ Lagu baru</button>');
  html += '<main class="page-pad" style="flex:1; padding:26px 32px 60px;"><div style="max-width:1320px; margin:0 auto; display:flex; flex-direction:column; gap:16px;">';
  if (!tiState.loaded) return html + '<div style="text-align:center; color:#b3a37c; font-size:14px; padding:30px 0;">' + (tiState.loadError ? esc(tiState.loadError) : 'Memuat…') + '</div></div></main>';
  html += '<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">' +
      '<div style="display:flex; align-items:center; gap:8px; background:#fff; border:1px solid #e6d8b6; border-radius:12px; padding:0 14px; height:42px; flex:1 1 260px; max-width:420px;">' +
        '<span style="color:#b3a37c;">⌕</span><input id="tiLibQ" data-tilib="q" value="' + esc(tiState.lib.q) + '" placeholder="Cari judul, nomor atau lirik" style="border:none; outline:none; background:transparent; width:100%; font-size:14px;"></div>' +
      '<div id="tiLibChips" style="display:flex; gap:6px; flex-wrap:wrap;"></div>' +
    '</div>' +
    '<span style="font-size:12.5px; color:#8a7952;">Untuk mengimpor KJ, KK, PKJ atau NKB dari Alkitab SABDA, cari lagu di pemilih lagu pada tata ibadah.</span>' +
    '<div id="tiLibList" style="display:flex; flex-direction:column; gap:8px;"></div>';
  return html + '</div></main>';
}

function tiRenderLibraryList() {
  var list = document.getElementById('tiLibList'), chips = document.getElementById('tiLibChips');
  if (!list) return;
  var L = tiState.lib, q = L.q.trim().toLowerCase();
  var match = function (s, h) {
    if (h === 'Lirik kosong') return !tiHasLyrics(s);
    return h === 'Semua' || (h === 'Kontemporer' ? !s.hymnal : s.hymnal === h);
  };
  var matchQ = function (s) {
    return !q || (tiSongCode(s) + ' ' + s.title + ' ' + s.credits + ' ' + s.sections.map(function (x) { return x.text; }).join(' ')).toLowerCase().indexOf(q) !== -1;
  };
  chips.innerHTML = TI_HYMNALS.concat(['Lirik kosong']).map(function (h) {
    var n = tiState.songs.filter(function (s) { return match(s, h) && matchQ(s); }).length;
    return '<button data-ti="libH" data-v="' + h + '" class="pill-btn' + (L.h === h ? ' on' : '') + '" style="border-radius:20px; padding:6px 11px; font-size:12.5px;">' + h + ' <span style="opacity:.7;">' + n + '</span></button>';
  }).join('');
  var rows = tiState.songs.filter(function (s) { return match(s, L.h) && matchQ(s); })
    .sort(function (a, b) { return (a.hymnal || '~').localeCompare(b.hymnal || '~') || (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0) || a.title.localeCompare(b.title); });
  list.innerHTML = rows.map(function (s) {
    var st = tiSongStats(s.id), lyr = tiHasLyrics(s);
    var merging = L.merge === s.id;
    return '<div class="ti-card" style="border-radius:14px; padding:12px 16px; display:flex; flex-direction:column; gap:10px;">' +
      '<div style="display:grid; grid-template-columns:64px minmax(0,1fr) auto; gap:12px; align-items:center;">' +
        '<span style="font-size:12.5px; font-weight:700; color:#6E2621;">' + esc(tiSongCode(s) || '—') + '</span>' +
        '<span style="display:flex; flex-direction:column; gap:2px; min-width:0;">' +
          '<span style="font-size:15px; font-weight:700; color:#3a2a15;">' + esc(s.title) + '</span>' +
          '<span style="font-size:12px; color:#8a7952; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(s.credits || '—') + '</span>' +
          '<span style="font-size:12px; color:' + (lyr ? '#8a7952' : '#a3420e') + '; font-weight:600;">' + s.sections.length + ' bagian · ' + (lyr ? 'lirik ada' : 'lirik kosong') +
            ' · ' + (st.count ? 'dipakai ' + st.count + '× · terakhir ' + esc(tiShort(st.last)) : 'belum pernah dipakai') + '</span>' +
        '</span>' +
        '<span style="display:flex; gap:6px;">' +
          '<button data-ti="libEdit" data-id="' + esc(s.id) + '" class="ti-btn-outline" style="padding:6px 11px; font-size:12.5px;">Edit</button>' +
          '<button data-ti="libDelete" data-id="' + esc(s.id) + '" class="ti-btn-outline" style="padding:6px 11px; font-size:12.5px; color:' + TI_RED + ';">Hapus</button>' +
        '</span>' +
      '</div>' +
      (merging ? '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; background:#fdf0e6; border-radius:10px; padding:10px 12px;">' +
          '<span style="font-size:13px; color:#a3420e; font-weight:600;">Dipakai di ' + st.count + ' tata ibadah. Ganti dengan:</span>' +
          '<select data-tilib="mergeTo" class="ti-field" style="width:auto; flex:1 1 220px; padding:7px 10px; font-size:13px;"><option value="">Pilih lagu pengganti</option>' +
            tiState.songs.filter(function (o) { return o.id !== s.id; }).sort(function (a, b) { return a.title.localeCompare(b.title); })
              .map(function (o) { return '<option value="' + esc(o.id) + '"' + (L.mergeTo === o.id ? ' selected' : '') + '>' + esc((tiSongCode(o) ? tiSongCode(o) + ' · ' : '') + o.title) + '</option>'; }).join('') +
          '</select>' +
          '<button data-ti="libMerge" data-id="' + esc(s.id) + '" class="ti-btn-outline" style="color:#fff; background:' + TI_RED + '; border-color:' + TI_RED + ';">Gabungkan & hapus</button>' +
          '<button data-ti="libCancel" class="ti-link" style="padding:0 4px;">Batal</button>' +
        '</div>' : '') +
    '</div>';
  }).join('') + (rows.length ? '' : '<div style="text-align:center; color:#b3a37c; font-size:14px; padding:10px 0;">Tidak ada lagu.</div>');
}

function tiDeleteSong(id, replaceWith) {
  google.script.run
    .withSuccessHandler(function (res) {
      if (!res.success) {
        if (res.used) { tiState.lib.merge = id; tiState.lib.mergeTo = ''; tiRenderLibraryList(); }
        flash(res.message);
        return;
      }
      tiState.lib.merge = null;
      flash(res.message);
      tiLoad();
    })
    .withFailureHandler(function (err) { flash('Gagal: ' + (err && err.message ? err.message : err)); })
    .deleteSong(id, replaceWith || '');
}

/* ---------- song picker ---------- */""")

rep("""      tiRenderModal();
      if (tiState.picker) tiSelectSong(res.song.id);
      tiRenderDynamic();""", """      tiRenderModal();
      if (tiState.picker) tiSelectSong(res.song.id);
      tiRenderDynamic();
      if (tiState.screen === 'library') tiRenderLibraryList();""")

# ---------- events ----------
rep("""  switch (a) {
    case 'new': tiNewService(el.getAttribute('data-date')); break;""", """  var editing = { toggle: 1, variant: 1, pick: 1, useSchedule: 1, fetchBa: 1 };
  if (editing[a] && svc && svc.status === 'Published' && tiState.screen === 'builder') { flash('Terkunci: ubah status ke Review untuk mengedit'); return; }

  switch (a) {
    case 'tab': tiState.screen = v; tiState.cur = null; tiRender(); window.scrollTo(0, 0); break;
    case 'libH': tiState.lib.h = v; tiRenderLibraryList(); break;
    case 'libEdit': tiOpenSongForm(tiState.songById[el.getAttribute('data-id')]); break;
    case 'libDelete':
      var sid = el.getAttribute('data-id'), stats = tiSongStats(sid);
      if (stats.count) { tiState.lib.merge = sid; tiState.lib.mergeTo = ''; tiRenderLibraryList(); }
      else if (window.confirm('Hapus “' + tiState.songById[sid].title + '” dari perpustakaan?')) tiDeleteSong(sid);
      break;
    case 'libMerge':
      if (!tiState.lib.mergeTo) { flash('Pilih lagu pengganti dulu'); return; }
      if (window.confirm('Ganti lagu ini dengan “' + tiState.songById[tiState.lib.mergeTo].title + '” di semua tata ibadah, lalu hapus?')) tiDeleteSong(el.getAttribute('data-id'), tiState.lib.mergeTo);
      break;
    case 'libCancel': tiState.lib.merge = null; tiRenderLibraryList(); break;
    case 'syncSchedule': tiSyncSchedule(); break;
    case 'fetchBa': tiFetchBa(true); break;
    case 'conflictLoad':
      var latest = tiState.conflict && tiState.conflict.latest;
      if (latest) Object.keys(latest).forEach(function (key) { svc[key] = latest[key]; });
      tiState.conflict = null; tiState.pending = null;
      tiState.saveLabel = 'Versi terbaru dimuat'; tiState.saveError = false;
      tiRender();
      break;
    case 'conflictForce':
      if (tiState.conflict && tiState.conflict.latest) svc.updatedAt = tiState.conflict.latest.updatedAt;
      tiState.conflict = null; svc.forceSave = true;
      tiRenderBanner(); tiQueueSave();
      break;
    case 'new': tiNewService(el.getAttribute('data-date')); break;""")
rep("""    case 'status':
      if (el.disabled) return;
      svc.status = v; tiRenderAside(); tiQueueSave(); break;""", """    case 'status':
      if (el.disabled) return;
      var was = svc.status;
      svc.status = v;
      if (was === 'Published' || v === 'Published') tiRender(); else tiRenderAside();
      tiQueueSave();
      break;""")
rep("""    if (f === 'date') {
      svc.season = tiSeason(t.value) || svc.season;
      document.getElementById('tiF-season').value = svc.season;
    }
    tiRenderDynamic();
    tiQueueSave();
    return;
  }""", """    if (f === 'date') {
      svc.season = tiSeason(t.value) || svc.season;
      document.getElementById('tiF-season').value = svc.season;
    }
    if (f === 'baBook' || f === 'baCh' || f === 'baVs') {
      tiState.baFetch = { busy: false, error: '' };
      clearTimeout(tiState.baTimer);
      tiState.baTimer = setTimeout(function () { tiFetchBa(false); }, 700);
    }
    tiRenderDynamic();
    tiQueueSave();
    return;
  }
  var tt = t.getAttribute && t.getAttribute('data-tit');
  if (tt && svc) {
    var texts = tiTexts(svc);
    texts[tt] = t.value;
    if (tt === 'baText') { texts.baTextAuto = false; if (!texts.baTextRef) texts.baTextRef = tiBa(svc); tiRenderBaFetch(); }
    tiRenderAside();
    tiQueueSave();
    return;
  }
  var lb = t.getAttribute && t.getAttribute('data-tilib');
  if (lb === 'q') { tiState.lib.q = t.value; tiRenderLibraryList(); return; }
  if (lb === 'mergeTo') { tiState.lib.mergeTo = t.value; return; }""")

open(p, 'w').write(s)
print('builder patched')
