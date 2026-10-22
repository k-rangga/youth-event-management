"""One-off patch for TataIbadahView.html: bulk hymnal title import and lyrics fetched on first use."""
import sys
p = sys.argv[1]
s = open(p).read()


def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:80], s.count(a))
    s = s.replace(a, b)


TI_LIST_CAP = """var TI_RECENT_WEEKS = 4;
var TI_LIST_CAP = 80;      // rows drawn at once in the picker and library; narrow with search for more"""
rep("var TI_RECENT_WEEKS = 4;", TI_LIST_CAP)

# ---------- picker: fetch lyrics when a song without them is selected ----------
rep("""  pk.chipSel = null; pk.addMenu = false; pk.secOpen = {}; pk.secEdit = {};
  tiRenderPickerParts();
}""", """  pk.chipSel = null; pk.addMenu = false; pk.secOpen = {}; pk.secEdit = {};
  if (song.hymnal && !tiHasLyrics(song) && !(pk.fetch && pk.fetch.id === id && (pk.fetch.busy || pk.fetch.variants))) tiFetchLyrics(id);
  tiRenderPickerParts();
}

/*
 * Fetches a hymn's lyrics from the online hymnal into its library entry
 * (titles imported in bulk start without them). number may name one version
 * ("767h") of a number that has several.
 */
function tiFetchLyrics(id, number) {
  var pk = tiState.picker, song = tiState.songById[id];
  if (!pk || !song) return;
  pk.fetch = { id: id, busy: true, error: '', variants: null };
  tiRenderPickerParts();
  google.script.run
    .withSuccessHandler(function (res) {
      if (tiState.picker !== pk) return;
      if (res.variants) { pk.fetch = { id: id, busy: false, error: '', variants: res.variants }; tiRenderPickerParts(); return; }
      if (!res.success) { pk.fetch = { id: id, busy: false, error: res.message, variants: null }; tiRenderPickerParts(); return; }
      pk.fetch = null;
      tiSetSongs(tiState.songs.filter(function (s) { return s.id !== res.song.id; }).concat([res.song]));
      tiSelectSong(res.song.id);
    })
    .withFailureHandler(function (err) {
      if (tiState.picker !== pk) return;
      pk.fetch = { id: id, busy: false, error: err && err.message ? err.message : String(err), variants: null };
      tiRenderPickerParts();
    })
    .importHymnalSong(song.hymnal, number || song.number);
}

/* Picker detail while a song's lyrics are being fetched, or its versions chosen; '' otherwise. */
function tiFetchDetailHtml(song) {
  var f = tiState.picker.fetch;
  if (!f || f.id !== song.id) return '';
  var head = '<div style="display:flex; flex-direction:column; gap:4px;"><span style="font-size:12px; font-weight:700; color:#8a7952;">' + esc(tiSongCode(song)) + '</span>' +
    '<span style="font-family:\\'Bricolage Grotesque\\',sans-serif; font-size:24px; font-weight:800; line-height:1.2; color:#3a2a15;">' + esc(song.title) + '</span></div>';
  if (f.busy) return head + '<span style="font-size:13.5px; color:#8a7952; font-weight:600;">Mengambil lirik dari Alkitab SABDA…</span>';
  if (f.variants) {
    return head + '<span style="font-size:13.5px; color:#3a2a15; font-weight:600;">' + esc(tiSongCode(song)) + ' punya ' + f.variants.length + ' versi. Pilih yang dipakai:</span>' +
      '<div style="display:flex; flex-direction:column; gap:6px;">' + f.variants.map(function (v) {
        return '<button data-ti="pickVariant" data-n="' + esc(v.number) + '" class="ti-hover" style="text-align:left; cursor:pointer; display:grid; grid-template-columns:64px minmax(0,1fr); gap:10px; align-items:center; padding:9px 10px; border-radius:11px; border:1px solid #ece0c2; background:#fff;">' +
          '<span style="font-size:12px; font-weight:700; color:#E85511;">' + esc(song.hymnal + ' ' + v.number) + '</span>' +
          '<span style="display:flex; flex-direction:column; min-width:0;"><span style="font-size:13.5px; color:#3a2a15;">' + esc(v.preview) + '</span>' +
            (v.credits ? '<span style="font-size:12px; color:#8a7952;">' + esc(v.credits) + '</span>' : '') + '</span></button>';
      }).join('') + '</div>';
  }
  if (f.error) return head + '<span style="font-size:13px; font-weight:600; color:' + TI_RED + ';">' + esc(f.error) + '</span> <span data-ti="retryLyrics" class="ti-link">Coba lagi</span>';
  return '';
}""")

