import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byWeekday, defaultSettings, demoData, emptyData, envelopes, filterData, fuelEconomy, fuelOdometerProblem, maintenanceMessage, maintenanceStatus, monthlyReport, parseBackup, parseData, parseSettings, settingsProblem, shiftProblem, summarize, validDate, validFuel, validShift } from '../src/domain.ts';
import type { Data, Fuel, Intervals, Maintenance, Shift } from '../src/domain.ts';

const shift: Shift = { id: 'one', date: '2026-10-19', hours: 5, km: 100, trips: 12, income: 50.10, otherCosts: 2.20, notes: '', odometerStart: null, odometerEnd: null, setAside: 0, slots: null };
const fuel = (id: string, date: string, odometer: number, gallons: number, fullTank: boolean, cost = 25): Fuel => ({ id, date, gallons, cost, odometer, notes: '', fullTank, invoice: false, supplier: '' });
const maintenance = (id: string, date: string, odometer: number, type: Maintenance['type'] = 'aceite', cost = 40): Maintenance => ({ id, date, odometer, type, cost, notes: '', invoice: false, supplier: '' });
const data = (patch: Partial<Data>): Data => ({ ...emptyData(), ...patch });
const v1Backup = readFileSync(new URL('./fixtures/respaldo-v1-anonimizado.json', import.meta.url), 'utf8');

test('suma dinero en centavos y evita dividir para cero', () => {
  const result = summarize(data({ shifts: [shift], fuel: [fuel('two', shift.date, 20000, 3, false, 10.30)] }));
  assert.equal(result.balance, 37.60);
  assert.equal(result.perHour, 10.02);
  assert.equal(summarize(emptyData()).perHour, null);
});
test('conserva saldos negativos; una carga sin jornadas no inventa ingresos', () => {
  const result = summarize(data({ fuel: [fuel('f', shift.date, 100, 4, false, 20)] }));
  assert.equal(result.balance, -20);
  assert.equal(result.perHour, null);
});
test('rango de fechas inclusivo y aplicado también al combustible y mantenimiento', () => {
  const all = data({ shifts: [shift, { ...shift, id: 'old', date: '2026-10-18' }], fuel: [fuel('f', '2026-10-18', 100, 3, false)], maintenance: [maintenance('m', '2026-10-18', 100)] });
  const filtered = filterData(all, '2026-10-19', '2026-10-19');
  assert.deepEqual(filtered.shifts, [shift]);
  assert.deepEqual(filtered.fuel, []);
  assert.deepEqual(filtered.maintenance, []);
});
test('rechaza fechas imposibles, cifras negativas e infinitas y viajes fraccionarios', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('19/10/2026'), false);
  assert.equal(validShift({ ...shift, income: -1 }), false);
  assert.equal(validShift({ ...shift, km: Infinity }), false);
  assert.equal(validShift({ ...shift, hours: 25 }), false);
  assert.equal(validShift({ ...shift, trips: 1.5 }), false);
  assert.equal(validFuel({ ...fuel('f', shift.date, 0, 0, false), cost: 2 }), false);
});
test('el respaldo real v2 completa un ciclo sin perder datos', () => {
  const demo = demoData();
  assert.deepEqual(parseBackup(JSON.stringify({ app: 'uber-driver-ai', mode: 'real', data: demo })), demo);
  const withAll = data({ shifts: [{ ...shift, odometerStart: 1000, odometerEnd: 1150, setAside: 8, slots: { madrugada: { income: 0, trips: 0, hours: 0 }, manana: { income: 20, trips: 4, hours: 1.2 }, tarde: { income: 30.1, trips: 8, hours: 2 }, noche: { income: 0, trips: 0, hours: 0 } } }], fuel: [{ ...fuel('f', shift.date, 1150, 8, true), invoice: true, supplier: 'Estación' }], maintenance: [maintenance('m', shift.date, 1100)] });
  assert.deepEqual(parseBackup(JSON.stringify({ app: 'uber-driver-ai', mode: 'real', data: withAll })), withAll);
});
test('migra un respaldo v1 a v2 con los campos nuevos vacíos', () => {
  const migrated = parseBackup(v1Backup);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.shifts.length, 2);
  assert.deepEqual(migrated.maintenance, []);
  for (const s of migrated.shifts) { assert.equal(s.odometerStart, null); assert.equal(s.odometerEnd, null); assert.equal(s.setAside, 0); assert.equal(s.slots, null); }
  assert.deepEqual(migrated.fuel.map(f => [f.fullTank, f.invoice, f.supplier]), [[false, false, '']]);
  assert.equal(summarize(migrated).income, 155.55);
  assert.deepEqual(parseData(JSON.parse(JSON.stringify(migrated))), migrated);
});
test('no permite importar una demostración como registros reales', () => {
  assert.throws(() => parseBackup(JSON.stringify({ app: 'stonic-driver-ai', mode: 'demo', data: demoData() })), /reales/);
});
test('rechaza archivos rotos, versiones desconocidas e identificadores duplicados', () => {
  assert.throws(() => parseBackup('{'));
  assert.throws(() => parseData({ version: 3, shifts: [], fuel: [], maintenance: [] }));
  assert.throws(() => parseData({ version: 2, shifts: [], fuel: [] }));
  assert.throws(() => parseData(data({ shifts: [shift, shift] })), /duplicados/);
  assert.throws(() => parseData(data({ shifts: [shift], maintenance: [maintenance('one', shift.date, 10)] })), /duplicados/);
  assert.throws(() => parseData({ version: 1, shifts: [{ ...shift, income: '50' }], fuel: [] }));
  assert.throws(() => parseData(data({ maintenance: [{ ...maintenance('m', shift.date, 10), type: 'pintura' as Maintenance['type'] }] })));
});
test('los datos de ejemplo son válidos, independientes y suman correctamente', () => {
  const demo = demoData();
  assert.deepEqual(parseData(demo), demo);
  assert.equal(summarize(demo).income, 626.50);
  assert.equal(summarize(demo).balance, 568);
  assert.equal(summarize(demo).hours, 45);
  assert.ok(fuelEconomy(demo.fuel).kmPerGallon! > 0);
  demo.shifts.pop();
  assert.equal(demoData().shifts.length, 7);
});

