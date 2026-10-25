// Service-only matching and load-time reconciliation, against fake sheets.
const m = require('./server_test.js');
const { r, sheets } = m;
const S = sheets.Schedule.rows;
S.length = 1;
const D = s => new Date(s + 'T00:00:00');
S.push([1, D('2026-10-25'), 'Glorious Purpose: Body of Christ', '', 'Service'],      // pastor blank → from TI
       [2, D('2026-11-01'), 'YM', '', 'YM'],                                         // not a service
       [3, D('2026-11-08'), 'Rooted: Deep', 'Pdt. Jadwal', 'Service'],               // TI pf blank → from schedule
       [4, D('2026-11-15'), 'Old theme', 'Pdt. Old', 'Service']);                    // both set, differ → TI wins
const ti = r('getOrCreateSheet_(TI_SHEET, TI_HEADERS)');
const row = (id, d, series, sub, pf) => [id, D(d), '', series, sub, pf, '', '', false, 'Draft', '{}', D('2026-10-01')];
ti.getRange(2, 1, 4, 12).setValues([row('1', '2026-10-25', 'Glorious Purpose', 'Body of Christ', 'Paul Sirait'), row('2', '2026-11-01', 'X', 'Y', 'Pdt. YM'),
  row('3', '2026-11-08', 'Rooted', 'Deep', ''), row('4', '2026-11-15', 'New', 'Theme', 'Pdt. New')]);
console.log('changed rows:', r('reconcileServicesWithSchedule_()'));
console.log('schedule:', JSON.stringify(S.slice(1).map(x => [x[0], x[2], x[3], x[4]])));
console.log('tata ibadah:', JSON.stringify(r('getTataIbadahData().services').map(s => [s.id, s.date, s.series + ': ' + s.sub, s.pf])));
console.log('second run changes:', r('reconcileServicesWithSchedule_()'));
console.log('pick on YM day:', JSON.stringify(r(`pickScheduleEvent_(scheduleEventsOn_(getScheduleSheet_(), '2026-11-01'))`)));
const save = r(`saveTataIbadah({date:'2026-11-22', series:'', sub:'Kristus Raja', pf:'Pdt. Z', slots:{}})`);
console.log('save on day without Service adds one:', save.scheduleChanged, JSON.stringify(save.schedule));
