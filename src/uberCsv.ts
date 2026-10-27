import type { Shift, SlotName, Slots } from './domain.ts';
import { SLOT_NAMES, validDate, validShift } from './domain.ts';

export type UberImportResult = {
  shifts: Shift[];
  totalTrips: number;
  totalIncome: number;
  totalKm: number;
  totalHours: number;
  dateRange: { from: string; to: string } | null;
  rawRowCount: number;
};

function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

export function parseCsvRows(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  const firstLine = clean.split(/\r?\n/)[0] || '';
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
  }

  return rows;
}

export function parseDateString(val: string): string | null {
  if (!val) return null;
  const trimmed = val.trim();

  // Extract the date part before time (space or 'T')
  const datePart = trimmed.split(/[\sT]/)[0];

  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return validDate(datePart) ? datePart : null;
  }

  // Format: DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  const partsMatch = datePart.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (partsMatch) {
    const p1 = Number(partsMatch[1]);
    const p2 = Number(partsMatch[2]);
    const year = Number(partsMatch[3]);

    let day = p1;
    let month = p2;

    // In Ecuador / Latin America, default is DD/MM/YYYY
    // If p1 > 12, p1 must be day.
    // If p2 > 12, p2 must be day (MM/DD/YYYY format).
    if (p2 > 12 && p1 <= 12) {
      month = p1;
      day = p2;
    }

    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return validDate(iso) ? iso : null;
  }

  return null;
}

/** Fecha y hora local (America/Guayaquil). Si trae zona (Z o -05:00) se convierte; si no, se toma tal cual. */
export function parseDateTime(val: string): { date: string; hour: number | null } | null {
  const trimmed = (val || '').trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const time = Date.parse(trimmed);
    if (Number.isNaN(time)) return null;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(time)).map(p => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
  }
  const date = parseDateString(trimmed);
  if (!date) return null;
  return { date, hour: parseHour(trimmed.slice(trimmed.split(/[\sT]/)[0].length)) };
}

/** Hora 0-23 de textos como "14:32", "8:05:00", "8:30 PM" o "8:30 p. m."; null si no hay hora. */
export function parseHour(val: string): number | null {
  const match = (val || '').match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?\s*(m\.?)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const suffix = match[3] && match[4] ? match[3].toLowerCase() : '';
  if (suffix) { if (hour < 1 || hour > 12) return null; hour = hour % 12 + (suffix === 'p' ? 12 : 0); }
  return hour <= 23 ? hour : null;
}

export const slotForHour = (hour: number): SlotName => hour < 6 ? 'madrugada' : hour < 12 ? 'manana' : hour < 18 ? 'tarde' : 'noche';

export function parseNumericValue(val: string): number {
  if (!val) return 0;
  // Strip common currency words, symbols and whitespace
  let cleaned = val
    .replace(/\b(USD|usd|EUR|eur|COP|cop|ECU|ecu)\b/gi, '')
    .replace(/[$€£\s]/g, '')
    .trim();
  if (!cleaned) return 0;

  // Keep only digits, minus, dot, comma, parentheses
  cleaned = cleaned.replace(/[^\d.,()\-+]/g, '');
  if (!cleaned) return 0;

  // Handle negative values with parenthetical format, e.g. (12.50)
  const isNegative = cleaned.startsWith('-') || (cleaned.startsWith('(') && cleaned.endsWith(')'));
  cleaned = cleaned.replace(/[()]/g, '');

  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Both comma and dot. Which comes last?
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // European / LatAm: 1.234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Only comma: 12,50 (decimal)
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
}

export function parseDurationToHours(val: string, defaultIsMinutes = false): number {
  if (!val) return 0;
  const trimmed = val.trim();

  // If format HH:MM:SS or HH:MM
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map(Number);
    if (parts.length === 3 && parts.every(p => !Number.isNaN(p))) {
      return parts[0] + parts[1] / 60 + parts[2] / 3600;
    }
    if (parts.length === 2 && parts.every(p => !Number.isNaN(p))) {
      return parts[0] + parts[1] / 60;
    }
  }

  const num = parseNumericValue(trimmed);
  if (defaultIsMinutes) return num / 60;
  // If > 24, it's very likely in minutes (e.g. 45 min trip)
  if (num > 24) return num / 60;
  return num;
}

type ColumnMapping = {
  dateCol: number;
  timeCol: number;
  incomeCol: number;
  tripsCol: number;
  kmCol: number;
  isMiles: boolean;
  durationCol: number;
  isMinutes: boolean;
  isDurationHours: boolean;
  otherCostsCol: number;
};