test('odómetro: jornada sin odómetro sigue funcionando', () => {
  assert.equal(validShift(shift), true);
  const result = summarize(data({ shifts: [shift] }));
  assert.equal(result.emptyShare, null);
  assert.equal(result.totalKm, 100);
  assert.equal(result.shiftsWithoutOdometer, 1);
});
test('odómetro: invertido, a medias o con km de viajes mayores que los totales es un error', () => {
  assert.match(shiftProblem({ km: 10, odometerStart: 2000, odometerEnd: 1900 }), /menor que el inicial/);
  assert.match(shiftProblem({ km: 150, odometerStart: 1000, odometerEnd: 1100 }), /superar los km totales/);
  assert.match(shiftProblem({ km: 10, odometerStart: 1000, odometerEnd: null }), /ambos/);
  assert.equal(validShift({ ...shift, odometerStart: 2000, odometerEnd: 1900 }), false);
  assert.equal(validShift({ ...shift, odometerStart: 1000, odometerEnd: 1100 }), true);
});
test('km sin pasajero, saldo por hora y por km', () => {
  const s1 = { ...shift, odometerStart: 1000, odometerEnd: 1160 };
  const s2 = { ...shift, id: 'two', km: 40, odometerStart: null, odometerEnd: null };
  const result = summarize(data({ shifts: [s1, s2], fuel: [fuel('f', shift.date, 1160, 3, false, 10)] }));
  assert.equal(result.emptyKm, 60);
  assert.equal(result.emptyShare, 60 / 160);
  assert.equal(result.totalKm, 200);
  assert.equal(result.shiftsWithoutOdometer, 1);
  assert.equal(result.balance, 85.80);
  assert.equal(result.balancePerHour, 8.58);
  assert.equal(result.balancePerKm, 85.80 / 200);
  assert.equal(result.costPerKm, 14.40 / 200);
});
test('saldo por hora y km: sin horas o sin km devuelve null; centavos exactos', () => {
  const zeroKm = summarize(data({ shifts: [{ ...shift, km: 0 }] }));
  assert.equal(zeroKm.balancePerKm, null);
  assert.equal(zeroKm.costPerKm, null);
  const empty = summarize(filterData(data({ shifts: [shift] }), '2026-01-01', '2026-01-02'));
  assert.equal(empty.balancePerHour, null);
  assert.equal(empty.balancePerKm, null);
  const cents = summarize(data({ shifts: [{ ...shift, income: 0.1, otherCosts: 0 }, { ...shift, id: 'b', income: 0.2, otherCosts: 0 }] }));
  assert.equal(cents.balance, 0.3);
});
test('mantenimiento resta del saldo y entra en el gasto por km', () => {
  const result = summarize(data({ shifts: [{ ...shift, otherCosts: 0 }], maintenance: [maintenance('m', shift.date, 1000, 'aceite', 30)] }));
  assert.equal(result.balance, 20.10);
  assert.equal(result.costPerKm, 0.3);
});

