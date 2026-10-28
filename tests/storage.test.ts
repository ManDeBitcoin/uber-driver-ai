import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyData, LEGACY_STORAGE_KEY, migrationBackupKey, STORAGE_KEY, today } from '../src/domain.ts';
import { loadData, saveData } from '../src/storage.ts';

const memory = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  return { items, getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => { items.set(k, v); } };
};
const v1 = JSON.stringify(JSON.parse(readFileSync(new URL('./fixtures/respaldo-v1-anonimizado.json', import.meta.url), 'utf8')).data);

test('la primera escritura sobre datos v1 copia el original a una clave de respaldo', () => {
  const store = memory({ [STORAGE_KEY]: v1 });
  const loaded = loadData(store);
  assert.equal(loaded.error, '');
  assert.equal(loaded.data.version, 3);
  const saved = saveData(store, loaded, loaded.data);
  assert.equal(store.items.get(migrationBackupKey(today())), v1);
  assert.equal(JSON.parse(store.items.get(STORAGE_KEY)!).version, 3);
  store.items.delete(migrationBackupKey(today()));
  saveData(store, saved, saved.data);
  assert.equal(store.items.has(migrationBackupKey(today())), false);
});
test('la primera escritura sobre datos v2 copia el original y guarda en v3 con gastos vacíos', () => {
  const v2 = JSON.stringify({ version: 2, shifts: JSON.parse(v1).shifts.map((s: object) => ({ ...s, odometerStart: null, odometerEnd: null, setAside: 0, slots: null })), fuel: [], maintenance: [] });
  const store = memory({ [STORAGE_KEY]: v2 });
  const loaded = loadData(store);
  assert.equal(loaded.error, '');
  assert.equal(loaded.data.shifts.length, 2);
  saveData(store, loaded, loaded.data);
  assert.equal(store.items.get(migrationBackupKey(today())), v2);
  const stored = JSON.parse(store.items.get(STORAGE_KEY)!);
  assert.equal(stored.version, 3);
  assert.deepEqual(stored.expenses, []);
});
test('no sobrescribe una copia de migración ya existente del mismo día', () => {
  const store = memory({ [STORAGE_KEY]: v1, [migrationBackupKey(today())]: 'anterior' });
  saveData(store, loadData(store), emptyData());
  assert.equal(store.items.get(migrationBackupKey(today())), 'anterior');
});
test('datos dañados no se sobrescriben al guardar', () => {
  const store = memory({ [STORAGE_KEY]: '{"version":2,"shifts":[{"id":1}]' });
  const loaded = loadData(store);
  assert.match(loaded.error, /No se pudieron leer/);
  assert.throws(() => saveData(store, loaded, emptyData()), /No se pudieron leer/);
  assert.equal(store.items.get(STORAGE_KEY), '{"version":2,"shifts":[{"id":1}]');
});
test('restaurar sobre datos dañados guarda primero una copia del texto dañado', () => {
  const damaged = '{"version":2,"shifts":"roto","fuel":[],"maintenance":[]}';
  const store = memory({ [STORAGE_KEY]: damaged });
  saveData(store, loadData(store), emptyData(), true);
  assert.equal(store.items.get(migrationBackupKey(today())), damaged);
  assert.deepEqual(JSON.parse(store.items.get(STORAGE_KEY)!), emptyData());
});
test('migra desde la clave anterior de Stonic sin confundirlo con otra pestaña', () => {
  const store = memory({ [LEGACY_STORAGE_KEY]: v1 });
  const loaded = loadData(store);
  assert.equal(loaded.data.shifts.length, 2);
  saveData(store, loaded, loaded.data);
  assert.equal(store.items.get(LEGACY_STORAGE_KEY), v1);
  assert.equal(store.items.get(migrationBackupKey(today())), v1);
});
test('detecta cambios hechos en otra pestaña', () => {
  const store = memory();
  const loaded = loadData(store);
  store.setItem(STORAGE_KEY, JSON.stringify(emptyData()));
  assert.throws(() => saveData(store, loaded, emptyData()), /otra pestaña/);
});
