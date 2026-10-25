"""One-off patch: system font stack, SVG icons instead of text glyphs, toolbar/calendar spacing."""
import re

ROOT = '/Users/kalakarangga/Code/event-input-app/'

# Same paths as ICONS in Index.html, for markup that is static HTML.
PATHS = {
    'left': '<polyline points="15 18 9 12 15 6"/>',
    'right': '<polyline points="9 18 15 12 9 6"/>',
    'search': '<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/>',
    'x': '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'calendar': '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="3.5" y1="10.5" x2="20.5" y2="10.5"/>',
    'cross': '<line x1="12" y1="3" x2="12" y2="21"/><line x1="6.5" y1="8.5" x2="17.5" y2="8.5"/>',
}


def svg(name, size):
    return ('<svg width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block; flex-shrink:0;">%s</svg>') % (size, size, PATHS[name])


def patch(path, pairs):
    s = open(ROOT + path).read()
    for a, b, *n in pairs:
        count = n[0] if n else 1
        assert s.count(a) == count, (path, a[:80], s.count(a))
        s = s.replace(a, b)
    open(ROOT + path, 'w').write(s)


SYSTEM = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif'

patch('Index.html', [
    # ---------- fonts ----------
    ('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">\n'
     '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Plus+Jakarta+Sans:wght@400..800&display=swap">\n', ''),
    ("  body { margin: 0; background: #FBF6E7; color: #3a2a15; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-font-smoothing: antialiased; }\n"
     "  h1, h2 { font-family: 'Bricolage Grotesque', sans-serif; }\n",
     "  /* System UI font: the platform's own reading font (SF, Segoe UI, Roboto), nothing to download */\n"
     "  body { margin: 0; background: #FBF6E7; color: #3a2a15; font-family: " + SYSTEM + "; font-size: 15px; line-height: 1.45; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }\n"
     "  h1, h2 { letter-spacing: -.02em; }\n"
     "  .tnum { font-variant-numeric: tabular-nums; }\n"),
    ("  .icon-btn:hover { background: #F3E9CE; }\n",
     "  .icon-btn { display: inline-flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }\n"
     "  .icon-btn:hover { background: #F3E9CE; }\n"
     "  /* Toolbar controls share one height */\n"
     "  .tb-ctl { height: 40px; display: inline-flex; align-items: center; gap: 8px; padding: 0 14px; border: 1px solid #e6d8b6; border-radius: 11px; background: #fff; font-size: 13.5px; font-weight: 700; color: #6E2621; cursor: pointer; white-space: nowrap; line-height: 1; }\n"
     "  .tb-group { height: 40px; display: inline-flex; align-items: center; gap: 2px; padding: 3px; border: 1px solid #e6d8b6; border-radius: 11px; background: #fff; }\n"
     "  .tb-group > button { height: 32px; }\n"),
    ("font-family:'Bricolage Grotesque',sans-serif; ", "", 2),
    # ---------- static icons ----------
    ('<span class="nav-ico">▦</span>Event input', '<span class="nav-ico">' + svg('calendar', 17) + '</span>Event input', 2),
    ('<span class="nav-ico">✝</span>Tata Ibadah', '<span class="nav-ico">' + svg('cross', 17) + '</span>Tata Ibadah', 2),
    ('<span style="color:#b3a37c; font-size:14px;">⌕</span>', '<span style="color:#b3a37c;">' + svg('search', 16) + '</span>'),
    ('font-size:17px; cursor:pointer;">✕</button>\n', 'cursor:pointer;">' + svg('x', 18) + '</button>\n'),
    # ---------- toolbar ----------
    ("""  html += '<div style="display:flex; gap:3px; background:#fff; border:1px solid #e6d8b6; border-radius:12px; padding:4px;">' +
    '<button id="viewCalBtn" style="padding:9px 16px; border-radius:9px;""", """  html += '<div class="tb-group">' +
    '<button id="viewCalBtn" style="padding:0 16px; border-radius:8px;"""),
    ("""    '<button id="viewListBtn" style="padding:9px 16px; border-radius:9px;""", """    '<button id="viewListBtn" style="padding:0 16px; border-radius:8px;"""),
    ("""    html += '<button id="sortBtn" style="display:flex; align-items:center; gap:8px; padding:11px 16px; border:1px solid #e6d8b6; border-radius:11px; background:#fff; font-size:13.5px; font-weight:700; color:#6E2621; cursor:pointer; white-space:nowrap; line-height:1.1;">' +
      '<span style="font-size:13px;">' + (s.sortDir === 'asc' ? '↑' : '↓') + '</span>Date · '""",
     """    html += '<button id="sortBtn" class="tb-ctl">' + icon(s.sortDir === 'asc' ? 'arrowUp' : 'arrowDown', 15) + 'Date · '"""),
    ("""  html += '<button id="filtersBtn" style="display:flex; align-items:center; gap:8px; height:40px; padding:0 16px; border-radius:11px; cursor:pointer; font-size:13.5px; font-weight:700; border:1px solid ' +""",
     """  html += '<button id="filtersBtn" class="tb-ctl" style="border-color:' +"""),
    ("""    (filterCount || s.filtersOpen ? '#6E2621' : '#e6d8b6') + '; background:' + (filterCount ? '#6E2621' : '#fff') + '; color:' + (filterCount ? '#fff' : '#6E2621') + ';">' +
    '<span style="font-size:13px;">⛃</span>Filters' +""",
     """    (filterCount || s.filtersOpen ? '#6E2621' : '#e6d8b6') + '; background:' + (filterCount ? '#6E2621' : '#fff') + '; color:' + (filterCount ? '#fff' : '#6E2621') + ';">' +
    icon('filter', 15) + 'Filters' +"""),
    ("""  html += '<button id="todayBtn" style="display:flex; align-items:center; gap:7px; padding:11px 16px; border:1px solid #e6d8b6; border-radius:11px; background:#fff; font-size:13.5px; font-weight:700; color:#6E2621; cursor:pointer; white-space:nowrap; line-height:1.1;">' +""",
     """  html += '<button id="todayBtn" class="tb-ctl">' +"""),
    ("""    html += '<div style="display:flex; align-items:center; gap:2px; border:1px solid #e6d8b6; border-radius:11px; background:#fff; padding:3px;">' +
      '<button id="calMonthPrevBtn" class="icon-btn" style="width:30px; height:32px; border-radius:8px; color:#8a7952; font-size:17px; cursor:pointer;">‹</button>' +
      '<span style="min-width:142px; text-align:center; font-weight:800; font-size:14px; color:#6E2621;">'""",
     """    html += '<div class="tb-group">' +
      '<button id="calMonthPrevBtn" class="icon-btn" aria-label="Bulan sebelumnya" style="width:32px; border-radius:8px; color:#8a7952; cursor:pointer;">' + icon('left', 18) + '</button>' +
      '<span style="min-width:142px; text-align:center; font-weight:800; font-size:14px; color:#6E2621;">'"""),
    ("""      '<button id="calMonthNextBtn" class="icon-btn" style="width:30px; height:32px; border-radius:8px; color:#8a7952; font-size:17px; cursor:pointer;">›</button>' +""",
     """      '<button id="calMonthNextBtn" class="icon-btn" aria-label="Bulan berikutnya" style="width:32px; border-radius:8px; color:#8a7952; cursor:pointer;">' + icon('right', 18) + '</button>' +"""),
    ("""      '<div style="display:flex; align-items:center; gap:2px; border:1px solid #e6d8b6; border-radius:11px; background:#fff; padding:3px;">' +
      '<button id="calPrevBtn" class="icon-btn" style="width:30px; height:32px; border-radius:8px; color:#8a7952; font-size:17px; cursor:pointer;">‹</button>' +""",
     """      '<div class="tb-group">' +
      '<button id="calPrevBtn" class="icon-btn" aria-label="Sebelumnya" style="width:32px; border-radius:8px; color:#8a7952; cursor:pointer;">' + icon('left', 18) + '</button>' +"""),
    ("""'<span style="font-size:13px; opacity:.7;">🗓</span></button>' +""", """'<span style="opacity:.7;">' + icon('calendar', 15) + '</span></button>' +"""),
    ("""      '<button id="calNextBtn" class="icon-btn" style="width:30px; height:32px; border-radius:8px; color:#8a7952; font-size:17px; cursor:pointer;">›</button>' +""",
     """      '<button id="calNextBtn" class="icon-btn" aria-label="Berikutnya" style="width:32px; border-radius:8px; color:#8a7952; cursor:pointer;">' + icon('right', 18) + '</button>' +"""),
    # date-range popover
    ("""cursor:pointer; font-size:13px;">«</button>' +""", """cursor:pointer;">' + icon('dleft', 16) + '</button>' +"""),
    ("""cursor:pointer; font-size:15px;">‹</button>' +""", """cursor:pointer;">' + icon('left', 16) + '</button>' +"""),
    ("""cursor:pointer; font-size:15px;">›</button>' +""", """cursor:pointer;">' + icon('right', 16) + '</button>' +"""),
    ("""cursor:pointer; font-size:13px;">»</button>' +""", """cursor:pointer;">' + icon('dright', 16) + '</button>' +"""),
    # list rows and PIC chips
    ("""        '<div style="padding:14px 4px; text-align:center; color:#c6b58c; font-size:16px;">›</div>' +""",
     """        '<div style="padding:14px 4px; display:flex; justify-content:center; color:#c6b58c;">' + icon('right', 18) + '</div>' +"""),
    ("""style="cursor:pointer; color:inherit; font-weight:700; line-height:1;">✕</button></span>';""",
     """aria-label="Hapus" style="cursor:pointer; color:inherit; display:inline-flex; padding:0;">' + icon('x', 13) + '</button></span>';"""),
    # ---------- calendar day numbers: text lines up with the event labels below ----------
    ("""    var dayNumHtml = '<span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:8px; font-size:12.5px; font-weight:700; ' +
      (isToday ? 'background:#E85511; color:#fff;' : 'color:' + (c.inMonth ? '#3a2a15' : '#d9c79b') + ';') + '">' + c.day + '</span>';""",
     """    var dayNumHtml = '<span class="tnum" style="align-self:flex-start; display:inline-flex; align-items:center; height:24px; padding:0 6px; border-radius:8px; font-size:13px; font-weight:700; ' +
      (isToday ? 'background:#E85511; color:#fff;' : 'color:' + (c.inMonth ? '#3a2a15' : '#d9c79b') + ';') + '">' + c.day + '</span>';"""),
    ("""style="min-height:104px; background:#fff; padding:8px 7px; display:flex; flex-direction:column;'""",
     """style="min-height:104px; background:#fff; padding:8px; display:flex; flex-direction:column; gap:3px;'"""),
])

