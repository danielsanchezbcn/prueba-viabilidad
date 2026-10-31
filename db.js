// db.js — IndexedDB sin librerías (para la prueba). La app real usará Dexie.
import { DATA_STORES } from './core.js';

const DB_NAME = 'viabilidad-1a';
const DB_VERSION = 1;

const req = (r) =>
  new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

const txDone = (tx) =>
  new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error('Transacción abortada'));
  });

export function openDb(factory = globalThis.indexedDB) {
  return new Promise((res, rej) => {
    const r = factory.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('players', { keyPath: 'id' });
      d.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byPlayer', 'playerId');
      d.createObjectStore('repetitions', { keyPath: 'id' }).createIndex('bySession', 'sessionId');
      d.createObjectStore('repvalues', { keyPath: 'id' }).createIndex('byRepetition', 'repetitionId');
      d.createObjectStore('meta', { keyPath: 'key' });
      // «handles»: ajustes locales (carpeta recordada, última apertura). NO forma parte de la copia.
      d.createObjectStore('handles', { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('Apertura bloqueada: cierra otras pestañas de esta página.'));
  });
}

// Reemplazo atómico: si algo falla, la transacción se aborta y los datos previos quedan intactos.
export async function replaceAll(d, tables) {
  const tx = d.transaction(DATA_STORES, 'readwrite');
  const done = txDone(tx);
  try {
    for (const name of DATA_STORES) {
      const st = tx.objectStore(name);
      st.clear();
      for (const row of tables[name] ?? []) st.put(row);
    }
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* ya abortada */
    }
    await done.catch(() => {});
    throw e;
  }
  return done;
}

export async function readAll(d) {
  const tx = d.transaction(DATA_STORES, 'readonly');
  const out = {};
  await Promise.all(DATA_STORES.map(async (n) => (out[n] = await req(tx.objectStore(n).getAll()))));
  return out;
}

export async function countAll(d) {
  const tx = d.transaction(DATA_STORES, 'readonly');
  const out = {};
  await Promise.all(DATA_STORES.map(async (n) => (out[n] = await req(tx.objectStore(n).count()))));
  return out;
}

export async function clearAll(d) {
  const tx = d.transaction(DATA_STORES, 'readwrite');
  const done = txDone(tx);
  for (const n of DATA_STORES) tx.objectStore(n).clear();
  return done;
}

export async function getMeta(d, key) {
  const r = await req(d.transaction('meta', 'readonly').objectStore('meta').get(key));
  return r?.value;
}

export async function getKv(d, key) {
  const r = await req(d.transaction('handles', 'readonly').objectStore('handles').get(key));
  return r?.value;
}

export async function putKv(d, key, value) {
  const tx = d.transaction('handles', 'readwrite');
  const done = txDone(tx);
  tx.objectStore('handles').put({ key, value });
  return done;
}
