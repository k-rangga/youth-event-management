const p = require('./parse_lyrics.js');
const cases = {
  headed: `Verse 1
Baris a satu
Baris a dua

Reff:
Baris reff satu
Baris reff dua

Verse 2
Baris b satu

Reff

Bridge (2x)
Baris bridge`,
  plain: `Baris a satu
Baris a dua

Baris reff satu
Baris reff dua

Baris b satu
Baris b dua

Baris reff satu
Baris reff dua`,
  chordpro: `{title: Lagu Contoh}
{artist: Penulis Contoh}
{c: Verse 1}
[G]Baris a [D]satu
[Em]Baris a [C]dua
{soc}
[G]Baris chorus
{eoc}
{c: Chorus}`,
  songselect: `Lagu Contoh Dua

Verse 1
Baris a satu

Chorus
Baris chorus x2

Verse 2
Baris b satu

Chorus 2
Baris chorus beda

CCLI Song # 1234567
Penulis A | Penulis B
© 2010 Penerbit Contoh
For use solely with the SongSelect® Terms of Use.
CCLI License # 999`,
  numbered: `1. Baris satu bait satu
baris dua bait satu
Reff: Baris reff
baris reff dua
2. Baris satu bait dua`,
  brackets: `[Intro]
[Verse 1]
Satu
[Pre-Chorus]
Pra
[Chorus]
Kor
[Chorus]
x2`
};
for (const [k, v] of Object.entries(cases)) { const r = p(v); console.log(`== ${k}: title="${r.title}" credits="${r.credits}"\n   arr: ${r.arr}\n   sections: ${r.sections.map(s => s.label + '=' + JSON.stringify(s.text)).join(' ; ')}`); }