rep("""  document.getElementById('tiPkResults').innerHTML = m.results.map(function (s) {""",
    """  document.getElementById('tiPkResults').innerHTML = m.results.slice(0, TI_LIST_CAP).map(function (s) {""")
rep("""    '</button>';
  }).join('') + (m.results.length ? '' : '<span style="font-size:13px; color:#9a8763; padding:10px;">Lagu tidak ditemukan.</span>');""",
    """    '</button>';
  }).join('') + (m.results.length ? '' : '<span style="font-size:13px; color:#9a8763; padding:10px;">Lagu tidak ditemukan.</span>') +
    (m.results.length > TI_LIST_CAP ? '<span style="font-size:12px; color:#9a8763; padding:6px 10px;">' + (m.results.length - TI_LIST_CAP) + ' lagu lagi. Ketik judul atau nomor untuk mempersempit.</span>' : '');""")
rep("""  if (!song) {
    detail.innerHTML = '<span style="font-size:13.5px; color:#8a7952; font-weight:600;">Pilih lagu di kiri untuk melihat urutan dan liriknya.</span>';
  } else {
    var defSeq""", """  var fetchHtml = song ? tiFetchDetailHtml(song) : '';
  if (!song) {
    detail.innerHTML = '<span style="font-size:13.5px; color:#8a7952; font-weight:600;">Pilih lagu di kiri untuk melihat urutan dan liriknya.</span>';
  } else if (fetchHtml) {
    detail.innerHTML = fetchHtml;
  } else {
    var defSeq""")

# ---------- checks: chosen hymn still without lyrics ----------
rep("""  songBlocks.forEach(function (b) {
    if (svc.slots[b.k] && !svc.arr[b.k]) ambers.push(""", """  songBlocks.forEach(function (b) {
    var song = tiState.songById[svc.slots[b.k]];
    if (song && !tiHasLyrics(song)) ambers.push({ text: 'Lirik ' + song.title + ' belum ada', sub: 'Buka pemilih lagu untuk mengambil lirik', to: 'tiBlk-' + b.k });
  });
  songBlocks.forEach(function (b) {
    if (svc.slots[b.k] && !svc.arr[b.k]) ambers.push(""")

# ---------- library: import all, fetch per song, cap ----------
rep("""    '<span style="font-size:12.5px; color:#8a7952;">Untuk mengimpor KJ, KK, PKJ atau NKB dari Alkitab SABDA, cari lagu di pemilih lagu pada tata ibadah.</span>' +""",
    """    '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; background:#fff; border:1px solid #ece0c2; border-radius:14px; padding:12px 16px;">' +
      '<span style="font-size:13px; color:#6b5a38; line-height:1.5;">Tambahkan semua judul KJ, KK, PKJ dan NKB dari Alkitab SABDA (±1.790 lagu). Lirik tiap lagu diambil otomatis saat pertama dipakai.</span>' +
      '<button data-ti="libImportAll" class="ti-btn-outline"' + (tiState.lib.importing ? ' disabled' : '') + '>' + (tiState.lib.importing ? 'Mengimpor…' : 'Impor semua judul') + '</button>' +
    '</div>' +""")
rep("""  var rows = tiState.songs.filter(function (s) { return match(s, L.h) && matchQ(s); })""",
    """  var all = tiState.songs.filter(function (s) { return match(s, L.h) && matchQ(s); })""")
