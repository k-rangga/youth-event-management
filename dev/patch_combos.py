"""One searchable dropdown (Tanggal, Seri, Pelayan Firman, Kitab, Lagu pengganti); one chevron style for every select; "Untitled event" is no theme."""
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(name):
    return open(os.path.join(root, name)).read()


def save(name, s):
    open(os.path.join(root, name), 'w').write(s)


def rep(s, old, new, n=1):
    assert s.count(old) == n, (s.count(old), old[:90])
    return s.replace(old, new)


def cut(s, start, end, new):
    i = s.index(start)
    j = s.index(end, i) + len(end)
    return s[:i] + new + s[j:]


CHEV = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a7952' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")"

COMBO = r'''/* ---------- searchable dropdowns ---------- */

/* Event input rows can carry "Untitled event" as their theme: treat it as no theme. */
function tiThemeOf(e) {
  var t = String(e && e.theme || '').trim();
  return /^untitled(\s+event)?$/i.test(t) ? '' : t;
}

function tiDayLabel(d) { return d ? tiShort(d) + ' ' + d.slice(0, 4) : ''; }

/* Values used before (series or PF), newest first, leaving out the open service's own. */
function tiRecent(fromSvc, fromEvent) {
  var last = {}, cur = tiState.cur;
  var add = function (v, date) { v = String(v || '').trim(); if (v && !(last[v] >= date)) last[v] = date || ''; };
  tiState.services.forEach(function (s) { if (s !== cur) add(fromSvc(s), s.date); });
  tiState.schedule.forEach(function (e) { if (tiIsService(e) && !(cur && e.date === cur.date)) add(fromEvent(e), e.date); });
  return Object.keys(last).sort(function (a, b) { return last[a] < last[b] ? 1 : last[a] > last[b] ? -1 : a.localeCompare(b); })
    .map(function (v) { return { v: v, label: v, sub: tiDayLabel(last[v]) }; });
}

/*
 * What each dropdown lists and does. Items are { v, label, sub, disabled, keep };
 * "free" dropdowns keep whatever is typed (a new series or name), the others
 * only take a listed item and show its text again when left.
 */
function tiComboSpec(k) {
  var svc = tiState.cur, L = tiState.lib;
  if (k === 'date') {
    var sched = tiScheduleOn(svc.date);
    return {
      ph: 'Cari tanggal atau tema', value: svc.date,
      text: svc.date ? tiDayLabel(svc.date) + (sched && tiThemeOf(sched) ? ' · ' + tiThemeOf(sched) : '') : '',
      options: function () {
        var evs = tiServiceEvents(svc), items = [];
        if (svc.date && !evs.some(function (e) { return e.date === svc.date; })) items.push({ v: svc.date, label: tiDayLabel(svc.date), sub: 'belum di jadwal', keep: true });
        evs.forEach(function (e) {
          var taken = tiByDate(e.date, svc);
          items.push({ v: e.date, label: tiDayLabel(e.date), sub: (tiThemeOf(e) || 'tanpa tema') + (taken ? ' · sudah ada' : ''), disabled: !!taken });
        });
        return items.concat([{ v: '__free', label: 'Tanggal lain…', keep: true }]);
      },
      pick: function (v) {
        if (v === '__free') { tiState.dateFree = true; tiRenderDateField(); return; }
        svc.date = v;
        tiTakeSchedule(svc);
      }
    };
  }
  if (k === 'series' || k === 'pf') {
    return {
      free: true, value: svc[k], text: svc[k] || '',
      ph: k === 'series' ? 'Cari atau tulis seri' : 'Cari atau tulis nama PF', fresh: k === 'series' ? 'Seri baru' : 'Nama baru',
      options: function () {
        return k === 'series'
          ? tiRecent(function (s) { return s.series; }, function (e) { var t = tiThemeOf(e); return t.indexOf(':') !== -1 ? t.split(':')[0] : ''; })
          : tiRecent(function (s) { return s.pf; }, function (e) { return e.pastor; });
      },
      pick: function (v) { svc[k] = v; }
    };
  }
  if (k === 'mergeTo') {
    var into = tiState.songById[L.mergeTo];
    return {
      ph: 'Cari lagu pengganti', value: L.mergeTo, text: into ? (tiSongCode(into) ? tiSongCode(into) + ' · ' : '') + into.title : '',
      options: function () {
        return tiState.songs.filter(function (o) { return o.id !== L.merge; }).sort(function (a, b) { return a.title.localeCompare(b.title); })
          .map(function (o) { return { v: o.id, label: o.title, sub: tiSongCode(o) || 'Kontemporer' }; });
      },
      pick: function (v) { L.mergeTo = v; }
    };
  }
  return { // kpBook, baBook, ofBook
    ph: 'Cari kitab', value: svc[k], text: svc[k] || '',
    options: function () { return TI_BOOKS.map(function (b) { return { v: b, label: b }; }); },
    pick: function (v) { svc[k] = v; tiVerseChanged(k.slice(0, 2)); }
  };
}

function tiComboHtml(k, wrapStyle, inputStyle) {
  var sp = tiComboSpec(k);
  return '<div style="position:relative; min-width:0; ' + (wrapStyle || '') + '">' +
    '<input id="tiF-' + k + '" data-ticombo="' + k + '"' + (sp.free ? ' data-tif="' + k + '"' : '') + ' class="ti-field ti-combo-input" autocomplete="off" spellcheck="false" value="' + esc(sp.text) + '" placeholder="' + esc(sp.ph) + '" style="' + (inputStyle || '') + '">' +
    '<span data-ti="comboToggle" data-k="' + k + '" class="ti-chev">' + icon('down', 16) + '</span>' +
    '<div id="tiCombo-' + k + '" class="ti-combo" hidden></div>' +
  '</div>';
}

function tiComboItems(c) {
  var sp = tiComboSpec(c.k), all = sp.options(), q = tiNorm(c.q), toks = q ? q.split(' ') : [];
  var match = function (o) { var h = tiNorm(o.label + ' ' + (o.sub || '')); return toks.every(function (t) { return h.indexOf(t) !== -1; }); };
  if (!sp.free) return q ? all.filter(function (o) { return o.keep || match(o); }) : all;
  var exact = all.some(function (o) { return tiNorm(o.v) === q; });
  var items = exact || !q ? all : all.filter(match);
  return q && !exact ? [{ v: c.q.trim(), label: sp.fresh + ': “' + c.q.trim() + '”' }].concat(items) : items;
}

function tiRenderCombo() {
  var c = tiState.combo, box = c && document.getElementById('tiCombo-' + c.k);
  if (!box) return;
  c.items = tiComboItems(c);
  c.hi = Math.max(0, Math.min(c.hi, c.items.length - 1));
  box.hidden = false;
  box.innerHTML = c.items.length ? c.items.map(function (o, i) {
    return '<div class="ti-combo-opt' + (i === c.hi ? ' on' : '') + (o.disabled ? ' dis' : '') + (o.v === c.value ? ' cur' : '') + '" data-ticopt="' + i + '">' +
      '<span class="ti-combo-l">' + esc(o.label) + '</span>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</div>';
  }).join('') : '<div class="ti-combo-empty">Tidak ditemukan</div>';
  var on = box.querySelector('.on');
  if (on && on.offsetTop < box.scrollTop) box.scrollTop = on.offsetTop;
  else if (on && on.offsetTop + on.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = on.offsetTop + on.offsetHeight - box.clientHeight;
}

function tiComboOpen(k) {
  var sp = tiComboSpec(k), inp = document.getElementById('tiF-' + k);
  tiState.combo = { k: k, q: sp.free && inp ? inp.value : '', value: sp.value, hi: 0 };
  var items = tiComboItems(tiState.combo);
  items.forEach(function (o, i) { if (o.v === sp.value) tiState.combo.hi = i; });
  if (!sp.free && inp) inp.select();
  tiRenderCombo();
}

function tiComboClose() {
  var c = tiState.combo;
  tiState.combo = null;
  if (!c) return;
  var box = document.getElementById('tiCombo-' + c.k), inp = document.getElementById('tiF-' + c.k), sp = tiComboSpec(c.k);
  if (box) box.hidden = true;
  if (inp && !sp.free) inp.value = sp.text;
}

function tiComboPick(i) {
  var c = tiState.combo, o = c && c.items && c.items[i];
  if (!o || o.disabled) return;
  tiComboSpec(c.k).pick(o.v);
  tiComboClose();
  var inp = document.getElementById('tiF-' + c.k);
  if (inp) inp.value = tiComboSpec(c.k).text;
  if (c.k !== 'mergeTo' && tiState.cur) { tiRenderDynamic(); tiQueueSave(); }
}

/* Moves the highlight, skipping items that cannot be picked. */
function tiComboMove(dir) {
  var c = tiState.combo, n = c.items.length, i = c.hi;
  for (var step = 0; step < n; step++) {
    i = Math.max(0, Math.min(n - 1, i + dir));
    if (!c.items[i].disabled) { c.hi = i; break; }
  }
  tiRenderCombo();
}

function tiComboKey(e, k) {
  var c = tiState.combo;
  if (!c || c.k !== k) { if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); tiComboOpen(k); } return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); tiComboMove(e.key === 'ArrowDown' ? 1 : -1); }
  else if (e.key === 'Enter') { e.preventDefault(); if (c.items.length) tiComboPick(c.hi); else tiComboClose(); }
  else if (e.key === 'Escape') { e.preventDefault(); tiComboClose(); }
  else if (e.key === 'Tab') tiComboClose();
}

/* Options and the chevron act on mousedown so the input keeps focus. */
function tiOnMouseDown(e) {
  var opt = e.target.closest && e.target.closest('[data-ticopt]');
  if (opt) { e.preventDefault(); tiComboPick(Number(opt.getAttribute('data-ticopt'))); return; }
  var tog = e.target.closest && e.target.closest('[data-ti=comboToggle]');
  if (!tog) return;
  e.preventDefault();
  var k = tog.getAttribute('data-k'), inp = document.getElementById('tiF-' + k);
  if (!inp || inp.matches(':disabled')) return;
  if (tiState.combo && tiState.combo.k === k) tiComboClose();
  else if (document.activeElement === inp) tiComboOpen(k);
  else inp.focus();
}
'''

