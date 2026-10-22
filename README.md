# Event input + Tata Ibadah (Apps Script)

Google Apps Script web app for Pemuda GKI Kota Wisata: the service schedule ("Event input") and the
Tata Ibadah builder (liturgy, song library, PDF/.docx/Google Doc output).

- Script: `1CoKlQ5YfYiBYf7ZScsVkUbySP1wxYyX2iNcEK_g8lCOntcKBYMZqgdB6` (see `.clasp.json`)
- Spreadsheet: set in `Code.js` (`SPREADSHEET_ID`); Tata Ibadah uses the `TataIbadah` and `Songs` sheets.
- `clasp push` uploads only the top-level `.js`/`.html` files and `appsscript.json` (`.claspignore`).
  clasp must be logged in with the account that owns the script.

## Files
- `Code.js` – web app entry, Schedule sheet API
- `TataIbadah.js` – services, songs, online hymnal (alkitab.mobi) and Bible text
- `Liturgi.js`, `LiturgiText.js`, `LiturgiAssets.js` – liturgy booklet generator, its fixed text and images
- `Index.html` – app shell, navigation, Event input UI
- `TataIbadahView.html` – Tata Ibadah UI (list, builder, song picker, library)

## Local testing (`dev/`)
`python3 dev/build_harness.py` then `python3 -m http.server 8765 --directory dev` and open
`http://localhost:8765/#tata-ibadah`. `dev/stub.js` fakes the server with in-memory data.
`node dev/grid_test.js . preview.html` renders the liturgy layout to `dev/preview.html`;
`node dev/server_test.js . all` runs the server code against fake sheets (Bible fetch hits alkitab.mobi);
`node dev/pagenum_test.js` checks the page-number .docx edit.
