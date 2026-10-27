import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { byWeekday, bySlot, currentOdometer, dateLabel, demoData, emptyData, envelopes, estimatedProfit, filterData, fuelEconomy, fuelOdometerProblem, MAINTENANCE_LABELS, MAINTENANCE_TYPES, maintenanceMessage, maintenanceStatus, money, monthlyReport, number, parseBackup, parseData, parseSettings, SETTINGS_KEY, settingsProblem, shiftProblem, shiftTotalKm, summarize, today, validFuel, validMaintenance, validShift } from './domain.ts';
import type { Backup, Data, Fuel, Intervals, Maintenance, MaintenanceType, Settings, Shift } from './domain.ts';
import { loadData, saveData } from './storage.ts';
import { parseUberCsv } from './uberCsv.ts';
import type { UberImportResult } from './uberCsv.ts';

type Tab = 'Resumen' | 'Jornadas' | 'Combustible' | 'Mantenimiento' | 'Mis datos';
function loadSettings(): Settings {
  try { return parseSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')); } catch { return parseSettings(null); }
}
function download(text: string, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const optionalNumber = (value: FormDataEntryValue | null) => value === null || String(value).trim() === '' ? null : Number(value);
const percent = (n: number) => new Intl.NumberFormat('es-EC', { style: 'percent', maximumFractionDigits: 0 }).format(n);
const perKm = (n: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n);
function Icon({ kind }: { kind: string }) {
  const paths: Record<string, ReactNode> = {
    Resumen: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    Jornadas: <><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16m-12 5h3"/></>,
    Combustible: <><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M2 21h14M4 10h10m0 3h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9l-4-4"/><path d="M19 6v4h3"/></>,
    Mantenimiento: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7V21h3.3l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>,
    'Mis datos': <><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/></>,
    car: <><path d="m4 10 2-6h12l2 6M3 17v3m18-3v3M2 10h20v7H2zM5 13h3m8 0h3"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></>,
  };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind] || paths.Resumen}</svg>;
}
function Field({ label, name, value, min = 0, max, step = '0.01', type = 'number', hint, required = true, placeholder }: { label: string; name: string; value?: string | number | null; min?: number; max?: number; step?: string; type?: string; hint?: string; required?: boolean; placeholder?: string }) {
  return <label className="field">{label}<input name={name} type={type} defaultValue={value ?? undefined} required={required} min={type === 'number' ? min : undefined} max={type === 'number' ? max : type === 'date' ? today() : undefined} step={type === 'number' ? step : undefined} placeholder={placeholder}/>{hint && <small>{hint}</small>}</label>;
}
function Check({ label, name, checked, hint }: { label: string; name: string; checked?: boolean; hint?: string }) {
  return <label className="check"><input type="checkbox" name={name} defaultChecked={checked}/><span>{label}{hint && <small>{hint}</small>}</span></label>;
}
function Stat({ label, value, note, featured, children }: { label: string; value: string; note: ReactNode; featured?: boolean; children?: ReactNode }) {
  return <article className={featured ? 'stat featured' : 'stat'}><span className="stat-label">{label}{featured && <span>↗</span>}</span><strong>{value}</strong>{children}<small>{note}</small></article>;
}

