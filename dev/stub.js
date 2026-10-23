(function () {
  var db = {
    services: [
      { id: '1', date: '2026-10-18', season: 'Bulan Keluarga', series: 'Glorious Purpose', sub: 'Hands of The Body', pf: 'Pdt. Yohanes Adi Wibowo', kp: '1 Korintus 12:12', baBook: 'Yesaya', baCh: '43', baVs: '1-2', pk: false, status: 'Published',
        slots: { b2: 'kj3', b5: 'waymaker', b7: 'kj337', b10: 'buildmylife', b18: 'goodness', b20: 'kj392' }, arr: { b2: 'Bait 1 → Bait 2', b5: 'Bait 1 → Chorus', b7: 'Bait 1 → Ref', b10: 'Bait 1 → Chorus', b18: 'Bait 1 → Chorus', b20: 'Bait 1 → Ref' },
        variants: { b8: 'B', b9: '2×', b11: '767h', b21: '768b' }, enabled: { b15: false, b22: false }, lyrics: {} },
      { id: '2', date: '2026-11-01', season: 'Masa Biasa', series: 'Glorious Purpose', sub: 'One Table', pf: 'Tpg. Siska', kp: '', baBook: '', baCh: '', baVs: '', pk: true, status: 'Draft', slots: {}, arr: {}, variants: { b8: 'A', b9: '1×', b11: '767h', b21: '768b' }, enabled: { b15: false, b22: false }, lyrics: {} }
    ],
    songs: [
      ['kj3','KJ','3','Kami Puji dengan Riang','Henry van Dyke',['Bait 1','Bait 2','Bait 3'],'Bait 1 → Bait 2 → Bait 3'],
      ['kj392','KJ','392',"'Ku Berbahagia",'Fanny J. Crosby',['Bait 1','Ref','Bait 2'],'Bait 1 → Ref → Bait 2 → Ref'],
      ['kj337','KJ','337','Betapa Kita Tidak Bersyukur','Tradisional',['Bait 1','Ref','Bait 2'],'Bait 1 → Ref → Bait 2 → Ref'],
      ['goodness','','','Goodness of God','Ed Cash, Ben Fielding',['Bait 1','Chorus','Bridge'],'Bait 1 → Chorus → Bridge → Chorus'],
      ['waymaker','','','Way Maker','Sinach',['Bait 1','Chorus','Tag'],'Bait 1 → Chorus → Tag'],
      ['buildmylife','','','Build My Life','Pat Barrett',['Bait 1','Chorus','Bridge'],'Bait 1 → Chorus → Bridge → Chorus']
    ].map(function (s) { return { id: s[0], hymnal: s[1], number: s[2], title: s[3], credits: s[4], language: 'Indonesia', sections: s[5].map(function (l) { return { label: l, text: l === 'Bait 1' ? 'Baris pertama ' + s[3] + '\nBaris kedua' : '' }; }), arr: s[6] }; }),
    schedule: [{ date: '2026-10-25', theme: 'Glorious Purpose: Soul of The Calling', pastor: 'Tpg. Siska', tag: 'Service' }, { date: '2026-10-24', theme: 'Rapat', pastor: '', tag: 'Meeting' }]
  };
  window.__db = db; window.__calls = [];
  /* Simulates another device saving service id. */
  window.__bump = function (id, field, value) { var s = db.services.filter(function (x) { return x.id === id; })[0]; s[field] = value; db.stamp = (db.stamp || 0) + 1; s.updatedAt = 'T' + db.stamp; };
  var api = {
    getSchedule: function () { return db.schedule.map(function (e, i) { return { id: String(i + 1), date: e.date, theme: e.theme, pastor: e.pastor, tag: e.tag, notes: '', pic: [], timeStart: '', timeEnd: '' }; }); },
    getMemberPool: function () { return []; },
    saveEvent: function (p) {
      var ev = db.schedule.filter(function (e, i) { return String(i + 1) === String(p.id); })[0];
      if (ev) { ev.date = p.date; ev.theme = p.theme; ev.pastor = p.pastor; ev.tag = p.tag; }
      var svc = db.services.filter(function (s) { return s.date === p.date; })[0], t = null;
      if (svc && ev && ['Meeting', 'Fellowship', 'OFF'].indexOf(p.tag) === -1) {
        var i = p.theme.indexOf(':'); svc.series = i === -1 ? '' : p.theme.slice(0, i).trim(); svc.sub = i === -1 ? p.theme : p.theme.slice(i + 1).trim();
        svc.pf = p.pastor || svc.pf; db.stamp = (db.stamp || 0) + 1; svc.updatedAt = 'T' + db.stamp; t = { id: svc.id, changed: true };
      }
      return { success: true, message: 'Event updated', id: p.id, tataIbadah: t };
    },
    getTataIbadahData: function () { return JSON.parse(JSON.stringify({ services: db.services, songs: db.songs, schedule: db.schedule, liturgy: getLiturgyText_() })); },
    fetchBibleText: function (book, ch, vs) { db.bibleCalls = (db.bibleCalls || 0) + 1; return book === 'Mazmur' ? { success: true, ref: book + ' ' + ch + ':' + vs, text: 'Selidikilah aku, ya Allah, dan kenallah hatiku (' + vs + ').' } : { success: false, message: 'Teks Alkitab tidak bisa diambil sekarang.' }; },
    deleteSong: function (id, rep) { var used = db.services.filter(function (s) { return Object.keys(s.slots).some(function (k) { return s.slots[k] === id; }); });
      if (used.length && !rep) return { success: false, used: used.length, message: 'Lagu dipakai di ' + used.length + ' tata ibadah. Pilih lagu pengganti dulu.' };
      used.forEach(function (s) { Object.keys(s.slots).forEach(function (k) { if (s.slots[k] === id) s.slots[k] = rep; }); });
      db.songs = db.songs.filter(function (s) { return s.id !== id; }); return { success: true, message: used.length ? 'Lagu digabungkan' : 'Lagu dihapus' }; },
    saveTataIbadah: function (p) {
      var clash = db.services.filter(function (s) { return s.date === p.date && s.id !== p.id; })[0];
      if (clash) return { success: false, message: 'Sudah ada tata ibadah untuk tanggal ' + p.date + '.' };
      var cur = p.id && db.services.filter(function (s) { return s.id === p.id; })[0];
      if (cur && !p.force && p.baseUpdatedAt && cur.updatedAt && cur.updatedAt !== p.baseUpdatedAt) return { success: false, conflict: true, message: 'conflict', latest: JSON.parse(JSON.stringify(cur)) };
      db.stamp = (db.stamp || 0) + 1;
      var copy = JSON.parse(JSON.stringify(p));
      copy.updatedAt = 'T' + db.stamp; delete copy.baseUpdatedAt; delete copy.force;
      if (p.id) { db.services = db.services.map(function (s) { return s.id === p.id ? copy : s; }); }
      else { copy.id = String(db.services.reduce(function (m, s) { return Math.max(m, Number(s.id)); }, 0) + 1); db.services.push(copy); }
      var theme = copy.sub ? (copy.series ? copy.series + ': ' + copy.sub : copy.sub) : '';
      var ev = db.schedule.filter(function (e) { return e.date === copy.date && ['Meeting', 'Fellowship', 'OFF'].indexOf(e.tag) === -1; })[0], changed = false;
      if (ev) { var nt = theme || ev.theme, np = copy.pf || ev.pastor; changed = nt !== ev.theme || np !== ev.pastor; ev.theme = nt; ev.pastor = np; }
      else if (theme) { ev = { id: 's' + db.schedule.length, date: copy.date, theme: theme, pastor: copy.pf || '', tag: 'Service' }; db.schedule.push(ev); changed = true; }
      return { success: true, id: copy.id, savedAt: '14.32', updatedAt: copy.updatedAt, schedule: ev ? JSON.parse(JSON.stringify(ev)) : null, scheduleChanged: changed };
    },
    deleteTataIbadah: function (id) { db.services = db.services.filter(function (s) { return s.id !== id; }); return { success: true, message: 'Tata ibadah dihapus' }; },
    updateLiturgyDoc: function (id) { var s = db.services.filter(function (x) { return x.id === id; })[0]; if (!s || !s.doc) return { success: false, message: 'Belum ada Google Doc. Buat dulu.' }; s.doc.updatedAt = '22 Okt, 16.50'; db.updates = (db.updates || 0) + 1; return { success: true, message: 'Google Doc diperbarui', doc: s.doc }; },
    createLiturgyDoc: function (id) { var d = { id: 'G1', url: 'https://docs.google.com/document/d/G1', at: '22 Okt, 00.06' }; db.services.forEach(function (s) { if (s.id === id) s.doc = d; }); return { success: true, message: 'Google Doc dibuat di Drive › Tata Ibadah', doc: d }; },
    downloadLiturgy: function (id, fmt) { db.dl = (db.dl || []).concat([id + ':' + fmt]); return { success: true, filename: 'Liturgi Pemuda 18 Oktober 2026.' + fmt, mimeType: fmt === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', base64: btoa('%PDF-1.4 test') }; },
    getLiturgyTemplate: function () { return db.template || null; },
    uploadLiturgyTemplate: function (b64, name) { db.template = { id: 'T1', name: 'Template Liturgi Pemuda', url: 'https://docs.google.com/document/d/T1' }; db.uploadLen = b64.length; return { success: true, message: 'Template liturgi diunggah', template: db.template }; },
    setLiturgyTemplateFromUrl: function (u) { db.template = { id: 'T2', name: 'Template dari link', url: u }; return { success: true, message: 'Template liturgi dipasang', template: db.template }; },
    generateLiturgy: function (id) { db.genCalls = (db.genCalls || 0) + 1; var svc = db.services.filter(function (s) { return s.id === id; })[0]; return { success: true, message: 'Google Doc dan PDF dibuat', output: { docId: 'D', docUrl: 'https://docs.google.com/document/d/D', pdfId: 'P', pdfUrl: 'https://drive.google.com/file/d/P', docAt: '21 Okt, 23.55', pdfAt: '21 Okt, 23.55', savedDate: svc && svc.date } }; },
    exportLiturgyPdf: function () { return { success: true, message: 'PDF diperbarui dari Google Doc', output: { docId: 'D', docUrl: 'https://docs.google.com/document/d/D', pdfId: 'P2', pdfUrl: 'https://drive.google.com/file/d/P2', docAt: '21 Okt, 23.55', pdfAt: '21 Okt, 23.58' } }; },
    searchHymnalOnline: function (q, h) {
      var idx = [['KJ','392',"'Ku Berbahagia"],['KK','767','Haleluya'],['PKJ','3','Ajaib Namanya'],['KJ','3','Kami Puji dengan Riang']];
      q = q.toLowerCase();
      return { success: true, results: idx.filter(function (r) { return (!h || r[0] === h) && ((r[0] + ' ' + r[1]).toLowerCase().indexOf(q) !== -1 || r[2].toLowerCase().indexOf(q) !== -1 || r[1] === q); })
        .map(function (r) { return { hymnal: r[0], number: r[1], title: r[2], songId: '' }; }) };
    },
    importHymnalIndex: function () {
      var have = {}; db.songs.forEach(function (s) { if (s.hymnal) have[s.hymnal + '|' + s.number] = 1; });
      var added = { KJ: 0, KK: 0, PKJ: 0, NKB: 0 }, total = 0;
      [['KJ', 120], ['KK', 90], ['PKJ', 40], ['NKB', 30]].forEach(function (b) {
        for (var i = 1; i <= b[1]; i++) { if (have[b[0] + '|' + i]) continue; db.songs.push({ id: (b[0] + i).toLowerCase(), hymnal: b[0], number: String(i), title: b[0] + ' lagu ' + i, credits: '', language: 'Indonesia', sections: [], arr: '' }); added[b[0]]++; total++; }
      });
      if (!have['KK|767']) { db.songs.push({ id: 'kk767', hymnal: 'KK', number: '767', title: 'Haleluya', credits: '', language: 'Indonesia', sections: [], arr: '' }); added.KK++; total++; }
      return { success: true, added: added, total: total };
    },
    importHymnalSong: function (h, n) {
      if (h === 'KK' && n === '767') return { success: false, message: 'KK 767 punya beberapa versi.', variants: [{ number: '767a', preview: 'Haleluya, Haleluya, Haleluya.', credits: 'Syair: Tradisional · Lagu: Medan' }, { number: '767h', preview: 'Haleluya, Haleluya, Haleluya.', credits: 'Syair: Tradisional · Lagu: Dari Zambia' }] };
      var song = { id: (h + n).toLowerCase(), hymnal: h, number: n, title: h === 'KK' ? 'Haleluya' : h === 'PKJ' ? 'Ajaib Namanya' : "'Ku Berbahagia", credits: 'Syair: X', language: 'Indonesia', sections: [{ label: 'Bait 1', text: 'Baris satu\nBaris dua' }, { label: 'Ref', text: 'Ref satu' }], arr: 'Bait 1 → Ref' };
      db.songs = db.songs.filter(function (s) { return s.id !== song.id; }).concat([song]);
      return { success: true, message: 'Lagu ditambahkan ke perpustakaan', song: song };
    },
    saveSong: function (p) { var song = JSON.parse(JSON.stringify(p)); song.id = song.id || song.title.toLowerCase().replace(/[^a-z0-9]+/g, ''); db.songs = db.songs.filter(function (s) { return s.id !== song.id; }).concat([song]); return { success: true, message: 'Lagu ditambahkan ke perpustakaan', song: song }; }
  };
  function runner(ok, fail) {
    var r = { withSuccessHandler: function (f) { return runner(f, fail); }, withFailureHandler: function (f) { return runner(ok, f); } };
    Object.keys(api).forEach(function (name) {
      r[name] = function () { var args = arguments; window.__calls.push(name); setTimeout(function () { try { var res = api[name].apply(null, args); ok && ok(res); } catch (e) { console.error(e); fail && fail(e); } }, 150); };
    });
    return r;
  }
  window.google = { script: { run: runner(), history: { replace: function () {} }, url: { getLocation: function (cb) { cb({ hash: location.hash.slice(1) }); } } } };
})();
