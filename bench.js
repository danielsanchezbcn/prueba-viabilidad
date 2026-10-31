// bench.js — compara estrategias de escritura/lectura en bases temporales (no toca los datos de prueba).
// Solo datos sintéticos.

export const VARIANTS = [
  { id: 'V1', label: 'Filas largas (1 por valor), con 3 índices (como la prueba anterior)', shape: 'long', indexes: true, durability: 'default' },
  { id: 'V2', label: 'Filas largas, sin índices secundarios', shape: 'long', indexes: false, durability: 'default' },
  { id: 'V3', label: 'Filas largas, sin índices, durabilidad relajada', shape: 'long', indexes: false, durability: 'relaxed' },
  { id: 'V4', label: 'Filas anchas (1 por repetición, valores en una lista), sin índices', shape: 'wide', indexes: false, durability: 'default' },
  { id: 'V5', label: 'Filas anchas, sin índices, durabilidad relajada', shape: 'wide', indexes: false, durability: 'relaxed' },
];

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
const deleteDb = (name, factory) =>
  new Promise((res, rej) => {
    const r = factory.deleteDatabase(name);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
    r.onblocked = () => res();
  });

// Convierte las filas largas en filas anchas: una fila por repetición con la lista de valores por variable.
export function toWide(tables, variables) {
  const byRep = new Map();
  for (const rep of tables.repetitions) byRep.set(rep.id, { ...rep, values: new Array(variables).fill(null) });
  for (const v of tables.repvalues) byRep.get(v.repetitionId).values[v.variableIdx] = v.value;
  return { ...tables, repetitions: [...byRep.values()], repvalues: [] };
}

function openBench(name, variant, factory) {
  return new Promise((res, rej) => {
    const r = factory.open(name, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('players', { keyPath: 'id' });
      const s = d.createObjectStore('sessions', { keyPath: 'id' });
      const rp = d.createObjectStore('repetitions', { keyPath: 'id' });
      const rv = d.createObjectStore('repvalues', { keyPath: 'id' });
      if (variant.indexes) {
        s.createIndex('byPlayer', 'playerId');
        rp.createIndex('bySession', 'sessionId');
        rv.createIndex('byRepetition', 'repetitionId');
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// Media por sesión usando solo los datos leídos (patrón de uso real: agregar en memoria).
function sessionMeans(shape, repetitions, repvalues) {
  const repToSession = new Map();
  for (const r of repetitions) repToSession.set(r.id, r.sessionId);
  const acc = new Map();
  const add = (sid, value) => {
    const a = acc.get(sid) ?? [0, 0];
    a[0] += value;
    a[1] += 1;
    acc.set(sid, a);
  };
  if (shape === 'long') {
    for (const v of repvalues) add(repToSession.get(v.repetitionId), v.value);
  } else {
    for (const r of repetitions) for (const value of r.values) if (value !== null) add(r.sessionId, value);
  }
  let total = 0;
  let n = 0;
  for (const [, [s, c]] of acc) {
    total += s / c;
    n++;
  }
  return { sessions: n, checksum: Math.round(total * 1000) / 1000 };
}

export async function runVariant(variant, longTables, wideTables, factory = globalThis.indexedDB) {
  const name = `bench-1a-${variant.id}`;
  await deleteDb(name, factory);
  const tables = variant.shape === 'long' ? longTables : wideTables;
  const db = await openBench(name, variant, factory);
  const names = ['players', 'sessions', 'repetitions', 'repvalues'];
  let tx;
  try {
    tx = db.transaction(names, 'readwrite', { durability: variant.durability });
  } catch {
    tx = db.transaction(names, 'readwrite');
  }
  const done = txDone(tx);
  const t0 = performance.now();
  for (const n of names) {
    const st = tx.objectStore(n);
    for (const row of tables[n]) st.put(row);
  }
  await done;
  const t1 = performance.now();
  const rtx = db.transaction(['repetitions', 'repvalues'], 'readonly');
  const [repetitions, repvalues] = await Promise.all([req(rtx.objectStore('repetitions').getAll()), req(rtx.objectStore('repvalues').getAll())]);
  const agg = sessionMeans(variant.shape, repetitions, repvalues);
  const t2 = performance.now();
  db.close();
  await deleteDb(name, factory);
  return {
    id: variant.id,
    descripcion: variant.label,
    filasTotales: names.reduce((a, n) => a + tables[n].length, 0),
    msEscribir: Math.round(t1 - t0),
    msLeerYMediaPorSesion: Math.round(t2 - t1),
    sesionesCalculadas: agg.sessions,
    controlSumaDeMedias: agg.checksum,
  };
}
