/* ---------- song library ---------- */

var TI_LIB_BOOKS = ['KJ', 'KK', 'PKJ', 'NKB', ''];
var TI_LIB_SORTS = [['number', 'Nomor'], ['title', 'Judul'], ['recent', 'Terakhir dipakai'], ['used', 'Paling sering']];

/* Services using a song: { count, last, uses: [{ date, slots: ['Panggilan beribadah', …] }] } newest first. */
function tiSongStats(id) {
  var uses = [];
  tiState.services.forEach(function (s) {
    var slots = Object.keys(s.slots || {}).filter(function (k) { return s.slots[k] === id && TI_BLOCK[k]; }).map(function (k) { return TI_BLOCK[k].title; });
    if (slots.length) uses.push({ date: s.date, slots: slots });
  });
  uses.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  return { count: uses.length, last: uses.length ? uses[0].date : '', uses: uses };
}

function tiLibraryHtml() {
  var L = tiState.lib;
  var hymnCount = tiState.songs.filter(function (s) { return s.hymnal; }).length;
  var imported = hymnCount >= 1000;
  var importLabel = L.importing ? 'Mengimpor…' : 'Impor semua judul KJ, KK, PKJ, NKB';
  var html = tiHeader('Tata Ibadah · Pemuda GKI Kota Wisata', 'Perpustakaan lagu',
    '<span style="display:flex; gap:8px; align-items:center; position:relative;">' +
      '<button data-ti="newSong" class="ti-btn-orange" style="height:44px; padding:0 20px; font-size:15px;">+ Lagu baru</button>' +
      (imported ? '<button data-ti="libMenu" class="ti-btn-outline" aria-label="Menu lain" style="height:44px; width:44px; padding:0; font-size:18px;">⋯</button>' +
        (L.menu ? '<div style="position:absolute; right:0; top:52px; z-index:20; background:#fff; border:1px solid #ece0c2; border-radius:12px; box-shadow:0 16px 36px rgba(74,59,23,.2); padding:6px; min-width:260px;">' +
          '<button data-ti="libImportAll" class="ti-hover" style="width:100%; text-align:left; padding:10px 12px; border-radius:8px; font-size:13.5px; font-weight:600; color:#3a2a15; cursor:pointer;"' + (L.importing ? ' disabled' : '') + '>' + importLabel + '</button>' +
          '<span style="display:block; padding:0 12px 8px; font-size:12px; color:#8a7952;">Menambah judul yang belum ada. Lagu yang ada tidak diubah.</span>' +
        '</div>' : '') : '') +
    '</span>');
  html += '<main class="page-pad" style="flex:1; padding:22px 32px 60px;"><div style="max-width:1320px; margin:0 auto; display:flex; flex-direction:column; gap:14px;">';
  if (!tiState.loaded) return html + '<div style="text-align:center; color:#b3a37c; font-size:14px; padding:30px 0;">' + (tiState.loadError ? esc(tiState.loadError) : 'Memuat…') + '</div></div></main>';
  if (!imported) {
    html += '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; background:#fff; border:1px solid #ece0c2; border-radius:14px; padding:12px 16px;">' +
      '<span style="font-size:13px; color:#6b5a38; line-height:1.5;">Tambahkan semua judul KJ, KK, PKJ dan NKB dari Alkitab SABDA (±1.790 lagu). Lirik tiap lagu diambil otomatis saat pertama dibuka.</span>' +
      '<button data-ti="libImportAll" class="ti-btn-outline"' + (L.importing ? ' disabled' : '') + '>' + (L.importing ? 'Mengimpor…' : 'Impor semua judul') + '</button></div>';
  }
  html += '<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">' +
      '<div style="display:flex; align-items:center; gap:8px; background:#fff; border:1px solid #e6d8b6; border-radius:12px; padding:0 14px; height:42px; flex:1 1 240px; max-width:380px;">' +
        '<span style="color:#b3a37c;">⌕</span><input id="tiLibQ" data-tilib="q" value="' + esc(L.q) + '" placeholder="Cari judul, nomor atau lirik" autocomplete="off" style="border:none; outline:none; background:transparent; width:100%; font-size:14px;"></div>' +
      '<div id="tiLibChips" style="display:flex; gap:6px; flex-wrap:wrap;"></div>' +
      '<label style="margin-left:auto; display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:700; color:#8a7952;">Urutkan' +
        '<select data-tilib="sort" class="ti-field" style="width:auto; padding:8px 10px; font-size:13px;">' +
          TI_LIB_SORTS.map(function (o) { return '<option value="' + o[0] + '"' + (L.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select></label>' +
    '</div>' +
    '<div class="ti-card" style="border-radius:16px;">' +
      '<div class="ti-lib-row ti-lib-head"><span>No.</span><span>Judul</span><span class="c-credits">Pencipta</span><span>Lirik</span><span class="c-used">Dipakai</span></div>' +
      '<div id="tiLibList"></div>' +
    '</div>' +
    '<div id="tiLibPanel"></div>';
  return html + '</div></main>';
}

/* Songs matching the library's search, book filter and sort. */
function tiLibraryRows() {
  var L = tiState.lib, q = L.q.trim().toLowerCase();
  var num = /^\d+[a-z]?$/.test(q) ? q : '';
  var match = function (s, h) {
    if (h === 'Lirik kosong') return !tiHasLyrics(s);
    return h === 'Semua' || (h === 'Kontemporer' ? !s.hymnal : s.hymnal === h);
  };
  var matchQ = function (s) {
    if (!q) return true;
    if (num) return s.number.toLowerCase().indexOf(num) === 0;
    return (tiSongCode(s) + ' ' + s.title + ' ' + s.credits + ' ' + s.sections.map(function (x) { return x.text; }).join(' ')).toLowerCase().indexOf(q) !== -1;
  };
  var stats = {};
  var stat = function (s) { return stats[s.id] || (stats[s.id] = tiSongStats(s.id)); };
  var byNumber = function (a, b) {
    return TI_LIB_BOOKS.indexOf(a.hymnal) - TI_LIB_BOOKS.indexOf(b.hymnal) ||
      (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0) || a.number.localeCompare(b.number) || a.title.localeCompare(b.title);
  };
  var sorts = {
    number: function (a, b) { return (num ? (a.number.toLowerCase() === num ? 0 : 1) - (b.number.toLowerCase() === num ? 0 : 1) : 0) || byNumber(a, b); },
    title: function (a, b) { return a.title.localeCompare(b.title); },
    recent: function (a, b) { return (stat(b).last || '').localeCompare(stat(a).last || '') || byNumber(a, b); },
    used: function (a, b) { return stat(b).count - stat(a).count || byNumber(a, b); }
  };
  return {
    match: match, matchQ: matchQ, stat: stat,
    rows: tiState.songs.filter(function (s) { return match(s, L.h) && matchQ(s); }).sort(sorts[L.sort] || sorts.number)
  };
}

function tiRenderLibraryList() {
  var list = document.getElementById('tiLibList'), chips = document.getElementById('tiLibChips');
  if (!list) return;
  var L = tiState.lib, r = tiLibraryRows();
  chips.innerHTML = TI_HYMNALS.concat(['Lirik kosong']).map(function (h) {
    var n = tiState.songs.filter(function (s) { return r.match(s, h) && r.matchQ(s); }).length;
    return '<button data-ti="libH" data-v="' + h + '" class="pill-btn' + (L.h === h ? ' on' : '') + '" style="border-radius:20px; padding:6px 11px; font-size:12.5px;">' + h + ' <span style="opacity:.7;">' + n + '</span></button>';
  }).join('');

  var shown = r.rows.slice(0, L.limit), group = null, html = '';
  shown.forEach(function (s) {
    if (L.sort === 'number' && s.hymnal !== group) {
      group = s.hymnal;
      var total = r.rows.filter(function (x) { return x.hymnal === group; }).length;
      html += '<div class="ti-lib-group">' + (group || 'Kontemporer') + ' <span style="font-weight:600; color:#9a8763;">· ' + total + ' lagu</span></div>';
    }
    var st = r.stat(s), lyr = tiHasLyrics(s);
    html += '<div data-ti="libOpen" data-id="' + esc(s.id) + '" class="ti-lib-row' + (L.sel === s.id ? ' on' : '') + '">' +
      '<span style="font-weight:700; color:#6E2621; font-variant-numeric:tabular-nums;">' + esc(s.hymnal ? s.hymnal + ' ' + s.number : '—') + '</span>' +
      '<span style="font-weight:700; color:#3a2a15; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(s.title) + '</span>' +
      '<span class="c-credits" style="color:#8a7952; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + esc(s.credits) + '">' + esc(s.credits || '—') + '</span>' +
      '<span>' + (lyr ? '<span class="ti-badge" style="background:#e3ebdc; color:#24401F;">Lirik ✓</span>'
        : '<span class="ti-badge" style="background:#F3E9CE; color:#8a7952;">' + (s.hymnal ? 'Belum diambil' : 'Kosong') + '</span>') + '</span>' +
      '<span class="c-used" style="color:' + (st.count ? '#6b5a38' : '#c0ad82') + '; font-weight:600;">' + (st.count ? st.count + '× · ' + esc(tiShort(st.last)) : '—') + '</span>' +
    '</div>';
  });
  if (!shown.length) html = '<div style="text-align:center; color:#b3a37c; font-size:14px; padding:22px 0;">Tidak ada lagu.</div>';
  if (r.rows.length > shown.length) {
    html += '<div style="display:flex; justify-content:center; align-items:center; gap:12px; padding:14px; border-top:1px solid #f4ecd8;">' +
      '<span style="font-size:12.5px; color:#9a8763;">' + shown.length + ' dari ' + r.rows.length + ' lagu</span>' +
      '<button data-ti="libMore" class="ti-btn-outline">Tampilkan lebih banyak</button></div>';
  }
  list.innerHTML = html;
}

/* Side panel for the selected song: lyrics, order, usage and actions. */
function tiRenderLibPanel() {
  var host = document.getElementById('tiLibPanel');
  if (!host) return;
  var L = tiState.lib, s = tiState.songById[L.sel];
  if (!s) { host.innerHTML = ''; return; }
  var st = tiSongStats(s.id), f = L.fetch && L.fetch.id === s.id ? L.fetch : null;
  var body;
  if (f && f.busy) {
    body = '<span style="font-size:13.5px; color:#8a7952; font-weight:600;">Mengambil lirik dari Alkitab SABDA…</span>';
  } else if (f && f.variants) {
    body = '<span style="font-size:13.5px; color:#3a2a15; font-weight:600;">' + esc(tiSongCode(s)) + ' punya ' + f.variants.length + ' versi. Pilih yang ditambahkan:</span>' +
      f.variants.map(function (v) {
        return '<button data-ti="libVariant" data-n="' + esc(v.number) + '" class="ti-hover" style="text-align:left; cursor:pointer; display:grid; grid-template-columns:64px minmax(0,1fr); gap:10px; align-items:center; padding:9px 10px; border-radius:11px; border:1px solid #ece0c2; background:#fff;">' +
          '<span style="font-size:12px; font-weight:700; color:#E85511;">' + esc(s.hymnal + ' ' + v.number) + '</span>' +
          '<span style="display:flex; flex-direction:column; min-width:0;"><span style="font-size:13.5px; color:#3a2a15;">' + esc(v.preview) + '</span>' +
          (v.credits ? '<span style="font-size:12px; color:#8a7952;">' + esc(v.credits) + '</span>' : '') + '</span></button>';
      }).join('');
  } else if (!tiHasLyrics(s)) {
    body = (f && f.error ? '<span style="font-size:13px; font-weight:600; color:' + TI_RED + ';">' + esc(f.error) + '</span>' : '<span style="font-size:13.5px; color:#8a7952;">Lirik belum ada.</span>') +
      (s.hymnal ? '<button data-ti="libFetch" data-id="' + esc(s.id) + '" class="ti-btn-outline" style="align-self:flex-start;">Ambil lirik</button>' : '');
  } else {
    body = (s.arr ? '<div style="display:flex; flex-direction:column; gap:3px;"><span class="ti-eyebrow">Urutan default</span><span style="font-size:13px; font-weight:600; color:#6b5a38;">' + esc(s.arr) + '</span></div>' : '') +
      s.sections.map(function (sec) {
        return '<div style="display:flex; flex-direction:column; gap:3px;"><span style="font-size:12px; font-weight:800; color:#E85511; letter-spacing:.04em;">' + esc(sec.label) + '</span>' +
          '<span style="font-size:14.5px; line-height:1.6; color:' + (sec.text ? '#3a2a15' : '#b3a37c') + '; white-space:pre-line;">' + esc(sec.text || 'Lirik belum diisi') + '</span></div>';
      }).join('');
  }
  var merging = L.merge === s.id;
  host.innerHTML = '<aside class="ti-lib-panel">' +
    '<div style="flex-shrink:0; background:#F3E9CE; border-bottom:1px solid #e7d9b3; padding:18px 22px 16px; display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">' +
      '<div style="display:flex; flex-direction:column; gap:3px; min-width:0;">' +
        '<span class="ti-eyebrow">' + esc(s.hymnal ? s.hymnal + ' ' + s.number : 'Kontemporer') + (s.language ? ' · ' + esc(s.language) : '') + '</span>' +
        '<h2 style="margin:0; font-weight:800; font-size:22px; letter-spacing:-.02em; line-height:1.2;">' + esc(s.title) + '</h2>' +
        (s.credits ? '<span style="font-size:12.5px; color:#8a7952; line-height:1.45;">' + esc(s.credits) + '</span>' : '') +
      '</div>' +
      '<button data-ti="libClose" class="icon-btn" aria-label="Tutup" style="width:36px; height:36px; border-radius:11px; background:rgba(58,42,21,.08); font-size:17px; cursor:pointer; flex-shrink:0;">✕</button>' +
    '</div>' +
    '<div style="flex:1; overflow-y:auto; padding:18px 22px 24px; display:flex; flex-direction:column; gap:16px;">' + body +
      '<div style="display:flex; flex-direction:column; gap:6px; border-top:1px solid #f1e7cd; padding-top:14px;">' +
        '<span class="ti-eyebrow">Dipakai</span>' +
        (st.uses.length ? st.uses.slice(0, 8).map(function (u) {
          return '<span style="font-size:13px; color:#3a2a15;"><b>' + esc(tiShort(u.date)) + ' ' + u.date.slice(0, 4) + '</b> · ' + esc(u.slots.join(', ')) + '</span>';
        }).join('') + (st.uses.length > 8 ? '<span style="font-size:12px; color:#9a8763;">dan ' + (st.uses.length - 8) + ' lagi</span>' : '')
          : '<span style="font-size:13px; color:#9a8763;">Belum pernah dipakai</span>') +
      '</div>' +
    '</div>' +
    '<div style="flex-shrink:0; border-top:1px solid #e7d9b3; background:#F3E9CE; padding:12px 22px; display:flex; flex-direction:column; gap:10px;">' +
      (merging ? '<div style="display:flex; flex-direction:column; gap:8px;">' +
          '<span style="font-size:13px; color:#a3420e; font-weight:600;">Dipakai di ' + st.count + ' tata ibadah. Ganti dengan:</span>' +
          '<select data-tilib="mergeTo" class="ti-field" style="padding:8px 10px; font-size:13px;"><option value="">Pilih lagu pengganti</option>' +
            tiState.songs.filter(function (o) { return o.id !== s.id; }).sort(function (a, b) { return a.title.localeCompare(b.title); })
              .map(function (o) { return '<option value="' + esc(o.id) + '"' + (L.mergeTo === o.id ? ' selected' : '') + '>' + esc((tiSongCode(o) ? tiSongCode(o) + ' · ' : '') + o.title) + '</option>'; }).join('') +
          '</select>' +
          '<span style="display:flex; gap:8px;"><button data-ti="libMerge" data-id="' + esc(s.id) + '" class="ti-btn-outline" style="color:#fff; background:' + TI_RED + '; border-color:' + TI_RED + ';">Gabungkan & hapus</button>' +
          '<button data-ti="libCancel" class="ti-btn-outline">Batal</button></span></div>'
        : '<span style="display:flex; gap:8px;">' +
            '<button data-ti="libEdit" data-id="' + esc(s.id) + '" class="ti-btn-orange" style="flex:1; padding:10px 14px; font-size:14px;">Edit lagu</button>' +
            '<button data-ti="libDelete" data-id="' + esc(s.id) + '" class="ti-btn-outline" style="color:' + TI_RED + ';">Hapus</button>' +
          '</span>') +
    '</div>' +
  '</aside>';
}

function tiLibOpen(id) {
  var L = tiState.lib, s = tiState.songById[id];
  L.sel = id; L.merge = null;
  if (s && s.hymnal && !tiHasLyrics(s) && !(L.fetch && L.fetch.id === id && (L.fetch.busy || L.fetch.variants))) tiLibFetchLyrics(id);
  tiRenderLibraryList();
  tiRenderLibPanel();
}

function tiImportAllTitles() {
  if (!window.confirm('Tambahkan semua judul KJ, KK, PKJ dan NKB ke perpustakaan? Lagu yang sudah ada tidak diubah.')) return;
  tiState.lib.importing = true;
  tiState.lib.menu = false;
  tiRender();
  google.script.run
    .withSuccessHandler(function (res) {
      tiState.lib.importing = false;
      var a = res.added || {};
      flash(res.total ? res.total + ' lagu ditambahkan (KJ ' + (a.KJ || 0) + ', KK ' + (a.KK || 0) + ', PKJ ' + (a.PKJ || 0) + ', NKB ' + (a.NKB || 0) + ')' : 'Semua judul sudah ada di perpustakaan');
      tiLoad();
    })
    .withFailureHandler(function (err) { tiState.lib.importing = false; tiRender(); flash('Impor gagal: ' + (err && err.message ? err.message : err)); })
    .importHymnalIndex();
}

/* Fetches a hymn's lyrics into the library; number may name one version ("767h"), which becomes its own song. */
function tiLibFetchLyrics(id, number) {
  var L = tiState.lib, song = tiState.songById[id];
  if (!song) return;
  L.fetch = { id: id, busy: true, error: '', variants: null };
  tiRenderLibPanel();
  google.script.run
    .withSuccessHandler(function (res) {
      if (res.variants) L.fetch = { id: id, busy: false, error: '', variants: res.variants };
      else if (!res.success) L.fetch = { id: id, busy: false, error: res.message, variants: null };
      else {
        L.fetch = null;
        tiSetSongs(tiState.songs.filter(function (s) { return s.id !== res.song.id; }).concat([res.song]));
        if (L.sel === id) L.sel = res.song.id;
      }
      tiRenderLibraryList();
      tiRenderLibPanel();
    })
    .withFailureHandler(function (err) {
      L.fetch = { id: id, busy: false, error: err && err.message ? err.message : String(err), variants: null };
      tiRenderLibPanel();
    })
    .importHymnalSong(song.hymnal, number || song.number);
}

function tiDeleteSong(id, replaceWith) {
  google.script.run
    .withSuccessHandler(function (res) {
      if (!res.success) {
        if (res.used) { tiState.lib.merge = id; tiState.lib.mergeTo = ''; tiRenderLibPanel(); }
        flash(res.message);
        return;
      }
      tiState.lib.merge = null;
      tiState.lib.sel = null;
      flash(res.message);
      tiLoad();
    })
    .withFailureHandler(function (err) { flash('Gagal: ' + (err && err.message ? err.message : err)); })
    .deleteSong(id, replaceWith || '');
}

