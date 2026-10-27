import { emptyData, isCurrentFormat, LEGACY_STORAGE_KEY, migrationBackupKey, parseData, STORAGE_KEY, today } from './domain.ts';
import type { Data } from './domain.ts';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
/** stored: lo que había en STORAGE_KEY al cargar. raw: el texto original leído (puede venir de la clave anterior). */
export type Loaded = { data: Data; stored: string | null; raw: string | null; error: string };

export function loadData(store: Store): Loaded {
  let stored: string | null = null; let raw: string | null = null;
  try {
    stored = store.getItem(STORAGE_KEY);
    raw = stored ?? store.getItem(LEGACY_STORAGE_KEY);
    return { data: raw ? parseData(JSON.parse(raw)) : emptyData(), stored, raw, error: '' };
  } catch {
    return { data: emptyData(), stored, raw, error: 'No se pudieron leer tus datos. No los sobrescribiremos. Descarga el archivo de recuperación en Mis datos o restaura un respaldo válido.' };
  }
}

/**
 * Guarda en formato v2. Antes de la primera escritura sobre datos v1 (o dañados al restaurar)
 * copia el texto original en una clave de respaldo con la fecha.
 */
export function saveData(store: Store, loaded: Loaded, next: Data, restoring = false): Loaded {
  if (loaded.error && !restoring) throw new Error(loaded.error);
  if (store.getItem(STORAGE_KEY) !== loaded.stored) throw new Error('Tus datos cambiaron en otra pestaña. Recarga esta página antes de guardar para no perder esos cambios.');
  const validated = parseData(next);
  if (loaded.raw && (loaded.error || !isCurrentFormat(loaded.raw))) {
    const key = migrationBackupKey(today());
    if (store.getItem(key) === null) store.setItem(key, loaded.raw);
  }
  const raw = JSON.stringify(validated);
  store.setItem(STORAGE_KEY, raw);
  return { data: validated, stored: raw, raw, error: '' };
}
