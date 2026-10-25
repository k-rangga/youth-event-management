/*
 * Liturgy wording shared by the Tata Ibadah builder (shown on fixed blocks)
 * and the booklet generator, so what is checked on screen is what prints.
 *
 * Each fixed block is a list of entries:
 *   ['say', who, text]   speaker line ("L", "U", "Pnt", "PF"); who '' continues
 *   ['note', text]       centred instruction (blue italic)
 *   ['p', text]          centred plain line
 *   ['steps', [text…]]   bulleted list
 *   ['line', text]       left-aligned line
 *   ['image', key, width]
 *   ['posture', text]    right-aligned "(duduk)" between elements
 * Inline marks in text: *bold*, _italic_, ~blue italic~, ^blue^.
 */

var LITURGI_FIXED = {
  b1: [
    ['steps', [
      'PNJ, liturgos, pemusik, usher, Penatua, dan PF sudah siap di posisi masing-masing.',
      '~10 menit sebelum kebaktian: Multimedia menampilkan video loop.~',
      '~5 menit sebelum kebaktian: Multimedia menampilkan slide tema.~',
      '~15 menit sebelumnya, multimedia menampilkan slide pengumuman dan pengurus menyampaikan pengumuman (jika ada.)~',
      'Saat Teduh, liturgos memimpin saat teduh',
      '~Instrumentalia lagu tanpa judul (multimedia menampilkan slide saat teduh.)~',
      'Ibadah dimulai _tepat pk 09.40_'
    ]],
    ['line', '*^Pengumuman:^* ^Pengurus menyampaikan pengumuman^']
  ],
  b3: [
    ['say', 'L', 'Rekan pemuda terkasih, saat ini kita boleh hadir di rumah Tuhan hanya oleh karena pertolongan Tuhan Sang Pencipta langit dan bumi, yang kasih setia-Nya sampai selama-lamanya.'],
    ['say', 'U', '(menyanyikan) ♫ AMIN  (Aprijaya Rumahorbo, 2023)'],
    ['image', 'amin', 275],
    ['say', 'L', 'Tuhan besertamu!'],
    ['say', 'U', 'Dan besertamu juga!']
  ],
  b13: [
    ['say', '', '~instrumentalia lagu tanpa judul (optional) selama 15 detik~']
  ],
  b14: [
    ['say', 'Pnt', 'Bersama dengan Gereja di segala abad dan tempat, berdasarkan pada pengakuan baptisan kita, marilah kita mengakui iman kita dengan mengikrarkan Pengakuan Iman Rasuli ~(Catatan utk Pnt: ingat dengan sikap sempurna).~'],
    ['say', 'U', 'Aku percaya …. Amin.'],
    ['note', 'Multimedia menayangkan slide:'],
    ['p', '*^PENGAKUAN IMAN RASULI^*'],
    ['posture', 'duduk']
  ],
  b16: [
    ['p', '(PF menaikkan pokok-pokok doa syafaat diakhiri dengan *_Doa Bapa Kami._* ~Durasi: maks. 3 menit~)']
  ],
  b19: [
    ['say', 'Pnt', '……….'],
    ['say', 'L', '~(menyampaikan kesimpulan khotbah / kesan pesan dari khotbah hari ini.)~'],
    ['posture', 'berdiri']
  ],
  b23: [
    ['line', '*^Pengumuman:^* ^Pengurus menyampaikan pengumuman^'],
    ['line', '^Multimedia menayangkan:^'],
    ['steps', ['~Saat teduh.~', '~Slide pengumuman tambahan.~']]
  ]
};

/* Wording the liturgist changes each week; a new service starts from the previous one, or from these. */
var LITURGI_DEFAULT_TEXTS = {
  call: 'Teman-teman pemuda...',
  confession: 'Teman-teman pemuda sekalian, kalau kita jujur, masa-masa dewasa muda ini penuh tekanan—baik dari kuliah, pekerjaan, relasi, maupun kekhawatiran soal masa depan. Sering kali kita terjebak dalam kecemasan, iri melihat pencapaian orang lain, atau mengandalkan kekuatan sendiri, bahkan mengabaikan Tuhan karena kesibukan kita. Hari ini, Tuhan tidak meminta kita untuk pura-pura sempurna. Mari kita ambil waktu sejenak untuk jujur dan merendahkan diri di hadapan-Nya.',
  offering: 'Mari kita mempersiapkan hati untuk memberi. Persembahan adalah ungkapan syukur kita atas anugerah yang Tuhan curahkan sepanjang minggu ini. Sebagai generasi penerus gereja, kiranya melalui persembahan ini, kita belajar untuk menjadi pribadi yang murah hati dan terus mengandalkan Tuhan dalam setiap rencana masa depan kita.',
  reading: ''
};

/* Nas persembahan for a new service with no previous one to carry it from, and for services saved before it was per service. */
var LITURGI_OFFERING_VERSE = {
  ref: 'Mazmur 116:12-14',
  text: 'Bagaimanakah akan kubalas kepada TUHAN segala kebajikan-Nya kepadaku? Aku akan mengangkat piala keselamatan, dan akan menyerukan nama TUHAN, akan membayar nazarku kepada TUHAN di depan seluruh umat-Nya.'
};

function getLiturgyText_() {
  return { fixed: LITURGI_FIXED, defaults: LITURGI_DEFAULT_TEXTS, offeringVerse: LITURGI_OFFERING_VERSE };
}