export default function App() {
  const [initial] = useState(() => loadData(localStorage));
  const [real, setReal] = useState(initial.data);
  const loadedRef = useRef(initial);
  const [loadError, setLoadError] = useState(initial.error);
  const [demo, setDemo] = useState(demoData);
  const [mode, setMode] = useState<'demo' | 'real'>('real');
  const [tab, setTab] = useState<Tab>('Resumen');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Shift | Fuel | Maintenance | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [reportMonth, setReportMonth] = useState(() => today().slice(0, 7));
  const importRef = useRef<HTMLInputElement>(null);
  const uberFileRef = useRef<HTMLInputElement>(null);
  const [uberPreview, setUberPreview] = useState<UberImportResult | null>(null);
  const [replaceConflicts, setReplaceConflicts] = useState(true);
  const data = mode === 'demo' ? demo : real;
  const invalidRange = Boolean(from && to && from > to);
  const filtered = filterData(data, from, to);
  const stats = summarize(filtered);
  // El consumo es del vehículo: se calcula con todas las cargas, no solo las del periodo.
  const economy = fuelEconomy(data.fuel);
  const profit = economy.costPerKm === null ? null : filtered.shifts.reduce((a, s) => a + estimatedProfit(s, economy.costPerKm!), 0);
  const odometer = currentOdometer(data);
  const statuses = maintenanceStatus(data, settings.intervals, today());
  const maintenanceAlerts = statuses.filter(s => s.status === 'pronto' || s.status === 'vencido');
  const envelope = envelopes(filtered, settings);
  const todayIncome = summarize({ ...emptyData(), shifts: data.shifts.filter(s => s.date === today()) }).income;
  const longShifts = settings.maxHours ? filtered.shifts.filter(s => s.hours > settings.maxHours).length : 0;
  const weekdays = byWeekday(filtered.shifts, economy.costPerKm);
  const weekdayRows = [...weekdays.slice(1), weekdays[0]];
  const maxWeekday = Math.max(0.01, ...weekdays.filter(w => w.enough && w.perHour !== null).map(w => w.perHour!));
  const slots = bySlot(filtered.shifts);
  const hasSlots = filtered.shifts.some(s => s.slots);
  const daysSinceBackup = settings.lastBackupAt ? Math.floor((Date.now() - Date.parse(settings.lastBackupAt)) / 86400000) : null;
  const realCount = real.shifts.length + real.fuel.length + real.maintenance.length;
  const backupDue = mode === 'real' && !loadError && realCount > 0 && (daysSinceBackup === null || (daysSinceBackup > 7 && settings.changedSinceBackup));
  const tabs: Tab[] = ['Resumen', 'Jornadas', 'Combustible', 'Mantenimiento', 'Mis datos'];
  const headings: Record<Tab, [string, string]> = {
    Resumen: ['Tu camino, en números.', 'Una mirada clara a tu trabajo y a tu vehículo.'],
    Jornadas: ['Registra tu jornada.', 'Anota cómo te fue al terminar de conducir.'],
    Combustible: ['Cada carga, bajo control.', 'Lleva un historial de tus compras de combustible.'],
    Mantenimiento: ['Cuida tu vehículo.', 'Registra cada servicio y recibe avisos según el manual de tu vehículo.'],
    'Mis datos': ['Tus datos, contigo.', 'Guarda una copia y ajusta tus metas.'],
  };
  const recent = [...filtered.shifts].sort((a, b) => b.date.localeCompare(a.date));
  const lastShift = [...data.shifts].sort((a, b) => b.date.localeCompare(a.date))[0];
  const chartDates = [...new Set(filtered.shifts.map(s => s.date))].sort().slice(-7);
  const chart = chartDates.map(date => ({ date, income: summarize({ ...emptyData(), shifts: filtered.shifts.filter(s => s.date === date) }).income }));
  const maxIncome = Math.max(1, ...chart.map(c => c.income));

  function navigate(next: Tab) { setTab(next); setEditing(null); setFormKey(k => k + 1); setMessage(''); setError(''); }
  function storeSettings(next: Settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
    setSettings(next);
  }
  function commit(next: Data, restoring = false) {
    setError(''); setMessage('');
    try {
      if (mode === 'demo') { setDemo(parseData(next)); return true; }
      loadedRef.current = saveData(localStorage, loadedRef.current, next, restoring);
      setReal(loadedRef.current.data); setLoadError('');
      if (!settings.changedSinceBackup) storeSettings({ ...settings, changedSinceBackup: true });
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar. Descarga un respaldo antes de cerrar.'); return false; }
  }
  function saved(noun: string, adjective = 'guardada') { setEditing(null); setFormKey(k => k + 1); setMessage(mode === 'demo' ? `${noun} de práctica ${adjective}. No afecta tus datos reales.` : `${noun} ${adjective} en este navegador.`); }
  function saveShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const s: Shift = { id: editing?.id ?? crypto.randomUUID(), date: String(form.get('date')), hours: Number(form.get('hours')), km: Number(form.get('km')), trips: Number(form.get('trips')), income: Number(form.get('income')), otherCosts: Number(form.get('otherCosts')), notes: String(form.get('notes')).trim(), odometerStart: optionalNumber(form.get('odometerStart')), odometerEnd: optionalNumber(form.get('odometerEnd')), setAside: Number(form.get('setAside')), slots: (editing as Shift | null)?.slots ?? null };
    const problem = shiftProblem(s);
    if (problem) { setError(problem); return; }
    if (!validShift(s)) { setError('Revisa las cifras y la fecha de la jornada.'); return; }
    if (commit({ ...data, shifts: editing ? data.shifts.map(r => r.id === s.id ? s : r) : [...data.shifts, s] })) {
      saved('Jornada');
      if (settings.maxHours && s.hours > settings.maxHours) setMessage(m => `${m} Ojo: superaste tus ${number(settings.maxHours)} horas máximas por jornada.`);
    }
  }
  function saveFuel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const f: Fuel = { id: editing?.id ?? crypto.randomUUID(), date: String(form.get('date')), gallons: Number(form.get('gallons')), cost: Number(form.get('cost')), odometer: Number(form.get('odometer')), notes: String(form.get('notes')).trim(), fullTank: form.get('fullTank') === 'on', invoice: form.get('invoice') === 'on', supplier: String(form.get('supplier') ?? '').trim() };
    if (!validFuel(f)) { setError('Revisa las cifras y la fecha de la carga.'); return; }
    const problem = fuelOdometerProblem(data.fuel, f);
    if (problem) { setError(problem); return; }
    if (commit({ ...data, fuel: editing ? data.fuel.map(r => r.id === f.id ? f : r) : [...data.fuel, f] })) saved('Carga');
  }
  function saveMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const m: Maintenance = { id: editing?.id ?? crypto.randomUUID(), date: String(form.get('date')), odometer: Number(form.get('odometer')), type: String(form.get('type')) as MaintenanceType, cost: Number(form.get('cost')), notes: String(form.get('notes')).trim(), invoice: form.get('invoice') === 'on', supplier: String(form.get('supplier') ?? '').trim() };
    if (!validMaintenance(m)) { setError('Revisa las cifras, el tipo y la fecha del mantenimiento.'); return; }
    if (commit({ ...data, maintenance: editing ? data.maintenance.map(r => r.id === m.id ? m : r) : [...data.maintenance, m] })) saved('Mantenimiento', 'guardado');
  }
  function remove(id: string, kind: 'shifts' | 'fuel' | 'maintenance') {
    if (!window.confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
    if (commit({ ...data, [kind]: data[kind].filter((r: { id: string }) => r.id !== id) })) { setEditing(null); setFormKey(k => k + 1); setMessage('Registro eliminado.'); }
  }
  function edit(row: Shift | Fuel | Maintenance) { setEditing(row); setFormKey(k => k + 1); setMessage(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function exportBackup() {
    const backup: Backup = { app: 'uber-driver-ai', mode, exportedAt: new Date().toISOString(), data };
    download(JSON.stringify(backup, null, 2), mode === 'real' ? `uber-driver-ai-respaldo-${today()}.json` : `uber-driver-ai-respaldo-demo-${today()}.json`);
    if (mode === 'real') storeSettings({ ...settings, lastBackupAt: backup.exportedAt, changedSinceBackup: false });
    setMessage('Respaldo descargado. Guárdalo en un lugar privado.');
  }
  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      if (mode !== 'real') throw new Error('Cambia a Mis registros para restaurar un respaldo.');
      if (file.size > 10000000) throw new Error('El respaldo supera el máximo de 10 MB.');
      const restored = parseBackup(await file.text());
      if (!window.confirm(`Este respaldo contiene ${restored.shifts.length} jornadas, ${restored.fuel.length} cargas y ${restored.maintenance.length} mantenimientos. Reemplazará tus ${real.shifts.length} jornadas, ${real.fuel.length} cargas y ${real.maintenance.length} mantenimientos actuales. ¿Restaurar?`)) return;
      if (commit(restored, true)) setMessage('Respaldo restaurado correctamente.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer el respaldo.'); }
    finally { if (importRef.current) importRef.current.value = ''; }
  }
  async function handleUberFile(file: File | undefined) {
    if (!file) return;
    setError(''); setMessage('');
    try {
      if (file.size > 20000000) throw new Error('El archivo CSV supera el máximo de 20 MB.');
      const text = await file.text();
      const parsed = parseUberCsv(text);
      setUberPreview(parsed);
      setReplaceConflicts(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo CSV de Uber.');
    } finally {
      if (uberFileRef.current) uberFileRef.current.value = '';
    }
  }
  function confirmUberImport() {
    if (!uberPreview) return;
    const imported = uberPreview.shifts;
    const existing = data.shifts;
    let nextShifts: Shift[];
    if (replaceConflicts) {
      const importedDates = new Set(imported.map(s => s.date));
      const kept = existing.filter(s => !importedDates.has(s.date));
      // Conserva el odómetro y lo apartado que se anotaron a mano en esa fecha.
      const merged = imported.map(s => {
        const previous = existing.find(e => e.date === s.date);
        if (!previous) return s;
        const withOdometer = { ...s, odometerStart: previous.odometerStart, odometerEnd: previous.odometerEnd, setAside: previous.setAside };
        return validShift(withOdometer) ? withOdometer : { ...s, setAside: previous.setAside };
      });
      nextShifts = [...kept, ...merged];
    } else {
      const existingDates = new Set(existing.map(s => s.date));
      const newOnly = imported.filter(s => !existingDates.has(s.date));
      nextShifts = [...existing, ...newOnly];
    }
    nextShifts.sort((a, b) => b.date.localeCompare(a.date));
    if (commit({ ...data, shifts: nextShifts })) {
      setMessage(`Se importaron ${imported.length} jornada(s) de Uber exitosamente.`);
      setUberPreview(null);
      navigate('Jornadas');
    }
  }

  function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    storeSettings({ ...settings, model: String(form.get('model') || '').trim(), plate: String(form.get('plate') || '').trim(), city: String(form.get('city') || '').trim() });
    setVehicleModalOpen(false);
    setMessage('Vehículo y preferencias guardadas en este dispositivo.');
  }
  function saveGoals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const next: Settings = { ...settings, dailyGoal: Number(form.get('dailyGoal')), maxHours: Number(form.get('maxHours')), maintenancePercent: Number(form.get('maintenancePercent')), taxPercent: Number(form.get('taxPercent')) };
    const problem = settingsProblem(next);
    if (problem) { setError(problem); return; }
    storeSettings(next); setMessage('Meta y apartados guardados en este dispositivo.');
  }
  function saveIntervals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const intervals = Object.fromEntries(Object.keys(settings.intervals).map(t => [t, { km: optionalNumber(form.get(`${t}-km`)) || null, months: optionalNumber(form.get(`${t}-months`)) || null }])) as Intervals;
    storeSettings({ ...settings, intervals }); setMessage('Intervalos de mantenimiento guardados en este dispositivo.');
  }
  function downloadReport() {
    download(monthlyReport(data, reportMonth), `uber-driver-ai-reporte-${reportMonth}.csv`, 'text/csv;charset=utf-8');
    setMessage(`Reporte de ${reportMonth} descargado.`);
  }
  const editShift = editing as Shift | null; const editFuel = editing as Fuel | null; const editMaintenance = editing as Maintenance | null;
  const formActions = (label: string) => <div className="form-actions"><button type="submit">{editing ? 'Guardar cambios' : label}</button>{editing && <button type="button" className="outline" onClick={() => { setEditing(null); setFormKey(k => k + 1); }}>Cancelar edición</button>}<small>{mode === 'demo' ? 'Se guardará solo en la demostración.' : 'Se guardará en este navegador.'}</small></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('Resumen'); }}><span className="brand-icon"><Icon kind="car"/></span><span>uber<span className="brand-sub">DRIVER AI</span></span></a>
      <p className="nav-label">TU ESPACIO DE CONDUCCIÓN</p>
      <nav aria-label="Navegación principal">{tabs.map((name, i) => <button key={name} className={tab === name ? 'nav-item active' : 'nav-item'} aria-current={tab === name ? 'page' : undefined} onClick={() => navigate(name)}><Icon kind={name}/>{name}<span className="nav-index">0{i + 1}</span></button>)}</nav>
      <div className="sidebar-bottom">
        <button type="button" className="vehicle-btn" onClick={() => setVehicleModalOpen(true)} title="Haz clic para personalizar tu vehículo">
          <Icon kind="car"/>
          <div>
            <strong>{settings.model || 'Configurar vehículo'}</strong>
            <small>{settings.city || settings.plate || 'Toca para personalizar'}</small>
          </div>
        </button>
        <div className="local-status"><span/> Proyecto local · v0.1.2</div>
      </div>
    </aside>
    <main>
      <header className="topbar"><span>MI BITÁCORA <span className="slash">/</span> <strong>{tab}</strong></span><span className="location">{settings.city ? <>{settings.city} <span>·</span> </> : null}USD</span></header>
      <div className="content">
        <div className="page-heading"><div><p className="eyebrow">CADA JORNADA CUENTA</p><h1>{headings[tab][0]}</h1><p className="subtitle">{headings[tab][1]}</p></div><span className="version-tag">PRIMERA VERSIÓN</span></div>
        <section className={mode === 'demo' ? 'mode-banner' : 'mode-banner real'} aria-label="Modo de datos"><div><strong>{mode === 'demo' ? 'Estás explorando datos de ejemplo' : 'Estás usando tus registros personales'}</strong><p>{mode === 'demo' ? 'Practica con cifras ficticias. Los cambios de práctica se reinician al recargar.' : 'Guardados en este navegador. Descarga respaldos para conservar una copia.'}</p></div><button className="outline" onClick={() => { setMode(mode === 'demo' ? 'real' : 'demo'); setEditing(null); setFormKey(k => k + 1); setMessage(''); setError(''); setFrom(''); setTo(''); }}>{mode === 'demo' ? 'Usar mis registros' : 'Ver demostración'} <span aria-hidden="true">↗</span></button></section>
        {loadError && mode === 'real' && <p className="alert error" role="alert">{loadError}</p>}
        {message && <p className="alert" role="status">{message}</p>}{error && <p className="alert error" role="alert">{error}</p>}
        {tab !== 'Mis datos' && <div className="period"><span>PERÍODO <strong>{!from && !to ? 'Todos los registros' : 'Personalizado'}</strong></span><div className="date-filters"><label>Desde <input aria-label="Desde" type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>Hasta <input aria-label="Hasta" type="date" value={to} onChange={e => setTo(e.target.value)}/></label>{(from || to) && <button className="text-button" onClick={() => { setFrom(''); setTo(''); }}>Quitar filtro</button>}</div></div>}
        {invalidRange && <p className="alert error" role="alert">La fecha Desde debe ser anterior o igual a Hasta.</p>}
        {tab === 'Resumen' && !invalidRange && <>
          {backupDue && <div className="alert warning alert-action" role="status"><span>{daysSinceBackup === null ? 'Todavía no has descargado un respaldo de tus registros.' : `Tu último respaldo fue hace ${daysSinceBackup} días y tienes cambios nuevos.`}</span><button className="outline" onClick={exportBackup}>Descargar respaldo</button></div>}
          {maintenanceAlerts.map(m => <div key={m.type} className={m.status === 'vencido' ? 'alert error alert-action' : 'alert warning alert-action'} role="status"><span>{maintenanceMessage(m)}</span><button className="outline" onClick={() => navigate('Mantenimiento')}>Ver mantenimiento</button></div>)}
          {longShifts > 0 && <p className="alert warning" role="status">{longShifts} jornada(s) del periodo superan tus {number(settings.maxHours)} horas máximas.</p>}
          <div className="stats">
            <Stat featured label="Saldo registrado" value={money(stats.balance)} note="Ingresos − combustible − otros gastos − mantenimiento"/>
            <Stat label="Ingresos del conductor" value={money(stats.income)} note="Después de la comisión de la plataforma"/>
            <Stat label="Compras de combustible" value={money(stats.fuel)} note={`${filtered.fuel.length} cargas registradas`}/>
            <Stat label="Ingresos por hora" value={stats.perHour === null ? '—' : money(stats.perHour)} note="Antes de combustible y otros gastos"/>
            <Stat label="Saldo por hora" value={stats.balancePerHour === null ? '—' : money(stats.balancePerHour)} note="Saldo registrado ÷ horas"/>
            <Stat label="Saldo por km" value={stats.balancePerKm === null ? '—' : perKm(stats.balancePerKm)} note={stats.shiftsWithoutOdometer ? `${stats.shiftsWithoutOdometer} jornada(s) sin odómetro usan km de viajes` : 'Saldo ÷ km totales del odómetro'}/>
            <Stat label="Gasto por km" value={stats.costPerKm === null ? '—' : perKm(stats.costPerKm)} note="Combustible + otros gastos + mantenimiento ÷ km"/>
            <Stat label="Km sin pasajero" value={stats.emptyShare === null ? '—' : percent(stats.emptyShare)} note={stats.emptyKm === null ? 'Anota el odómetro al iniciar y al terminar' : `${number(stats.emptyKm)} km buscando pasajeros o de traslado`}/>
            <Stat label="Consumo real" value={economy.kmPerGallon === null ? '—' : `${number(Math.round(economy.kmPerGallon * 10) / 10)} km/gal`} note={economy.costPerKm === null ? 'Necesita dos cargas con tanque lleno' : `Combustible: ${perKm(economy.costPerKm)} por km`}/>
            <Stat label="Ganancia estimada" value={profit === null ? '—' : money(profit)} note={profit === null ? 'Disponible con el consumo real' : 'Ingresos − km × costo de combustible − otros gastos. Sin mantenimiento.'}/>
            <Stat label="Meta de hoy" value={settings.dailyGoal ? `${money(todayIncome)} / ${money(settings.dailyGoal)}` : '—'} note={settings.dailyGoal ? (todayIncome >= settings.dailyGoal ? '¡Meta cumplida!' : `Faltan ${money(settings.dailyGoal - todayIncome)}`) : 'Configura tu meta en Mis datos'}>{settings.dailyGoal > 0 && <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, todayIncome / settings.dailyGoal) * 100)}><i style={{ width: `${Math.min(100, todayIncome / settings.dailyGoal * 100)}%` }}/></div>}</Stat>
            <Stat label="Apartados del periodo" value={settings.maintenancePercent || settings.taxPercent ? `${money(envelope.setAside)} / ${money(envelope.suggested)}` : '—'} note={settings.maintenancePercent || settings.taxPercent ? `Deberías haber apartado ${money(envelope.maintenance)} para mantenimiento y ${money(envelope.taxes)} para impuestos` : 'Configura los porcentajes en Mis datos'}/>
          </div>
          <div className="dashboard-grid"><section className="panel chart-panel"><div className="section-heading"><div><p className="eyebrow">TU ACTIVIDAD</p><h2>Así van tus ingresos</h2></div><span className="chart-legend"><i/> Ingresos USD</span></div><p className="muted">Últimos 7 días con jornadas dentro del período</p>{chart.length ? <div className="chart" role="img" aria-label={chart.map(c => `${dateLabel(c.date)}: ${money(c.income)}`).join('; ')}>{chart.map(c => <div className="bar-group" key={c.date}><span className="bar-value">{money(c.income)}</span><div className="bar-track"><div className="bar" style={{ height: `${Math.max(2, c.income / maxIncome * 100)}%` }}/></div><span className="bar-date">{dateLabel(c.date)}</span></div>)}</div> : <div className="empty"><Icon kind="Jornadas"/><h3>Tu primera jornada empieza aquí</h3><p>Registra una jornada para ver tus ingresos.</p><button onClick={() => navigate('Jornadas')}>Registrar jornada</button></div>}<div className="activity-strip"><span><b>{number(stats.trips)}</b> viajes</span><span><b>{number(stats.totalKm)}</b> km</span><span><b>{number(stats.hours)}</b> horas</span></div></section>
          <section className="panel next-panel"><span className="round-icon"><Icon kind="car"/></span><p className="eyebrow">TU COPILOTO DE REGISTRO</p><h2>Un pequeño hábito.<br/>Más claridad.</h2><p>Al empezar, mira el odómetro. Al terminar, anota tu jornada. Cuando cargues gasolina, marca si llenaste el tanque.</p><button onClick={() => navigate('Jornadas')}>+ Registrar jornada</button><button className="outline" onClick={() => navigate('Combustible')}>+ Registrar combustible</button><small>Usa la bitácora con el vehículo estacionado.</small></section></div>
          <section className="panel"><div className="section-heading"><h2>Últimas jornadas</h2><button className="text-button" onClick={() => navigate('Jornadas')}>Ver todas →</button></div>{recent.length ? <ShiftTable rows={recent.slice(0, 5)} fuelCostPerKm={economy.costPerKm}/> : <p className="muted">Todavía no hay jornadas en este período.</p>}</section>
          <section className="panel"><div className="section-heading"><div><p className="eyebrow">CUÁNDO CONVIENE MANEJAR</p><h2>Mejores días</h2></div></div>
            <p className="muted">{economy.costPerKm === null ? 'Ingresos menos otros gastos por hora (sin combustible, hasta que haya consumo real).' : 'Ganancia estimada por hora: descuenta el combustible según tu consumo real.'} Se compara cada día con al menos 3 jornadas.</p>
            {weekdays.some(w => w.enough) ? <div className="hbars">{weekdayRows.map(w => <div className="hbar" key={w.day}><span>{w.name}</span><div className="hbar-track">{w.enough && w.perHour !== null && <i style={{ width: `${Math.max(2, w.perHour / maxWeekday * 100)}%` }}/>}</div><b>{w.enough && w.perHour !== null ? `${money(w.perHour)}/h` : `Pocos datos (${w.shifts})`}</b><small>{w.enough && w.tripsPerHour !== null ? `${number(Math.round(w.tripsPerHour * 10) / 10)} viajes/h · ${w.shifts} jornadas` : ''}</small></div>)}</div> : <p className="muted">Todavía no hay suficientes jornadas. Necesitas al menos 3 jornadas en un mismo día de la semana.</p>}
            {hasSlots && <><h2 style={{ marginTop: '22px' }}>Franjas horarias (CSV de Uber)</h2><p className="muted">Según la hora de solicitud de cada viaje. El ingreso por hora usa solo el tiempo en viaje, no las esperas.</p><div className="table-scroll"><table><thead><tr><th>Franja</th><th>Jornadas</th><th>Viajes</th><th>Ingresos</th><th>Ingreso por hora en viaje</th></tr></thead><tbody>{slots.map(s => <tr key={s.name}><td><strong>{s.label}</strong></td><td>{s.shifts}</td><td>{s.trips}</td><td>{money(s.income)}</td><td className="income-cell">{s.enough && s.perHour !== null ? money(s.perHour) : 'Pocos datos'}</td></tr>)}</tbody></table></div></>}
          </section>
          <p className="calculation-note">El saldo registrado no es utilidad neta: resta compras de combustible, no consumo del período. Incluye el mantenimiento registrado, pero no depreciación, seguros ni impuestos salvo que los anotes como otros gastos. La ganancia estimada usa tu consumo real con tanque lleno. Los resúmenes son cálculos locales; esta versión todavía no incorpora un modelo de IA.</p>
        </>}
        {tab === 'Jornadas' && <>
          <section className="panel"><div className="section-heading"><h2>{editing ? 'Editar jornada' : 'Nueva jornada'}</h2><div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><button type="button" className="btn-import" onClick={() => uberFileRef.current?.click()}><Icon kind="upload"/> Importar de Uber (CSV)</button><span className="small-badge">REGISTRO MANUAL</span></div></div><form key={formKey} onSubmit={saveShift}><div className="form-grid">
            <Field label="Fecha de la jornada" name="date" type="date" value={editing?.date ?? today()}/>
            <Field label="Horas trabajadas" name="hours" value={editShift?.hours} min={0.01} max={24} hint="Incluye las esperas. Ejemplo: 6.5 = 6 h 30 min."/>
            <Field label="Viajes completados" name="trips" value={editShift?.trips} max={300} step="1"/>
            <Field label="Odómetro al iniciar (km)" name="odometerStart" required={false} max={2000000} step="1" value={editing ? editShift?.odometerStart : lastShift?.odometerEnd != null ? odometer : null} hint={odometer ? `Opcional. Último registrado: ${number(odometer)} km.` : 'Opcional. Lo que marca el tablero al salir.'}/>
            <Field label="Odómetro al terminar (km)" name="odometerEnd" required={false} max={2000000} step="1" value={editShift?.odometerEnd} hint="Opcional. Sirve para calcular los km sin pasajero."/>
            <Field label="Km de viajes (con pasajero)" name="km" value={editShift?.km} max={3000} hint="Lo que pagó Uber, según la app o anotado a mano."/>
            <Field label="Ingresos del conductor (USD)" name="income" value={editShift?.income} max={100000} hint="Después de comisión; incluye propinas y bonos una sola vez."/>
            <Field label="Otros gastos (USD)" name="otherCosts" value={editShift?.otherCosts ?? 0} max={100000} hint="Peajes, parqueo, etc. Excluye combustible y mantenimiento."/>
            <Field label="Ya lo aparté (USD)" name="setAside" required={false} value={editShift?.setAside ?? 0} max={100000} hint="Opcional. Lo que separaste hoy para mantenimiento e impuestos."/>
          </div><label className="field notes">Nota opcional<textarea name="notes" maxLength={500} defaultValue={editing?.notes} placeholder="Por ejemplo: jornada de la mañana"/></label>{formActions('Guardar jornada')}</form></section>
          <section className="panel"><div className="section-heading"><h2>Historial de jornadas</h2><span className="muted">{recent.length} registros en el período</span></div>{recent.length && !invalidRange ? <ShiftTable rows={recent} fuelCostPerKm={economy.costPerKm} onEdit={edit} onDelete={id => remove(id, 'shifts')}/> : <p className="muted">No hay jornadas para mostrar.</p>}</section>
        </>}
        {tab === 'Combustible' && <>
          <section className="panel"><div className="section-heading"><h2>{editing ? 'Editar carga' : 'Nueva carga'}</h2><span className="small-badge">REGISTRO MANUAL</span></div><form key={formKey} onSubmit={saveFuel}><div className="form-grid">
            <Field label="Fecha de la carga" name="date" type="date" value={editing?.date ?? today()}/>
            <Field label="Galones estadounidenses" name="gallons" value={editFuel?.gallons} min={0.001} max={100} step="0.001" hint="Copia la cantidad que figura en el recibo."/>
            <Field label="Total pagado (USD)" name="cost" value={editFuel?.cost} min={0.01} max={10000}/>
            <Field label="Odómetro (km)" name="odometer" value={editFuel?.odometer} max={2000000} hint="Kilometraje total que muestra tu vehículo."/>
            <Field label="Proveedor (opcional)" name="supplier" type="text" required={false} value={editFuel?.supplier} placeholder="Ej. nombre de la estación"/>
            <div className="checks"><Check label="Llené el tanque" name="fullTank" checked={editFuel?.fullTank} hint="Hasta que la bomba se detuvo. Así se calcula el consumo real."/><Check label="Tengo factura a mi RUC" name="invoice" checked={editFuel?.invoice}/></div>
          </div><label className="field notes">Nota opcional<textarea name="notes" maxLength={500} defaultValue={editing?.notes} placeholder="Por ejemplo: número de recibo"/></label>{formActions('Guardar carga')}</form></section>
          <section className="panel"><div className="section-heading"><h2>Historial de combustible</h2><span className="muted">{filtered.fuel.length} cargas en el período</span></div>{filtered.fuel.length && !invalidRange ? <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Galones</th><th>Total</th><th>USD / galón</th><th>Odómetro</th><th>Tanque lleno</th><th>Factura</th><th>Nota</th><th>Acciones</th></tr></thead><tbody>{[...filtered.fuel].sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer).map(f => <tr key={f.id}><td>{dateLabel(f.date)}<small>{f.date.slice(0, 4)}</small></td><td>{number(f.gallons)}</td><td><strong>{money(f.cost)}</strong></td><td>{money(f.cost / f.gallons)}</td><td>{number(f.odometer)} km</td><td>{f.fullTank ? 'Sí' : 'No'}</td><td>{f.invoice ? 'Sí' : 'No'}{f.supplier && <small>{f.supplier}</small>}</td><td className="note-cell">{f.notes || '—'}</td><td><div className="row-actions"><button className="text-button" onClick={() => edit(f)} aria-label={`Editar carga del ${f.date}`}>Editar</button><button className="text-button danger" onClick={() => remove(f.id, 'fuel')} aria-label={`Eliminar carga del ${f.date}`}>Eliminar</button></div></td></tr>)}</tbody></table></div> : <p className="muted">Todavía no hay cargas en este período.</p>}</section>
          <section className="panel"><div className="section-heading"><div><p className="eyebrow">MÉTODO DE TANQUE LLENO</p><h2>Consumo real</h2></div>{economy.kmPerGallon !== null && <span className="small-badge">{number(Math.round(economy.kmPerGallon * 10) / 10)} KM/GAL · {perKm(economy.costPerKm!)} POR KM</span>}</div>
            {economy.segments.length ? <div className="table-scroll"><table><thead><tr><th>Desde</th><th>Hasta</th><th>Km</th><th>Galones</th><th>Km / galón</th><th>Revisión</th></tr></thead><tbody>{[...economy.segments].reverse().map(s => <tr key={`${s.from}-${s.to}-${s.km}`}><td>{dateLabel(s.from)}<small>{s.from.slice(0, 4)}</small></td><td>{dateLabel(s.to)}<small>{s.to.slice(0, 4)}</small></td><td>{number(s.km)} km</td><td>{number(s.gallons)}</td><td><strong>{number(Math.round(s.kmPerGallon * 10) / 10)}</strong></td><td className={s.unusual ? 'danger' : undefined}>{s.unusual ? 'Fuera de lo normal: revisa el odómetro o si olvidaste una carga' : 'Normal'}</td></tr>)}</tbody></table></div> : <p className="muted">Marca «Llené el tanque» en dos cargas para ver tu primer tramo. Las cargas parciales entre ambas también se suman.</p>}
            <p className="calculation-note">El promedio usa los últimos 5 tramos normales. Costo por km = precio promedio por galón ÷ km por galón.</p></section>
        </>}
        {tab === 'Mantenimiento' && <>
          <section className="panel"><div className="section-heading"><h2>Próximos servicios</h2>{odometer !== null && <span className="small-badge">ODÓMETRO ACTUAL {number(odometer)} KM</span>}</div>
            {statuses.length ? <ul className="status-list">{statuses.map(s => <li key={s.type} className={s.status}><b>{s.status === 'vencido' ? 'Vencido' : s.status === 'pronto' ? 'Pronto' : s.status === 'ok' ? 'Al día' : 'Sin registro'}</b> {maintenanceMessage(s)}</li>)}</ul> : <p className="muted">Configura los intervalos de tu manual en <button className="text-button" onClick={() => navigate('Mis datos')}>Mis datos</button> para recibir avisos.</p>}</section>
          <section className="panel"><div className="section-heading"><h2>{editing ? 'Editar mantenimiento' : 'Nuevo mantenimiento'}</h2><span className="small-badge">REGISTRO MANUAL</span></div><form key={formKey} onSubmit={saveMaintenance}><div className="form-grid">
            <Field label="Fecha" name="date" type="date" value={editing?.date ?? today()}/>
            <label className="field">Tipo<select name="type" defaultValue={editMaintenance?.type ?? 'aceite'}>{MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{MAINTENANCE_LABELS[t]}</option>)}</select></label>
            <Field label="Odómetro (km)" name="odometer" value={editMaintenance?.odometer ?? odometer} max={2000000} step="1"/>
            <Field label="Costo (USD)" name="cost" value={editMaintenance?.cost} max={100000}/>
            <Field label="Proveedor (opcional)" name="supplier" type="text" required={false} value={editMaintenance?.supplier} placeholder="Ej. nombre del taller"/>
            <div className="checks"><Check label="Tengo factura a mi RUC" name="invoice" checked={editMaintenance?.invoice}/></div>
          </div><label className="field notes">Nota opcional<textarea name="notes" maxLength={500} defaultValue={editing?.notes} placeholder="Por ejemplo: aceite 5W-30, filtro incluido"/></label>{formActions('Guardar mantenimiento')}</form></section>
          <section className="panel"><div className="section-heading"><h2>Historial de mantenimiento</h2><span className="muted">{filtered.maintenance.length} registros · {money(stats.maintenance)}</span></div>{filtered.maintenance.length && !invalidRange ? <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Odómetro</th><th>Costo</th><th>Factura</th><th>Nota</th><th>Acciones</th></tr></thead><tbody>{[...filtered.maintenance].sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer).map(m => <tr key={m.id}><td>{dateLabel(m.date)}<small>{m.date.slice(0, 4)}</small></td><td><strong>{MAINTENANCE_LABELS[m.type]}</strong></td><td>{number(m.odometer)} km</td><td>{money(m.cost)}</td><td>{m.invoice ? 'Sí' : 'No'}{m.supplier && <small>{m.supplier}</small>}</td><td className="note-cell">{m.notes || '—'}</td><td><div className="row-actions"><button className="text-button" onClick={() => edit(m)} aria-label={`Editar mantenimiento del ${m.date}`}>Editar</button><button className="text-button danger" onClick={() => remove(m.id, 'maintenance')} aria-label={`Eliminar mantenimiento del ${m.date}`}>Eliminar</button></div></td></tr>)}</tbody></table></div> : <p className="muted">Todavía no hay mantenimientos en este período.</p>}<p className="calculation-note">Los costos de mantenimiento se restan del saldo registrado y entran en el gasto por km.</p></section>
        </>}
        {tab === 'Mis datos' && <div className="settings-grid">
          <section className="panel"><span className="round-icon"><Icon kind="Mis datos"/></span><h2>Una copia para estar tranquilo</h2><p>Descarga todos los registros del modo actual. Para restaurarlos, usa un respaldo de datos reales de esta aplicación.</p><p className="muted">{data.shifts.length} jornadas · {data.fuel.length} cargas · {data.maintenance.length} mantenimientos · {mode === 'demo' ? 'Datos de ejemplo' : 'Datos reales'}{mode === 'real' && <><br/>Último respaldo: {settings.lastBackupAt ? `${dateLabel(settings.lastBackupAt.slice(0, 10))} ${settings.lastBackupAt.slice(0, 4)}` : 'nunca'}</>}</p><div className="stack"><button onClick={exportBackup} disabled={Boolean(loadError) && mode === 'real'}>Descargar respaldo {mode === 'demo' ? 'de ejemplo' : ''}</button><button className="outline" disabled={mode === 'demo'} onClick={() => importRef.current?.click()}>Restaurar respaldo real</button><input ref={importRef} type="file" accept=".json,application/json" hidden onChange={e => void restore(e.target.files?.[0])}/>{loadError && loadedRef.current.raw && <button className="outline" onClick={() => download(loadedRef.current.raw!, 'uber-recuperacion.json')}>Descargar archivo de recuperación</button>}</div><p className="calculation-note">Restaurar reemplaza tus registros y pide confirmación. Descarga primero una copia de tus datos actuales.</p></section>
          <section className="panel"><span className="round-icon"><Icon kind="car"/></span><h2>Tu Vehículo y Preferencias</h2><p>Personaliza tu bitácora con los datos de tu vehículo y ciudad. Se almacenan 100% en este dispositivo para tu total privacidad.</p><form onSubmit={saveVehicle} style={{ marginTop: '14px' }}><div style={{ display: 'grid', gap: '14px' }}><label className="field">Modelo del vehículo<input name="model" type="text" defaultValue={settings.model} placeholder="Ej. Kia Stonic, Chevrolet Onix, etc."/></label><label className="field">Placa / ID (opcional)<input name="plate" type="text" defaultValue={settings.plate} placeholder="Ej. GXX-1234"/></label><label className="field">Ciudad / Ubicación<input name="city" type="text" defaultValue={settings.city} placeholder="Ej. Guayaquil, Quito, etc."/></label></div><div className="form-actions" style={{ marginTop: '16px' }}><button type="submit">Guardar preferencias</button></div></form></section>
          <section className="panel"><h2>Meta diaria y apartados</h2><p>Define cuánto quieres ganar al día y qué porcentaje de tus ingresos separas en sobres. Usa 0 para desactivar.</p><form key={`goals-${formKey}`} onSubmit={saveGoals}><div className="form-grid two">
            <Field label="Meta diaria de ingresos (USD)" name="dailyGoal" required={false} value={settings.dailyGoal} max={100000}/>
            <Field label="Horas máximas por jornada" name="maxHours" required={false} value={settings.maxHours} max={24} step="0.5"/>
            <Field label="% para mantenimiento" name="maintenancePercent" required={false} value={settings.maintenancePercent} max={100} step="0.5"/>
            <Field label="% para impuestos" name="taxPercent" required={false} value={settings.taxPercent} max={100} step="0.5" hint="Confirma el porcentaje con tu contador."/>
          </div><div className="form-actions"><button type="submit">Guardar meta y apartados</button></div></form></section>
          <section className="panel"><h2>Intervalos de mantenimiento</h2><p>Llénalos <strong>según el manual de tu vehículo</strong>. La app no sugiere valores. Deja vacío lo que no aplique.</p><form key={`intervals-${formKey}`} onSubmit={saveIntervals}><div className="interval-grid"><span/><b>Cada km</b><b>Cada meses</b>{(Object.keys(settings.intervals) as (keyof Intervals)[]).map(t => <div className="interval-row" key={t}><span>{MAINTENANCE_LABELS[t]}</span><input aria-label={`${MAINTENANCE_LABELS[t]}: km`} name={`${t}-km`} type="number" min={1} max={200000} step="1" defaultValue={settings.intervals[t].km ?? undefined}/><input aria-label={`${MAINTENANCE_LABELS[t]}: meses`} name={`${t}-months`} type="number" min={1} max={120} step="1" defaultValue={settings.intervals[t].months ?? undefined}/></div>)}</div><div className="form-actions"><button type="submit">Guardar intervalos</button></div></form></section>
          <section className="panel"><h2>Reporte del mes</h2><p>Descarga un CSV con ingresos, gastos con y sin factura, km y horas del mes para tu contador o para registrar tus compras.</p><div className="stack"><label className="field">Mes<input type="month" value={reportMonth} max={today().slice(0, 7)} onChange={e => setReportMonth(e.target.value)}/></label><button onClick={downloadReport} disabled={!/^\d{4}-\d{2}$/.test(reportMonth)}>Descargar reporte del mes</button></div><p className="calculation-note">Qué gastos son deducibles y cómo declarar tus ingresos de Uber lo confirma tu contador. La app solo ordena la información.</p></section>
          <section className="panel"><span className="badge-uber">UBER DRIVER</span><h2>Importar reporte de Uber</h2><p>Importa el archivo CSV oficial descargado desde <strong>drivers.uber.com</strong> (Extractos semanales o Actividad de viajes). Tu bitácora calculará viajes, ingresos, horas y km automáticamente.</p><div className="stack"><button onClick={() => uberFileRef.current?.click()}><Icon kind="upload"/> Seleccionar archivo CSV de Uber</button></div><p className="calculation-note">Tus datos se procesan 100% de manera local y privada en tu navegador. No se envían a ningún servidor externo.</p></section>
          <section className="panel privacy-panel"><h2>¿Dónde están mis datos?</h2><p>En el almacenamiento de este navegador y de esta dirección. El servidor (tu PC, Umbrel o Coolify) solo entrega la aplicación: no guarda tus registros. No hay cuenta ni sincronización entre dispositivos. Borrar los datos del navegador puede borrar tus registros. Usa siempre la misma dirección y perfil de navegador; evita el modo incógnito.</p><p>Cada dirección tiene su propio almacenamiento: lo que registres en 127.0.0.1 no aparece en tu dominio de Coolify. Para pasar tus datos, descarga un respaldo en una y restáuralo en la otra.</p><p>La aplicación no envía tus registros a Uber ni a OpenAI. Las copias descargadas no están cifradas; consérvalas en una carpeta privada. El acceso depende de tu dispositivo y del navegador.</p></section>
        </div>}
        <input ref={uberFileRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={e => void handleUberFile(e.target.files?.[0])}/>
        {uberPreview && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal">
            <div className="modal-header">
              <div>
                <span className="badge-uber">UBER DRIVER CSV</span>
                <h3 id="modal-title" style={{ marginTop: '6px' }}>Vista previa de importación</h3>
              </div>
              <button className="text-button" onClick={() => setUberPreview(null)} aria-label="Cerrar modal">✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <div className="modal-stat"><span>Jornadas</span><strong>{uberPreview.shifts.length}</strong></div>
                <div className="modal-stat"><span>Viajes</span><strong>{number(uberPreview.totalTrips)}</strong></div>
                <div className="modal-stat"><span>Horas</span><strong>{number(uberPreview.totalHours)} h</strong></div>
                <div className="modal-stat"><span>Ingresos</span><strong>{money(uberPreview.totalIncome)}</strong></div>
              </div>
              {uberPreview.dateRange && <p className="muted" style={{ margin: 0 }}>Período detectado: <strong>{dateLabel(uberPreview.dateRange.from)}</strong> a <strong>{dateLabel(uberPreview.dateRange.to)}</strong> ({uberPreview.rawRowCount} filas procesadas).</p>}
              {(() => {
                const existingDates = new Set(data.shifts.map(s => s.date));
                const conflicts = uberPreview.shifts.filter(s => existingDates.has(s.date)).length;
                return conflicts > 0 && <div className="conflict-warning">
                  ⚠️ <strong>{conflicts} jornada(s)</strong> de este archivo coinciden con fechas ya registradas.
                  <div className="modal-options" style={{ marginTop: '8px' }}>
                    <label><input type="radio" name="conflict-choice" checked={replaceConflicts} onChange={() => setReplaceConflicts(true)}/> Reemplazar las jornadas existentes en esas fechas con el CSV (se conservan el odómetro y lo apartado)</label>
                    <label><input type="radio" name="conflict-choice" checked={!replaceConflicts} onChange={() => setReplaceConflicts(false)}/> Conservar las existentes y solo importar fechas nuevas</label>
                  </div>
                </div>;
              })()}
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#274b3d' }}>Jornadas a incorporar:</h4>
                <div className="table-scroll" style={{ maxHeight: '200px' }}>
                  <table>
                    <thead><tr><th>Fecha</th><th>Viajes</th><th>Horas</th><th>Km</th><th>Ingreso</th></tr></thead>
                    <tbody>
                      {uberPreview.shifts.map(s => <tr key={s.id}><td><strong>{dateLabel(s.date)}</strong></td><td>{s.trips}</td><td>{number(s.hours)} h</td><td>{number(s.km)} km</td><td className="income-cell">{money(s.income)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="outline" onClick={() => setUberPreview(null)}>Cancelar</button>
              <button type="button" onClick={confirmUberImport}>Confirmar e importar ({uberPreview.shifts.length} jornadas)</button>
            </div>
          </div>
        </div>}
        {vehicleModalOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="vehicle-modal-title">
          <div className="modal">
            <div className="modal-header">
              <div>
                <span className="badge-uber">CONFIGURACIÓN</span>
                <h3 id="vehicle-modal-title" style={{ marginTop: '6px' }}>Tu Vehículo y Ubicación</h3>
              </div>
              <button className="text-button" onClick={() => setVehicleModalOpen(false)} aria-label="Cerrar modal">✕</button>
            </div>
            <form onSubmit={saveVehicle}>
              <div className="modal-body">
                <p className="muted" style={{ margin: 0 }}>
                  Configura los datos de tu vehículo y ciudad. Esta información vive únicamente en el almacenamiento local de este dispositivo y nunca se expone en repositorios públicos.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <label className="field">
                    Modelo de vehículo
                    <input name="model" type="text" defaultValue={settings.model} placeholder="Ej. Kia Stonic, Chevrolet Onix, etc." autoFocus />
                  </label>
                  <label className="field">
                    Placa o identificación (opcional)
                    <input name="plate" type="text" defaultValue={settings.plate} placeholder="Ej. GXX-1234" />
                  </label>
                  <label className="field">
                    Ciudad / Ubicación
                    <input name="city" type="text" defaultValue={settings.city} placeholder="Ej. Guayaquil, Quito, etc." />
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="outline" onClick={() => setVehicleModalOpen(false)}>Cancelar</button>
                <button type="submit">Guardar preferencias</button>
              </div>
            </form>
          </div>
        </div>}
        <footer><span>UBER DRIVER AI</span><span>{settings.city ? `Hecho para tu día a día en ${settings.city}.` : 'Hecho para tu día a día al volante.'}</span><span>Local · Personal · Soberano</span></footer>
      </div>
    </main>
  </div>;
}

function ShiftTable({ rows, fuelCostPerKm, onEdit, onDelete }: { rows: Shift[]; fuelCostPerKm: number | null; onEdit?: (s: Shift) => void; onDelete?: (id: string) => void }) {
  return <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Viajes</th><th>Horas</th><th>Km viajes</th><th>Km totales</th><th>Sin pasajero</th><th>Ingresos</th><th>Otros gastos</th>{fuelCostPerKm !== null && <th>Ganancia est.</th>}{onEdit && <><th>Nota</th><th>Acciones</th></>}</tr></thead><tbody>{rows.map(s => { const total = shiftTotalKm(s); return <tr key={s.id}><td><strong>{dateLabel(s.date)}</strong><small>{s.date.slice(0, 4)}</small></td><td>{s.trips}</td><td>{number(s.hours)} h</td><td>{number(s.km)} km</td><td>{total === null ? '—' : `${number(total)} km`}</td><td>{total ? percent((total - s.km) / total) : '—'}</td><td className="income-cell">{money(s.income)}</td><td>{money(s.otherCosts)}</td>{fuelCostPerKm !== null && <td>{money(estimatedProfit(s, fuelCostPerKm))}</td>}{onEdit && <><td className="note-cell">{s.notes || '—'}</td><td><div className="row-actions"><button className="text-button" onClick={() => onEdit(s)} aria-label={`Editar jornada del ${s.date}`}>Editar</button><button className="text-button danger" onClick={() => onDelete?.(s.id)} aria-label={`Eliminar jornada del ${s.date}`}>Eliminar</button></div></td></>}</tr>; })}</tbody></table></div>;
}