test('consumo: un solo tanque lleno no calcula nada', () => {
  const result = fuelEconomy([fuel('a', '2026-10-01', 1000, 8, true), fuel('b', '2026-10-03', 1200, 3, false)]);
  assert.deepEqual(result.segments, []);
  assert.equal(result.kmPerGallon, null);
  assert.equal(result.costPerKm, null);
});
test('consumo: suma las cargas parciales entre dos llenos', () => {
  const result = fuelEconomy([fuel('a', '2026-10-01', 1000, 8, true, 24), fuel('b', '2026-10-03', 1200, 4, false, 12), fuel('c', '2026-10-05', 1500, 6, true, 18)]);
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].km, 500);
  assert.equal(result.segments[0].gallons, 10);
  assert.equal(result.kmPerGallon, 50);
  assert.equal(result.pricePerGallon, 3);
  assert.equal(result.costPerKm, 0.06);
});
test('consumo: el odómetro que retrocede es un error y no forma tramo', () => {
  const list = [fuel('a', '2026-10-01', 1000, 8, true), fuel('b', '2026-10-05', 1500, 6, true)];
  assert.match(fuelOdometerProblem(list, fuel('x', '2026-10-06', 1400, 5, true)), /anterior/);
  assert.match(fuelOdometerProblem(list, fuel('x', '2026-10-03', 1600, 5, true)), /posterior/);
  assert.equal(fuelOdometerProblem(list, fuel('x', '2026-10-06', 1600, 5, true)), '');
  assert.equal(fuelEconomy([...list, fuel('c', '2026-10-06', 1400, 5, true)]).segments.length, 1);
});
test('consumo: marca tramos fuera de lo normal y los excluye del promedio', () => {
  const list = [fuel('a', '2026-10-01', 1000, 10, true), fuel('b', '2026-10-02', 1500, 10, true), fuel('c', '2026-10-03', 2000, 10, true), fuel('d', '2026-10-04', 2500, 10, true), fuel('e', '2026-10-05', 4500, 10, true)];
  const result = fuelEconomy(list);
  assert.deepEqual(result.segments.map(s => s.unusual), [false, false, false, true]);
  assert.equal(result.kmPerGallon, 50);
});

const intervals = (patch: Partial<Intervals>): Intervals => ({ ...defaultSettings().intervals, ...patch });
test('mantenimiento: sin intervalos configurados no hay avisos', () => {
  assert.deepEqual(maintenanceStatus(data({ maintenance: [maintenance('m', '2026-01-01', 1000)] }), defaultSettings().intervals, '2026-10-27'), []);
});
test('mantenimiento: aviso por km, por fecha, vencido y sin registro', () => {
  const base = data({ maintenance: [maintenance('m', '2026-09-01', 10000)], fuel: [fuel('f', '2026-10-20', 14550, 8, true)] });
  const [byKm] = maintenanceStatus(base, intervals({ aceite: { km: 5000, months: null } }), '2026-10-27');
  assert.equal(byKm.kmLeft, 450);
  assert.equal(byKm.status, 'pronto');
  assert.equal(maintenanceMessage(byKm), 'Cambio de aceite: en 450 km');
  const [byDate] = maintenanceStatus(base, intervals({ aceite: { km: null, months: 2 } }), '2026-10-27');
  assert.equal(byDate.daysLeft, 5);
  assert.equal(byDate.status, 'pronto');
  const [overdue] = maintenanceStatus(data({ maintenance: [maintenance('m', '2026-01-01', 10000, 'llantas')], fuel: [fuel('f', '2026-10-20', 21200, 8, true)] }), intervals({ llantas: { km: 10000, months: null } }), '2026-10-27');
  assert.equal(overdue.status, 'vencido');
  assert.match(maintenanceMessage(overdue), /vencido hace 1\.200 km/);
  const [missing] = maintenanceStatus(base, intervals({ frenos: { km: 20000, months: null } }), '2026-10-27');
  assert.equal(missing.status, 'sin-registro');
});
test('mantenimiento: la fecha suma meses respetando el fin de mes', () => {
  const [status] = maintenanceStatus(data({ maintenance: [maintenance('m', '2026-01-31', 0)] }), intervals({ aceite: { km: null, months: 1 } }), '2026-02-27');
  assert.equal(status.daysLeft, 1);
});