# icon helper next to esc() in the Event input script (TataIbadahView uses it too)
patch('Index.html', [("""function tagColor(tag) {""", """/* Line icons (24×24, stroked in currentColor), so chevrons and symbols sit centred in any font. */
var ICONS = {
  left: '<polyline points="15 18 9 12 15 6"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  dleft: '<polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/>',
  dright: '<polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>',
  down: '<polyline points="6 9 12 15 18 9"/>',
  arrowUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="6 11 12 5 18 11"/>',
  arrowDown: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="6 13 12 19 18 13"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  filter: '<polygon points="21 4 3 4 10 12.5 10 19 14 21 14 12.5 21 4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="3.5" y1="10.5" x2="20.5" y2="10.5"/>',
  external: '<path d="M14 4h6v6"/><line x1="10" y1="14" x2="20" y2="4"/><path d="M19 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5H10"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>'
};
function icon(name, size) {
  size = size || 16;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block; flex-shrink:0;">' + ICONS[name] + '</svg>';
}

function tagColor(tag) {""")])

patch('TataIbadahView.html', [
    ("font-family:\\'Bricolage Grotesque\\',sans-serif; ", "", 6),
    # close buttons
    ("""font-size:17px; cursor:pointer; flex-shrink:0;">✕</button>""", """cursor:pointer; flex-shrink:0;">' + icon('x', 18) + '</button>"""),
    ("""data-ti="closePicker" class="icon-btn" aria-label="Tutup" style="width:36px; height:36px; border-radius:11px; background:rgba(58,42,21,.08); font-size:17px; cursor:pointer;">✕</button>""",
     """data-ti="closePicker" class="icon-btn" aria-label="Tutup" style="width:36px; height:36px; border-radius:11px; background:rgba(58,42,21,.08); cursor:pointer;">' + icon('x', 18) + '</button>"""),
    ("""data-ti="closeSongForm" class="icon-btn" style="width:36px; height:36px; border-radius:11px; background:rgba(58,42,21,.08); font-size:17px; cursor:pointer;">✕</button>""",
     """data-ti="closeSongForm" class="icon-btn" aria-label="Tutup" style="width:36px; height:36px; border-radius:11px; background:rgba(58,42,21,.08); cursor:pointer;">' + icon('x', 18) + '</button>"""),
    # library
    ("""style="height:44px; width:44px; padding:0; font-size:18px;">⋯</button>""", """style="height:44px; width:44px; padding:0; display:inline-flex; align-items:center; justify-content:center;">' + icon('more', 20) + '</button>"""),
    ("""'<span style="color:#b3a37c;">⌕</span><input id="tiLibQ\"""", """'<span style="color:#b3a37c;">' + icon('search', 16) + '</span><input id="tiLibQ\""""),
    # Google Doc link
    ("""white-space:nowrap;">Buka ↗</a>' +""", """white-space:nowrap; display:inline-flex; align-items:center; gap:4px;">Buka ' + icon('external', 14) + '</a>' +"""),
    # lyric section toggle
    ("""'<span style="font-size:15px; color:#b3a37c; text-align:right;">' + (open ? '−' : '+') + '</span>' +""",
     """'<span style="color:#b3a37c; display:flex; justify-content:flex-end;">' + icon(open ? 'minus' : 'plus', 15) + '</span>' +"""),
])

# the two small ✕ buttons in TataIbadahView (chip remove, song-form section remove) and other arrows
s = open(ROOT + 'TataIbadahView.html').read()
n_before = s.count('✕')
s = re.sub(r'(data-ti="chipRemove"[^>]*?)font-size:13px; border-radius:6px;">✕</button>',
           r'\1border-radius:6px;">\' + icon(\'x\', 13) + \'</button>', s)
s = re.sub(r'(data-ti="sfRemove"[^>]*?cursor:pointer; flex-shrink:0;)">✕</button>',
           r'\1">\' + icon(\'x\', 15) + \'</button>', s)
open(ROOT + 'TataIbadahView.html', 'w').write(s)
print('remaining ✕ in TataIbadahView:', s.count('✕'), '(was', n_before, ')')
print('ui polish patched')