function identifyColumns(header: string[]): ColumnMapping {
  const norm = header.map(normalizeHeader);

  let dateCol = -1;
  let timeCol = -1;
  let incomeCol = -1;
  let tripsCol = -1;
  let kmCol = -1;
  let isMiles = false;
  let durationCol = -1;
  let isMinutes = false;
  let isDurationHours = false;
  let otherCostsCol = -1;

  // 1. Date column
  for (let i = 0; i < norm.length; i++) {
    const h = norm[i];
    if (
      h.includes('fecha de solicitud') ||
      h.includes('request time') ||
      h.includes('hora de solicitud') ||
      h.includes('pickup time') ||
      h.includes('trip date') ||
      h.includes('fecha') ||
      h.includes('date') ||
      h === 'dia'
    ) {
      dateCol = i;
      break;
    }
  }

  // 1b. Separate time column (e.g. "Hora"), not "Horas en línea"
  timeCol = norm.findIndex((h, i) => i !== dateCol && (h === 'hora' || h === 'time' || h.startsWith('hora de') || h.startsWith('hora del')));

  // 2. Trips count column (if daily aggregated)
  for (let i = 0; i < norm.length; i++) {
    const h = norm[i];
    if (
      h.includes('viajes completados') ||
      h.includes('trips completed') ||
      h.includes('completed trips') ||
      h.includes('cantidad de viajes') ||
      h === 'viajes' ||
      h === 'trips'
    ) {
      tripsCol = i;
      break;
    }
  }

  // 3. Income column (prioritize net payout / driver earnings over gross fare)
  const priorityPatterns = [
    /tu pago/,
    /your earnings/,
    /driver earnings/,
    /pago neto/,
    /net payout/,
    /net earnings/,
    /ganancias netas/,
    /tus ganancias/,
    /ingresos netos/,
    /tarifa neta/,
    /payout/,
    /monto neto/,
    /ingresos/,
    /income/,
    /earnings/,
    /fare/,
    /tarifa/,
    /total/
  ];

  for (const pat of priorityPatterns) {
    const idx = norm.findIndex(h => pat.test(h));
    if (idx !== -1) {
      incomeCol = idx;
      break;
    }
  }

  // 4. Distance column
  for (let i = 0; i < norm.length; i++) {
    const h = norm[i];
    if (h.includes('distancia') || h.includes('distance') || h.includes('km') || h.includes('kilometros')) {
      kmCol = i;
      if (h.includes('mi') || h.includes('miles') || h.includes('millas')) {
        isMiles = true;
      }
      break;
    }
  }

  // 5. Duration column (prefer explicit duration; never the date or time column)
  const durationMatchers = [
    (h: string) => h.includes('duracion') || h.includes('duration'),
    (h: string) => h.includes('tiempo') || h.includes('time') || h.includes('horas') || h.includes('hours'),
  ];
  for (const matches of durationMatchers) {
    const i = norm.findIndex((h, idx) => idx !== dateCol && idx !== timeCol && matches(h));
    if (i === -1) continue;
    const h = norm[i];
    durationCol = i;
    if (h.includes('min')) isMinutes = true;
    if (h.includes('hora') || h.includes('hour')) isDurationHours = true;
    break;
  }

  // 6. Other costs
  for (let i = 0; i < norm.length; i++) {
    const h = norm[i];
    if (h.includes('otros gastos') || h.includes('gastos') || h.includes('peajes') || h.includes('tolls')) {
      otherCostsCol = i;
      break;
    }
  }

  return {
    dateCol,
    timeCol,
    incomeCol,
    tripsCol,
    kmCol,
    isMiles,
    durationCol,
    isMinutes,
    isDurationHours,
    otherCostsCol
  };
}

