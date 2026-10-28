export const SLOT_NAMES = ['madrugada', 'manana', 'tarde', 'noche'] as const;
export type SlotName = typeof SLOT_NAMES[number];
export type Slot = { income: number; trips: number; hours: number };
export type Slots = Record<SlotName, Slot>;
export const SLOT_LABELS: Record<SlotName, string> = { madrugada: 'Madrugada (00-06)', manana: 'Mañana (06-12)', tarde: 'Tarde (12-18)', noche: 'Noche (18-24)' };
export type Shift = {
  id: string; date: string; hours: number; km: number; trips: number;
  income: number; otherCosts: number; notes: string;
  odometerStart: number | null; odometerEnd: number | null; setAside: number; slots: Slots | null;
};
export type Fuel = {
  id: string; date: string; gallons: number; cost: number; odometer: number; notes: string;
  fullTank: boolean; invoice: boolean; supplier: string;
};
export const MAINTENANCE_TYPES = ['aceite', 'filtros', 'frenos', 'llantas', 'alineacion', 'bateria', 'otro'] as const;
export type MaintenanceType = typeof MAINTENANCE_TYPES[number];
export const MAINTENANCE_LABELS: Record<MaintenanceType, string> = { aceite: 'Cambio de aceite', filtros: 'Filtros', frenos: 'Frenos', llantas: 'Llantas (rotación o cambio)', alineacion: 'Alineación y balanceo', bateria: 'Batería', otro: 'Otro' };
export type Maintenance = {
  id: string; date: string; odometer: number; type: MaintenanceType; cost: number; notes: string;
  invoice: boolean; supplier: string;
};
export type Data = { version: 2; shifts: Shift[]; fuel: Fuel[]; maintenance: Maintenance[] };
export type Backup = { app: 'uber-driver-ai' | 'stonic-driver-ai'; mode: 'demo' | 'real'; exportedAt: string; data: Data };
export const STORAGE_KEY = 'uber-driver-ai:real:v1';
export const LEGACY_STORAGE_KEY = 'stonic-driver-ai:real:v1';
export const SETTINGS_KEY = 'uber-driver-ai:settings:v1';
export const emptyData = (): Data => ({ version: 2, shifts: [], fuel: [], maintenance: [] });
export const money = (n: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);
export const number = (n: number) => new Intl.NumberFormat('es-EC', { maximumFractionDigits: 3 }).format(n);
export const today = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
/** crypto.randomUUID solo existe con HTTPS o 127.0.0.1; getRandomValues también funciona en http://. */
export function newId(c: Pick<Crypto, 'getRandomValues'> & { randomUUID?: () => string } = crypto): string {
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const hex = Array.from(c.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const dateLabel = (date: string) => new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
function numeric(value: unknown, max: number, min = 0): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
const optionalOdometer = (value: unknown) => value === null || numeric(value, 2000000);
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function base(value: Record<string, unknown>) {
  return typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 100 && validDate(value.date) && typeof value.notes === 'string' && value.notes.length <= 500;
}
const validSupplier = (value: Record<string, unknown>) => typeof value.invoice === 'boolean' && typeof value.supplier === 'string' && value.supplier.length <= 120;
function validSlots(value: unknown) {
  return value === null || (record(value) && SLOT_NAMES.every(n => { const s = value[n]; return record(s) && numeric(s.income, 100000) && numeric(s.trips, 300) && Number.isInteger(s.trips) && numeric(s.hours, 24); }));
}
/** Coherencia del odómetro de una jornada; '' si está bien. */
export function shiftProblem(s: Pick<Shift, 'km' | 'odometerStart' | 'odometerEnd'>): string {
  if ((s.odometerStart === null) !== (s.odometerEnd === null)) return 'Anota el odómetro inicial y el final, o deja ambos vacíos.';
  if (s.odometerStart === null || s.odometerEnd === null) return '';
  if (s.odometerEnd < s.odometerStart) return 'El odómetro final no puede ser menor que el inicial.';
  if (s.odometerEnd - s.odometerStart > 3000) return 'La jornada no puede superar 3000 km según el odómetro.';
  if (s.km > s.odometerEnd - s.odometerStart) return 'Los km de viajes no pueden superar los km totales del odómetro.';
  return '';
}
export function validShift(value: unknown): value is Shift {
  return record(value) && base(value) && numeric(value.hours, 24, 0.01) && numeric(value.km, 3000) && numeric(value.trips, 300) && Number.isInteger(value.trips) && numeric(value.income, 100000) && numeric(value.otherCosts, 100000)
    && optionalOdometer(value.odometerStart) && optionalOdometer(value.odometerEnd) && numeric(value.setAside, 100000) && validSlots(value.slots)
    && shiftProblem(value as Shift) === '';
}
export function validFuel(value: unknown): value is Fuel {
  return record(value) && base(value) && numeric(value.gallons, 100, 0.001) && numeric(value.cost, 10000, 0.01) && numeric(value.odometer, 2000000) && typeof value.fullTank === 'boolean' && validSupplier(value);
}
export function validMaintenance(value: unknown): value is Maintenance {
  return record(value) && base(value) && numeric(value.odometer, 2000000) && MAINTENANCE_TYPES.includes(value.type as MaintenanceType) && numeric(value.cost, 100000) && validSupplier(value);
}
/** Convierte registros v1 al formato v2 con los campos nuevos vacíos. */
function upgrade(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 1 || !Array.isArray(value.shifts) || !Array.isArray(value.fuel)) return value;
  return {
    version: 2,
    shifts: value.shifts.map(s => record(s) ? { ...s, odometerStart: null, odometerEnd: null, setAside: 0, slots: null } : s),
    fuel: value.fuel.map(f => record(f) ? { ...f, fullTank: false, invoice: false, supplier: '' } : f),
    maintenance: [],
  };
}
export function parseData(input: unknown): Data {
  const value = record(input) ? upgrade(input) : input;
  if (!record(value) || value.version !== 2 || !Array.isArray(value.shifts) || !Array.isArray(value.fuel) || !Array.isArray(value.maintenance) || value.shifts.length > 20000 || value.fuel.length > 20000 || value.maintenance.length > 20000 || !value.shifts.every(validShift) || !value.fuel.every(validFuel) || !value.maintenance.every(validMaintenance)) throw new Error('El archivo no contiene registros válidos de Uber Driver AI.');
  const ids = [...value.shifts, ...value.fuel, ...value.maintenance].map(r => r.id);
  if (new Set(ids).size !== ids.length) throw new Error('Hay registros duplicados en el respaldo.');
  const slots = (s: Slots | null): Slots | null => s && Object.fromEntries(SLOT_NAMES.map(n => [n, { income: s[n].income, trips: s[n].trips, hours: s[n].hours }])) as Slots;
  return {
    version: 2,
    shifts: value.shifts.map(s => ({ id: s.id, date: s.date, hours: s.hours, km: s.km, trips: s.trips, income: s.income, otherCosts: s.otherCosts, notes: s.notes, odometerStart: s.odometerStart, odometerEnd: s.odometerEnd, setAside: s.setAside, slots: slots(s.slots) })),
    fuel: value.fuel.map(f => ({ id: f.id, date: f.date, gallons: f.gallons, cost: f.cost, odometer: f.odometer, notes: f.notes, fullTank: f.fullTank, invoice: f.invoice, supplier: f.supplier })),
    maintenance: value.maintenance.map(m => ({ id: m.id, date: m.date, odometer: m.odometer, type: m.type, cost: m.cost, notes: m.notes, invoice: m.invoice, supplier: m.supplier })),
  };
}
export function parseBackup(text: string): Data {
  const value: unknown = JSON.parse(text);
  if (!record(value) || (value.app !== 'uber-driver-ai' && value.app !== 'stonic-driver-ai') || value.mode !== 'real') throw new Error('Selecciona un respaldo de tus datos reales. Los ejemplos no se importan.');
  return parseData(value.data);
}
/** true si el texto guardado ya está en formato v2. */
export function isCurrentFormat(raw: string) {
  try { const v: unknown = JSON.parse(raw); return record(v) && v.version === 2; } catch { return false; }
}
export const migrationBackupKey = (date: string) => `${STORAGE_KEY}:respaldo-${date}`;

const cents = (n: number) => Math.round(n * 100);
const ratio = (a: number, b: number) => b > 0 ? a / b : null;
export const shiftTotalKm = (s: Shift) => s.odometerStart !== null && s.odometerEnd !== null ? s.odometerEnd - s.odometerStart : null;
export function summarize(data: Data) {
  const incomeCents = data.shifts.reduce((a, s) => a + cents(s.income), 0);
  const fuelCents = data.fuel.reduce((a, f) => a + cents(f.cost), 0);
  const otherCents = data.shifts.reduce((a, s) => a + cents(s.otherCosts), 0);
  const maintenanceCents = data.maintenance.reduce((a, m) => a + cents(m.cost), 0);
  const setAsideCents = data.shifts.reduce((a, s) => a + cents(s.setAside), 0);
  const balanceCents = incomeCents - fuelCents - otherCents - maintenanceCents;
  const hours = data.shifts.reduce((a, s) => a + s.hours, 0);
  const km = data.shifts.reduce((a, s) => a + s.km, 0);
  const trips = data.shifts.reduce((a, s) => a + s.trips, 0);
  const withOdometer = data.shifts.filter(s => shiftTotalKm(s) !== null);
  const odometerKm = withOdometer.reduce((a, s) => a + shiftTotalKm(s)!, 0);
  const odometerTripKm = withOdometer.reduce((a, s) => a + s.km, 0);
  // Km totales: odómetro cuando existe; si no, km de viajes.
  const totalKm = data.shifts.reduce((a, s) => a + (shiftTotalKm(s) ?? s.km), 0);
  const emptyKm = odometerKm - odometerTripKm;
  return {
    income: incomeCents / 100, fuel: fuelCents / 100, other: otherCents / 100, maintenance: maintenanceCents / 100, setAside: setAsideCents / 100,
    balance: balanceCents / 100, hours, km, trips, totalKm,
    shiftsWithoutOdometer: data.shifts.length - withOdometer.length,
    emptyKm: withOdometer.length ? emptyKm : null, emptyShare: ratio(emptyKm, odometerKm),
    perHour: ratio(incomeCents / 100, hours), balancePerHour: ratio(balanceCents / 100, hours), balancePerKm: ratio(balanceCents / 100, totalKm),
    costPerKm: ratio((fuelCents + otherCents + maintenanceCents) / 100, totalKm),
  };
}
export function filterData(data: Data, from: string, to: string): Data {
  const includes = (r: { date: string }) => (!from || r.date >= from) && (!to || r.date <= to);
  return { version: 2, shifts: data.shifts.filter(includes), fuel: data.fuel.filter(includes), maintenance: data.maintenance.filter(includes) };
}

/** Error si el odómetro de una carga retrocede respecto a cargas de otras fechas; '' si está bien. */
export function fuelOdometerProblem(fuel: Fuel[], f: Fuel): string {
  const others = fuel.filter(o => o.id !== f.id);
  if (others.some(o => o.date < f.date && o.odometer > f.odometer)) return 'El odómetro es menor que el de una carga anterior. Revisa la cifra.';
  if (others.some(o => o.date > f.date && o.odometer < f.odometer)) return 'El odómetro es mayor que el de una carga posterior. Revisa la cifra.';
  return '';
}
export type FuelSegment = { from: string; to: string; km: number; gallons: number; cost: number; kmPerGallon: number; unusual: boolean };
/** Tramos entre dos cargas con tanque lleno. Ignora tramos donde el odómetro no avanza. */
export function fuelEconomy(fuel: Fuel[], lastSegments = 5) {
  const sorted = [...fuel].sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer);
  const segments: FuelSegment[] = [];
  let start: Fuel | null = null; let gallons = 0; let costCents = 0;
  for (const f of sorted) {
    if (start) { gallons += f.gallons; costCents += cents(f.cost); }
    if (!f.fullTank) continue;
    if (start && f.odometer > start.odometer) segments.push({ from: start.date, to: f.date, km: f.odometer - start.odometer, gallons, cost: costCents / 100, kmPerGallon: (f.odometer - start.odometer) / gallons, unusual: false });
    start = f; gallons = 0; costCents = 0;
  }
  if (segments.length >= 3) {
    const values = segments.map(s => s.kmPerGallon).sort((a, b) => a - b);
    const median = values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
    for (const s of segments) s.unusual = s.kmPerGallon < median * 0.65 || s.kmPerGallon > median * 1.5;
  }
  const recent = segments.filter(s => !s.unusual).slice(-lastSegments);
  const km = recent.reduce((a, s) => a + s.km, 0);
  const g = recent.reduce((a, s) => a + s.gallons, 0);
  const kmPerGallon = ratio(km, g);
  const pricePerGallon = ratio(recent.reduce((a, s) => a + s.cost, 0), g);
  return { segments, kmPerGallon, pricePerGallon, costPerKm: kmPerGallon && pricePerGallon !== null ? pricePerGallon / kmPerGallon : null };
}
/** Ingresos menos combustible estimado por km y otros gastos de una jornada. */
export const estimatedProfit = (s: Shift, fuelCostPerKm: number) => (cents(s.income) - cents(s.otherCosts)) / 100 - (shiftTotalKm(s) ?? s.km) * fuelCostPerKm;