s = load('TataIbadahView.html')

# css: one chevron for native selects and dropdowns
s = rep(s, "  .ti-combo { position: absolute; left: 0; right: 0; top: 100%;",
        "  select.ti-field, .ti-select { -webkit-appearance: none; appearance: none; background: #fff " + CHEV + " no-repeat right 14px center / 16px 16px; padding-right: 42px !important; cursor: pointer; }\n"
        "  .ti-combo-input { padding-right: 42px !important; text-overflow: ellipsis; }\n"
        "  .ti-chev { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); display: flex; color: #8a7952; cursor: pointer; }\n"
        "  .ti-combo { position: absolute; left: 0; min-width: 100%; width: max-content; max-width: min(480px, calc(100vw - 32px)); top: 100%;")
s = rep(s, "  .ti-combo-opt { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 9px 10px; border-radius: 8px; cursor: pointer; font-size: 14px; color: #3a2a15; }\n"
           "  .ti-combo-opt.on { background: #F3E9CE; }\n"
           "  .ti-combo-opt small { color: #8a7952; font-size: 12px; white-space: nowrap; }\n",
        "  .ti-combo-opt { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; padding: 9px 10px; border-radius: 8px; cursor: pointer; font-size: 14px; color: #3a2a15; }\n"
        "  .ti-combo-opt.on { background: #F3E9CE; }\n"
        "  .ti-combo-opt.cur .ti-combo-l { font-weight: 700; color: #6E2621; }\n"
        "  .ti-combo-opt.dis { opacity: .45; cursor: default; }\n"
        "  .ti-combo-l { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n"
        "  .ti-combo-opt small { min-width: 0; color: #8a7952; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n"
        "  .ti-combo-empty { padding: 10px; font-size: 13px; color: #9a8763; }\n")