export function parseUberCsv(csvText: string): UberImportResult {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error('El archivo CSV está vacío o solo contiene encabezados.');
  }

  const header = rows[0];
  const mapping = identifyColumns(header);

  if (mapping.dateCol === -1) {
    throw new Error('No se encontró una columna de fecha (ej. "Fecha", "Date", "Fecha de solicitud").');
  }
  if (mapping.incomeCol === -1) {
    throw new Error('No se encontró una columna de ingresos (ej. "Tu pago", "Ganancias netas", "Your Earnings").');
  }

  type DayAccumulator = {
    date: string;
    trips: number;
    income: number;
    km: number;
    hours: number;
    otherCosts: number;
    slots: Slots | null;
  };
  const emptySlots = () => Object.fromEntries(SLOT_NAMES.map(n => [n, { income: 0, trips: 0, hours: 0 }])) as Slots;

  const daysMap = new Map<string, DayAccumulator>();
  let validRowsCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length <= mapping.dateCol) continue;

    const parsedDate = parseDateTime(row[mapping.dateCol]);
    if (!parsedDate) continue; // Skip rows with invalid date (e.g. totals or empty)
    const { date } = parsedDate;
    // Trips crossing midnight stay on the request date and slot.
    const hour = parsedDate.hour ?? (mapping.timeCol !== -1 ? parseHour(row[mapping.timeCol] ?? '') : null);

    const incomeVal = mapping.incomeCol !== -1 ? parseNumericValue(row[mapping.incomeCol]) : 0;
    const kmVal = mapping.kmCol !== -1 ? parseNumericValue(row[mapping.kmCol]) : 0;
    const actualKm = mapping.isMiles ? kmVal * 1.60934 : kmVal;

    let durationHours = 0;
    if (mapping.durationCol !== -1) {
      durationHours = parseDurationToHours(row[mapping.durationCol], mapping.isMinutes);
    }

    const otherCostsVal = mapping.otherCostsCol !== -1 ? parseNumericValue(row[mapping.otherCostsCol]) : 0;

    let tripsVal = 1;
    if (mapping.tripsCol !== -1) {
      const parsedTrips = Math.round(parseNumericValue(row[mapping.tripsCol]));
      tripsVal = parsedTrips > 0 ? parsedTrips : 1;
    }

    const current = daysMap.get(date) || {
      date,
      trips: 0,
      income: 0,
      km: 0,
      hours: 0,
      otherCosts: 0,
      slots: null
    };

    current.trips += tripsVal;
    current.income += incomeVal;
    current.km += actualKm;
    current.hours += durationHours;
    current.otherCosts += otherCostsVal;
    if (hour !== null) {
      current.slots ??= emptySlots();
      const slot = current.slots[slotForHour(hour)];
      slot.income += incomeVal;
      slot.trips += tripsVal;
      slot.hours += durationHours;
    }

    daysMap.set(date, current);
    validRowsCount++;
  }

  if (daysMap.size === 0) {
    throw new Error('No se encontraron filas con fechas y valores válidos en el reporte.');
  }

  // Convert map to Shifts
  const shifts: Shift[] = [];
  const sortedDates = [...daysMap.keys()].sort();

  for (const date of sortedDates) {
    const acc = daysMap.get(date)!;
    // Cap and format values
    const roundedIncome = Math.round(acc.income * 100) / 100;
    const roundedKm = Math.round(acc.km * 10) / 10;
    const roundedOtherCosts = Math.round(acc.otherCosts * 100) / 100;

    // If duration wasn't in CSV or is 0, estimate reasonable hours (e.g. ~25 min per trip, max 14h) or 0.5h min
    let roundedHours = Math.round(acc.hours * 100) / 100;
    if (roundedHours <= 0) {
      roundedHours = Math.min(16, Math.max(0.5, Math.round(acc.trips * 0.45 * 10) / 10));
    }
    if (roundedHours > 24) roundedHours = 24;

    const shiftCandidate: Shift = {
      id: crypto.randomUUID(),
      date,
      trips: acc.trips,
      hours: roundedHours,
      km: roundedKm,
      income: Math.max(0, roundedIncome),
      otherCosts: Math.max(0, roundedOtherCosts),
      notes: `Importado de Uber (${acc.trips} viajes)`,
      odometerStart: null,
      odometerEnd: null,
      setAside: 0,
      slots: acc.slots && Object.fromEntries(SLOT_NAMES.map(n => [n, {
        income: Math.max(0, Math.round(acc.slots![n].income * 100) / 100),
        trips: acc.slots![n].trips,
        hours: Math.min(24, Math.round(acc.slots![n].hours * 100) / 100)
      }])) as Slots
    };

    if (validShift(shiftCandidate)) {
      shifts.push(shiftCandidate);
    }
  }

  if (shifts.length === 0) {
    throw new Error('Los registros del CSV no pudieron ser transformados en jornadas válidas.');
  }

  const totalTrips = shifts.reduce((sum, s) => sum + s.trips, 0);
  const totalIncome = Math.round(shifts.reduce((sum, s) => sum + s.income, 0) * 100) / 100;
  const totalKm = Math.round(shifts.reduce((sum, s) => sum + s.km, 0) * 10) / 10;
  const totalHours = Math.round(shifts.reduce((sum, s) => sum + s.hours, 0) * 100) / 100;

  return {
    shifts,
    totalTrips,
    totalIncome,
    totalKm,
    totalHours,
    dateRange: {
      from: sortedDates[0],
      to: sortedDates[sortedDates.length - 1]
    },
    rawRowCount: validRowsCount
  };
}