export type Interval = { km: number | null; months: number | null };
export type Intervals = Record<Exclude<MaintenanceType, 'otro'>, Interval>;
export type Settings = {
  model: string; plate: string; city: string;
  dailyGoal: number; maxHours: number; maintenancePercent: number; taxPercent: number;
  intervals: Intervals; lastBackupAt: string | null; changedSinceBackup: boolean;
};
const INTERVAL_TYPES = MAINTENANCE_TYPES.filter((t): t is Exclude<MaintenanceType, 'otro'> => t !== 'otro');
export const defaultSettings = (): Settings => ({
  model: '', plate: '', city: '', dailyGoal: 0, maxHours: 0, maintenancePercent: 0, taxPercent: 0,
  intervals: Object.fromEntries(INTERVAL_TYPES.map(t => [t, { km: null, months: null }])) as Intervals,
  lastBackupAt: null, changedSinceBackup: false,
});
export function settingsProblem(s: Settings): string {
  if (s.maintenancePercent + s.taxPercent > 100) return 'Los porcentajes para mantenimiento e impuestos no pueden sumar más de 100 %.';
  return '';
}
/** Lee la configuración guardada; los valores inválidos vuelven al predeterminado. */
export function parseSettings(input: unknown): Settings {
  const d = defaultSettings();
  if (!record(input)) return d;
  const text = (v: unknown) => typeof v === 'string' ? v.slice(0, 120) : '';
  const num = (v: unknown, max: number, fallback: number) => numeric(v, max) ? v : fallback;
  const optional = (v: unknown, max: number) => numeric(v, max, 1) ? v : null;
  const intervals = record(input.intervals) ? input.intervals : {};
  const s: Settings = {
    model: text(input.model), plate: text(input.plate), city: text(input.city),
    dailyGoal: num(input.dailyGoal, 100000, 0), maxHours: num(input.maxHours, 24, 0),
    maintenancePercent: num(input.maintenancePercent, 100, 0), taxPercent: num(input.taxPercent, 100, 0),
    intervals: Object.fromEntries(INTERVAL_TYPES.map(t => { const i = intervals[t]; return [t, record(i) ? { km: optional(i.km, 200000), months: optional(i.months, 120) } : d.intervals[t]]; })) as Intervals,
    lastBackupAt: typeof input.lastBackupAt === 'string' && !Number.isNaN(Date.parse(input.lastBackupAt)) ? input.lastBackupAt : null,
    changedSinceBackup: input.changedSinceBackup === true,
  };
  if (settingsProblem(s)) { s.maintenancePercent = 0; s.taxPercent = 0; }
  return s;
}