# old seri-only dropdown → shared one
s = cut(s, "/* Seri: a searchable list of the series already used", "  else inp.focus();\n}\n", COMBO.rstrip('\n') + "\n")

# date field: dropdown instead of the native select
i = s.index("    var listed = evs.some(function (e) { return e.date === svc.date; });\n    input = '<select id=\"tiF-date\"")
j = s.index("    '</select>';\n  }\n", i) + len("    '</select>';\n")
s = s[:i] + "    input = tiComboHtml('date');\n" + s[j:]
s = rep(s, "  var evs = tiServiceEvents(svc), input;\n  var day = function (d) { return tiShort(d) + ' ' + d.slice(0, 4); };\n", "  var evs = tiServiceEvents(svc), input;\n")
s = rep(s, "  if (!sched || !(String(sched.theme || '').trim() || sched.pastor)) return;", "  if (!sched || !(tiThemeOf(sched) || sched.pastor)) return;")
s = rep(s, "function tiApplySchedule(svc, sched) {\n  var theme = String(sched.theme || '').trim();", "function tiApplySchedule(svc, sched) {\n  var theme = tiThemeOf(sched);")
s = rep(s, "esc(sched.theme || 'tanpa tema')", "esc(tiThemeOf(sched) || 'tanpa tema')", 2)

# details card: Seri and Pelayan Firman
i = s.index("      '<div class=\"ti-label\" style=\"position:relative;\"><span>Seri</span><div style=\"position:relative;\">' +\n")
j = s.index("        '<div id=\"tiCombo-series\" class=\"ti-combo\" hidden></div></div></div>' +\n", i) + len("        '<div id=\"tiCombo-series\" class=\"ti-combo\" hidden></div></div></div>' +\n")
s = s[:i] + "      '<div class=\"ti-label\"><span>Seri</span>' + tiComboHtml('series') + '</div>' +\n" + s[j:]
s = rep(s, "      field('pf', 'Pelayan Firman', 'list=\"tiPfList\" placeholder=\"Nama PF\"') +\n", "      '<div class=\"ti-label\"><span>Pelayan Firman</span>' + tiComboHtml('pf') + '</div>' +\n")
s = rep(s, "    tiDatalist('tiPfList', tiState.services.map(function (s) { return s.pf; }).concat(tiState.schedule.map(function (e) { return e.pastor; }))) +\n", "")
s = cut(s, "function tiDatalist(id, values) {", "</datalist>';\n}\n\n", "")