rep("""        (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0) || a.title.localeCompare(b.title);
    });
  list.innerHTML = rows.map(function (s) {""", """        (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0) || a.title.localeCompare(b.title);
    });
  var rows = all.slice(0, TI_LIST_CAP);
  list.innerHTML = rows.map(function (s) {""")
rep("""          '<span style="font-size:12px; color:' + (lyr ? '#8a7952' : '#a3420e') + '; font-weight:600;">' + s.sections.length + ' bagian · ' + (lyr ? 'lirik ada' : 'lirik kosong') +""",
    """          '<span style="font-size:12px; color:' + (lyr ? '#8a7952' : '#a3420e') + '; font-weight:600;">' + (lyr ? s.sections.length + ' bagian · lirik ada' : s.hymnal ? 'lirik diambil saat dipakai' : 'lirik kosong') +""")
rep("""          '<button data-ti="libEdit" data-id="' + esc(s.id) + '" class="ti-btn-outline" style="padding:6px 11px; font-size:12.5px;">Edit</button>' +""",
    """          (!lyr && s.hymnal ? '<button data-ti="libFetch" data-id="' + esc(s.id) + '" class="ti-btn-outline" style="padding:6px 11px; font-size:12.5px;"' + (L.fetching === s.id ? ' disabled' : '') + '>' + (L.fetching === s.id ? 'Mengambil…' : 'Ambil lirik') + '</button>' : '') +
          '<button data-ti="libEdit" data-id="' + esc(s.id) + '" class="ti-btn-outline" style="padding:6px 11px; font-size:12.5px;">Edit</button>' +""")
rep("""  }).join('') + (rows.length ? '' : '<div style="text-align:center; color:#b3a37c; font-size:14px; padding:10px 0;">Tidak ada lagu.</div>');
}""", """  }).join('') + (rows.length ? '' : '<div style="text-align:center; color:#b3a37c; font-size:14px; padding:10px 0;">Tidak ada lagu.</div>') +
    (all.length > rows.length ? '<div style="text-align:center; color:#9a8763; font-size:13px; padding:6px 0;">Menampilkan ' + rows.length + ' dari ' + all.length + ' lagu. Cari judul atau nomor untuk mempersempit.</div>' : '');
}

function tiImportAllTitles() {
  if (!window.confirm('Tambahkan semua judul KJ, KK, PKJ dan NKB ke perpustakaan? Lagu yang sudah ada tidak diubah.')) return;
  tiState.lib.importing = true;
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

function tiLibFetchLyrics(id) {
  var song = tiState.songById[id];
  tiState.lib.fetching = id;
  tiRenderLibraryList();
  google.script.run
    .withSuccessHandler(function (res) {
      tiState.lib.fetching = null;
      if (res.variants) flash(tiSongCode(song) + ' punya ' + res.variants.length + ' versi. Pilih versinya di pemilih lagu.');
      else if (!res.success) flash(res.message);
      else { tiSetSongs(tiState.songs.filter(function (s) { return s.id !== res.song.id; }).concat([res.song])); flash('Lirik ' + res.song.title + ' diambil'); }
      tiRenderLibraryList();
    })
    .withFailureHandler(function (err) { tiState.lib.fetching = null; tiRenderLibraryList(); flash('Gagal: ' + (err && err.message ? err.message : err)); })
    .importHymnalSong(song.hymnal, song.number);
}""")

# ---------- events ----------
rep("""    case 'libCancel': tiState.lib.merge = null; tiRenderLibraryList(); break;""",
    """    case 'libCancel': tiState.lib.merge = null; tiRenderLibraryList(); break;
    case 'libImportAll': tiImportAllTitles(); break;
    case 'libFetch': tiLibFetchLyrics(el.getAttribute('data-id')); break;
    case 'pickVariant': tiFetchLyrics(pk.fetch.id, el.getAttribute('data-n')); break;
    case 'retryLyrics': tiFetchLyrics(pk.fetch.id); break;""")

open(p, 'w').write(s)
print('lazy lyrics patched')