/** Odómetro más alto registrado en jornadas, combustible o mantenimiento. */
export function currentOdometer(data: Data): number | null {
  const values = [...data.shifts.flatMap(s => [s.odometerStart, s.odometerEnd]), ...data.fuel.map(f => f.odometer), ...data.maintenance.map(m => m.odometer)].filter((v): v is number => v !== null && v > 0);
  return values.length ? Math.max(...values) : null;
}
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
function addMonths(date: string, months: number) {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}
export type MaintenanceStatus = { type: Exclude<MaintenanceType, 'otro'>; last: Maintenance | null; kmLeft: number | null; daysLeft: number | null; status: 'ok' | 'pronto' | 'vencido' | 'sin-registro' };
/** Estado de cada tipo con intervalo configurado. "pronto" = queda 15 % o menos del intervalo. */
export function maintenanceStatus(data: Data, intervals: Intervals, on: string): MaintenanceStatus[] {
  const odometer = currentOdometer(data);
  return INTERVAL_TYPES.filter(t => intervals[t].km || intervals[t].months).map(type => {
    const { km, months } = intervals[type];
    const last = data.maintenance.filter(m => m.type === type).sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer)[0] ?? null;
    if (!last) return { type, last, kmLeft: null, daysLeft: null, status: 'sin-registro' as const };
    const kmLeft = km && odometer !== null ? last.odometer + km - odometer : null;
    const daysLeft = months ? days(on, addMonths(last.date, months)) : null;
    const due = (kmLeft !== null && kmLeft < 0) || (daysLeft !== null && daysLeft < 0);
    const soon = (kmLeft !== null && km && kmLeft <= km * 0.15) || (daysLeft !== null && months && daysLeft <= months * 30 * 0.15);
    return { type, last, kmLeft, daysLeft, status: due ? 'vencido' as const : soon ? 'pronto' as const : 'ok' as const };
  });
}
export function maintenanceMessage(m: MaintenanceStatus): string {
  const label = MAINTENANCE_LABELS[m.type];
  if (m.status === 'sin-registro') return `${label}: anota el último servicio para calcular el próximo.`;
  const parts: string[] = [];
  if (m.kmLeft !== null) parts.push(m.kmLeft < 0 ? `vencido hace ${number(-m.kmLeft)} km` : `en ${number(m.kmLeft)} km`);
  if (m.daysLeft !== null) parts.push(m.daysLeft < 0 ? `vencido hace ${-m.daysLeft} días` : `en ${m.daysLeft} días`);
  return `${label}: ${parts.join(' o ')}`;
}