# verse book picker
i = s.index("      '<select id=\"tiF-' + p + 'Book\"")
j = s.index("      '</select>' +\n", i) + len("      '</select>' +\n")
s = s[:i] + "      tiComboHtml(p + 'Book', 'flex:1 1 170px;', sm) +\n" + s[j:]

# lagu pengganti
i = s.index("          '<select data-tilib=\"mergeTo\"")
j = s.index("          '</select>' +\n", i) + len("          '</select>' +\n")
s = s[:i] + "          tiComboHtml('mergeTo', '', 'padding:8px 12px; font-size:13px;') +\n" + s[j:]
s = rep(s, "  if (lb === 'mergeTo') { tiState.lib.mergeTo = t.value; return; }\n", "")

# month filter: shared chevron
s = rep(s, "'<select data-tisel=\"monthF\" style=\"padding:10px 34px 10px 14px; border:1px solid #e6d8b6; border-radius:11px; background:#fff; font-size:13.5px; font-weight:700; color:#6E2621; -webkit-appearance:none; appearance:none; background-image:linear-gradient(45deg, transparent 50%, #8a7952 50%), linear-gradient(135deg, #8a7952 50%, transparent 50%); background-position:calc(100% - 17px) 50%, calc(100% - 12px) 50%; background-size:5px 5px; background-repeat:no-repeat;\">'",
        "'<select data-tisel=\"monthF\" class=\"ti-select\" style=\"padding:10px 14px; border:1px solid #e6d8b6; border-radius:11px; font-size:13.5px; font-weight:700; color:#6E2621;\">'")

# input / keys / focus wiring
s = rep(s, "    if (f === 'series' && tiState.combo) { tiState.combo.hi = 0; tiRenderCombo(); }\n",
        "    if (tiState.combo && tiState.combo.k === f) { tiState.combo.q = t.value; tiState.combo.hi = 0; tiRenderCombo(); }\n")
s = rep(s, "  var f = t.getAttribute && t.getAttribute('data-tif');\n  if (f && svc) {\n",
        "  var f = t.getAttribute && t.getAttribute('data-tif');\n"
        "  var ck = !f && t.getAttribute && t.getAttribute('data-ticombo');\n"
        "  if (ck) { if (tiState.combo && tiState.combo.k === ck) { tiState.combo.q = t.value; tiState.combo.hi = 0; tiRenderCombo(); } return; }\n"
        "  if (f && svc) {\n")
s = rep(s, "  if (e.target.getAttribute && e.target.getAttribute('data-ticombo')) { tiComboKey(e); return; }",
        "  var ck = e.target.getAttribute && e.target.getAttribute('data-ticombo');\n  if (ck) { tiComboKey(e, ck); return; }")
s = rep(s, "document.addEventListener('focusin', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-ticombo')) tiComboOpen(); });",
        "document.addEventListener('focusin', function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-ticombo'); if (k) tiComboOpen(k); });")
s = rep(s, "var TI_PLACEHOLDER = /(x\\s*:\\s*x-x|\\bTEMA\\b|\\.{4,}|…{2,}|lirik lagu)/i;",
        "var TI_PLACEHOLDER = /(x\\s*:\\s*x-x|\\bTEMA\\b|\\.{4,}|…{2,}|lirik lagu|^untitled(\\s+event)?$)/i;")
for w in ('tiSeriesOptions', 'tiDatalist', 'tiPfList', '<select data-tilib="mergeTo"', 'tiComboOpen()'):
    assert w not in s, w
save('TataIbadahView.html', s)

t = load('TataIbadah.js')
t = rep(t, "/* The reverse of themeOf_. */\nfunction splitTheme_(theme) {\n  theme = String(theme || '').trim();",
        "/* Event input rows can carry \"Untitled event\" as their theme: treat it as no theme. */\n"
        "function cleanTheme_(theme) {\n  theme = String(theme || '').trim();\n  return /^untitled(\\s+event)?$/i.test(theme) ? '' : theme;\n}\n\n"
        "/* The reverse of themeOf_. */\nfunction splitTheme_(theme) {\n  theme = cleanTheme_(theme);")
t = rep(t, "    var t = ev.theme.trim() ? splitTheme_(ev.theme) :", "    var t = cleanTheme_(ev.theme) ? splitTheme_(ev.theme) :")
save('TataIbadah.js', t)
print('ok')