test('meta y apartados: porcentajes que suman más de 100 % son un error', () => {
  assert.match(settingsProblem({ ...defaultSettings(), maintenancePercent: 60, taxPercent: 50 }), /100/);
  assert.equal(settingsProblem({ ...defaultSettings(), maintenancePercent: 50, taxPercent: 50 }), '');
  assert.equal(parseSettings({ maintenancePercent: 80, taxPercent: 30 }).maintenancePercent, 0);
});
test('meta y apartados: periodo sin jornadas sugiere cero', () => {
  const settings = { ...defaultSettings(), maintenancePercent: 10, taxPercent: 5 };
  assert.deepEqual(envelopes(emptyData(), settings), { maintenance: 0, taxes: 0, suggested: 0, setAside: 0 });
  assert.deepEqual(envelopes(data({ shifts: [{ ...shift, income: 100, setAside: 12 }] }), settings), { maintenance: 10, taxes: 5, suggested: 15, setAside: 12 });
});
test('configuración guardada inválida vuelve a los valores predeterminados', () => {
  assert.deepEqual(parseSettings('basura'), defaultSettings());
  const parsed = parseSettings({ model: 'Auto', dailyGoal: -5, maxHours: 30, intervals: { aceite: { km: 5000, months: 'x' } }, lastBackupAt: 'nunca' });
  assert.equal(parsed.model, 'Auto');
  assert.equal(parsed.dailyGoal, 0);
  assert.equal(parsed.maxHours, 0);
  assert.deepEqual(parsed.intervals.aceite, { km: 5000, months: null });
  assert.equal(parsed.lastBackupAt, null);
});

test('mejores días: solo compara días con al menos 3 jornadas', () => {
  // 2026-10-19, 26 y 2026-11-02 son lunes.
  const mondays = ['2026-10-19', '2026-10-26', '2026-11-02'].map((date, i) => ({ ...shift, id: `m${i}`, date, income: 60, otherCosts: 0, hours: 6, trips: 12 }));
  const tuesday = { ...shift, id: 't', date: '2026-10-20' };
  const rows = byWeekday([...mondays, tuesday], null);
  assert.equal(rows[1].enough, true);
  assert.equal(rows[1].perHour, 10);
  assert.equal(rows[1].tripsPerHour, 2);
  assert.equal(rows[2].enough, false);
  assert.equal(byWeekday(mondays, 0.05)[1].perHour, 55 / 6);
});

test('reporte mensual: mes sin registros solo trae encabezado y totales en cero', () => {
  const lines = monthlyReport(emptyData(), '2026-10').replace('﻿', '').trim().split('\r\n');
  assert.equal(lines[0], 'Fecha;Tipo;Concepto;Proveedor;Factura;Ingreso;Gasto;Km;Horas;Nota');
  assert.equal(lines.length, 5);
  assert.equal(lines[1], ';Total;Ingresos;;;0,00;0,00;0,00;0,00;');
});
test('reporte mensual: separa gastos con y sin factura y escapa caracteres especiales', () => {
  const report = monthlyReport(data({
    shifts: [{ ...shift, notes: 'Nota; con "comillas"\ny salto' }, { ...shift, id: 'otro-mes', date: '2026-09-30' }],
    fuel: [{ ...fuel('f', '2026-10-19', 1000, 8, true, 24.5), invoice: true, supplier: '=HYPERLINK("x")' }],
    maintenance: [maintenance('m', '2026-10-20', 1100, 'aceite', 40)],
  }), '2026-10');
  assert.ok(report.includes('"Nota; con ""comillas""\ny salto"'));
  assert.ok(report.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(report.includes(';Total;Ingresos;;;50,10;'));
  assert.ok(report.includes(';Total;Gastos con factura;;Sí;0,00;24,50;'));
  assert.ok(report.includes(';Total;Gastos sin factura;;No;0,00;42,20;'));
  assert.ok(!report.includes('2026-09-30'));
});