/** Sugerencia de sobres para el periodo, como porcentaje de los ingresos. */
export function envelopes(data: Data, settings: Settings) {
  const income = data.shifts.reduce((a, s) => a + cents(s.income), 0);
  const maintenance = Math.round(income * settings.maintenancePercent / 100);
  const taxes = Math.round(income * settings.taxPercent / 100);
  return { maintenance: maintenance / 100, taxes: taxes / 100, suggested: (maintenance + taxes) / 100, setAside: data.shifts.reduce((a, s) => a + cents(s.setAside), 0) / 100 };
}

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
/**
 * Rendimiento por día de la semana. El valor por jornada es la ganancia estimada si hay costo de combustible por km;
 * si no, ingresos menos otros gastos. Solo es confiable con minShifts jornadas o más.
 */
export function byWeekday(shifts: Shift[], fuelCostPerKm: number | null, minShifts = 3) {
  return WEEKDAYS.map((name, day) => {
    const rows = shifts.filter(s => weekday(s.date) === day);
    const hours = rows.reduce((a, s) => a + s.hours, 0);
    const value = rows.reduce((a, s) => a + (fuelCostPerKm === null ? s.income - s.otherCosts : estimatedProfit(s, fuelCostPerKm)), 0);
    return { day, name, shifts: rows.length, perHour: ratio(value, hours), tripsPerHour: ratio(rows.reduce((a, s) => a + s.trips, 0), hours), enough: rows.length >= minShifts };
  });
}
/** Suma de las franjas horarias importadas del CSV. Una franja es confiable si aparece en minShifts jornadas o más. */
export function bySlot(shifts: Shift[], minShifts = 3) {
  return SLOT_NAMES.map(name => {
    const rows = shifts.filter(s => s.slots && s.slots[name].trips > 0);
    const income = rows.reduce((a, s) => a + cents(s.slots![name].income), 0) / 100;
    const hours = rows.reduce((a, s) => a + s.slots![name].hours, 0);
    const trips = rows.reduce((a, s) => a + s.slots![name].trips, 0);
    return { name, label: SLOT_LABELS[name], shifts: rows.length, income, trips, hours, perHour: ratio(income, hours), enough: rows.length >= minShifts };
  });
}

function csvCell(value: string | number) {
  if (typeof value === 'number') return value.toFixed(2).replace('.', ',');
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
/** Reporte mensual en CSV (separador ";" y coma decimal, como lo abre Excel en español). month = AAAA-MM. */
export function monthlyReport(data: Data, month: string): string {
  const inMonth = (r: { date: string }) => r.date.startsWith(`${month}-`);
  const shifts = data.shifts.filter(inMonth); const fuel = data.fuel.filter(inMonth); const maintenance = data.maintenance.filter(inMonth);
  const header = ['Fecha', 'Tipo', 'Concepto', 'Proveedor', 'Factura', 'Ingreso', 'Gasto', 'Km', 'Horas', 'Nota'];
  const rows: (string | number)[][] = [];
  for (const s of shifts) {
    rows.push([s.date, 'Jornada', `${s.trips} viajes`, '', '', s.income, 0, shiftTotalKm(s) ?? s.km, s.hours, s.notes]);
    if (s.otherCosts) rows.push([s.date, 'Otros gastos', 'Gastos de la jornada', '', 'No', 0, s.otherCosts, 0, 0, '']);
  }
  for (const f of fuel) rows.push([f.date, 'Combustible', `${number(f.gallons)} galones`, f.supplier, f.invoice ? 'Sí' : 'No', 0, f.cost, 0, 0, f.notes]);
  for (const m of maintenance) rows.push([m.date, 'Mantenimiento', MAINTENANCE_LABELS[m.type], m.supplier, m.invoice ? 'Sí' : 'No', 0, m.cost, 0, 0, m.notes]);
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const sum = (values: number[]) => values.reduce((a, v) => a + cents(v), 0) / 100;
  const withInvoice = sum([...fuel.filter(f => f.invoice).map(f => f.cost), ...maintenance.filter(m => m.invoice).map(m => m.cost)]);
  const withoutInvoice = sum([...fuel.filter(f => !f.invoice).map(f => f.cost), ...maintenance.filter(m => !m.invoice).map(m => m.cost), ...shifts.map(s => s.otherCosts)]);
  const totals: (string | number)[][] = [
    ['', 'Total', 'Ingresos', '', '', sum(shifts.map(s => s.income)), 0, 0, 0, ''],
    ['', 'Total', 'Gastos con factura', '', 'Sí', 0, withInvoice, 0, 0, ''],
    ['', 'Total', 'Gastos sin factura', '', 'No', 0, withoutInvoice, 0, 0, ''],
    ['', 'Total', 'Km y horas', '', '', 0, 0, shifts.reduce((a, s) => a + (shiftTotalKm(s) ?? s.km), 0), shifts.reduce((a, s) => a + s.hours, 0), ''],
  ];
  return '﻿' + [header, ...rows, ...totals].map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

export function demoData(): Data {
  const incomes = [68.50, 82.75, 73.20, 96.40, 112.80, 88.60, 104.25];
  const tripKm = [94, 118, 102, 140, 158, 124, 148];
  const emptyKm = [30, 42, 35, 48, 55, 40, 50];
  const end = new Date(`${today()}T12:00:00Z`);
  let odometer = 20000;
  const shifts: Shift[] = incomes.map((income, index) => {
    const date = new Date(end); date.setUTCDate(date.getUTCDate() - 6 + index);
    const odometerStart = odometer; odometer += tripKm[index] + emptyKm[index];
    return { id: `demo-shift-${index}`, date: date.toISOString().slice(0, 10), income, hours: [5, 6, 5.5, 7, 8, 6, 7.5][index], km: tripKm[index], trips: [12, 16, 14, 19, 22, 17, 20][index], otherCosts: index % 2 ? 2.50 : 0, notes: 'Ejemplo de práctica', odometerStart, odometerEnd: odometer, setAside: index % 2 ? 10 : 5, slots: null };
  });
  return { version: 2, shifts, fuel: [1, 4].map((i) => ({ id: `demo-fuel-${i}`, date: shifts[i].date, gallons: 9, cost: 25.50, odometer: shifts[i].odometerStart!, notes: 'Carga ficticia; no representa precios actuales.', fullTank: true, invoice: i === 4, supplier: i === 4 ? 'Estación de ejemplo' : '' })), maintenance: [] };
}
