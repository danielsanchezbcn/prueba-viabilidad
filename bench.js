// bench.js — compara estrategias de escritura/lectura en bases temporales (no toca los datos de prueba).
// Solo datos sintéticos.
//
// Verificación: tras escribir, se lee lo guardado en cada variante y se compara con los datos de ORIGEN
// (tablas largas generadas) en tres niveles: recuento de filas y de valores, resultados por sesión y por
// variable, resultados por sesión × variable (n y suma exacta en milésimas) y, además, cada par
// repetición × variable (valor esperado frente a valor leído). Se calculan resúmenes SHA-256 del conjunto por
// sesión × variable y del conjunto de pares repetición × variable. No se usa una media global única.

import { sha256Hex } from './core.js';

export const VARIANTS = [
  { id: 'V1', label: 'Filas largas (1 por valor), con 3 índices (como la prueba anterior)', shape: 'long', indexes: true, durability: 'default' },
  { id: 'V2', label: 'Filas largas, sin índices secundarios', shape: 'long', indexes: false, durability: 'default' },
  { id: 'V3', label: 'Filas largas, sin índices, durabilidad relajada', shape: 'long', indexes: false, durability: 'relaxed' },
  { id: 'V4', label: 'Filas anchas (1 por repetición, valores en una lista), sin índices', shape: 'wide', indexes: false, durability: 'default' },
  { id: 'V5', label: 'Filas anchas, sin índices, durabilidad relajada', shape: 'wide', indexes: false, durability: 'relaxed' },
];

const STORES = ['players', 'sessions', 'repetitions', 'repvalues'];

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

// ---------- Agregación exacta (enteros en milésimas) ----------

const milli = (value) => Math.round(value * 1000);

function addCell(cells, sessionId, variableIdx, value) {
  const key = `${sessionId}|${variableIdx}`;
  const c = cells.get(key);
  if (c) {
    c[0] += 1;
    c[1] += milli(value);
  } else {
    cells.set(key, [1, milli(value)]);
  }
}

function cellsFromLong(repetitions, repvalues) {
  const repToSession = new Map();
  for (const r of repetitions) repToSession.set(r.id, r.sessionId);
  const cells = new Map();
  let values = 0;
  for (const v of repvalues) {
    addCell(cells, repToSession.get(v.repetitionId), v.variableIdx, v.value);
    values++;
  }
  return { cells, values };
}

function cellsFromWide(repetitions) {
  const cells = new Map();
  let values = 0;
  for (const r of repetitions) {
    r.values.forEach((value, variableIdx) => {
      if (value !== null) {
        addCell(cells, r.sessionId, variableIdx, value);
        values++;
      }
    });
  }
  return { cells, values };
}

function rollup(cells) {
  const perSession = new Map();
  const perVariable = new Map();
  for (const [key, [n, sum]] of cells) {
    const [sid, v] = key.split('|');
    for (const [map, k] of [[perSession, sid], [perVariable, v]]) {
      const c = map.get(k);
      if (c) {
        c[0] += n;
        c[1] += sum;
      } else {
        map.set(k, [n, sum]);
      }
    }
  }
  return { perSession, perVariable };
}

// ---------- Pares repetición × variable ----------

const PAIR_STRIDE = 1024; // las variables por repetición son < 1024
const pairKey = (repetitionId, variableIdx) => repetitionId * PAIR_STRIDE + variableIdx;

function pairsFromLong(repvalues) {
  const pairs = new Map();
  let duplicates = 0;
  for (const r of repvalues) {
    const k = pairKey(r.repetitionId, r.variableIdx);
    if (pairs.has(k)) duplicates++;
    pairs.set(k, milli(r.value));
  }
  return { pairs, duplicates };
}

function pairsFromWide(repetitions) {
  const pairs = new Map();
  let duplicates = 0;
  for (const rep of repetitions) {
    rep.values.forEach((value, variableIdx) => {
      if (value !== null) {
        const k = pairKey(rep.id, variableIdx);
        if (pairs.has(k)) duplicates++;
        pairs.set(k, milli(value));
      }
    });
  }
  return { pairs, duplicates };
}

async function pairsDigest(pairs) {
  const keys = Float64Array.from(pairs.keys());
  keys.sort();
  const parts = new Array(keys.length);
  for (let i = 0; i < keys.length; i++) parts[i] = keys[i] + ':' + pairs.get(keys[i]);
  return sha256Hex(parts.join(','));
}

function diffPairs(expected, got, duplicates, examples) {
  let missing = 0;
  let extra = 0;
  let different = 0;
  const push = (k, e, g, motivo) => {
    if (examples.length < 5) {
      examples.push({
        nivel: 'repetición×variable',
        motivo,
        repeticion: Math.floor(k / PAIR_STRIDE),
        variable: k % PAIR_STRIDE,
        valorEsperado: e === undefined ? null : e / 1000,
        valorLeido: g === undefined ? null : g / 1000,
      });
    }
  };
  for (const [k, e] of expected) {
    if (!got.has(k)) {
      missing++;
      push(k, e, undefined, 'falta en lo leído');
    } else if (got.get(k) !== e) {
      different++;
      push(k, e, got.get(k), 'valor distinto');
    }
  }
  for (const [k, g] of got) {
    if (!expected.has(k)) {
      extra++;
      push(k, undefined, g, 'sobra en lo leído');
    }
  }
  return {
    esperados: expected.size,
    leidos: got.size,
    comprobados: expected.size + extra,
    distintos: missing + extra + different + duplicates,
    faltantes: missing,
    sobrantes: extra,
    valorDistinto: different,
    duplicados: duplicates,
  };
}

async function digestOf(cells) {
  const rows = [...cells].map(([key, [n, sum]]) => [key, n, sum]);
  rows.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  return sha256Hex(JSON.stringify(rows));
}

function diffMaps(expected, got, level, examples) {
  let different = 0;
  for (const k of new Set([...expected.keys(), ...got.keys()])) {
    const a = expected.get(k);
    const b = got.get(k);
    if (!a || !b || a[0] !== b[0] || a[1] !== b[1]) {
      different++;
      if (examples.length < 5) {
        examples.push({
          nivel: level,
          clave: k,
          esperado: a ? { n: a[0], sumaMilesimas: a[1] } : null,
          leido: b ? { n: b[0], sumaMilesimas: b[1] } : null,
        });
      }
    }
  }
  return { esperados: expected.size, leidos: got.size, distintos: different };
}

// Referencia calculada UNA vez a partir de las tablas largas de origen (independiente de la base de datos).
export async function buildReference(longTables) {
  const { cells, values } = cellsFromLong(longTables.repetitions, longTables.repvalues);
  const { perSession, perVariable } = rollup(cells);
  const { pairs } = pairsFromLong(longTables.repvalues);
  return {
    cells,
    perSession,
    perVariable,
    pairs,
    digest: await digestOf(cells),
    pairsDigest: await pairsDigest(pairs),
    expected: {
      players: longTables.players.length,
      sessions: longTables.sessions.length,
      repetitions: longTables.repetitions.length,
      values,
      variables: perVariable.size,
      cells: cells.size,
      pairs: pairs.size,
    },
  };
}

// ---------- Ejecución de una variante ----------

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

// Abre la transacción de escritura y documenta qué durabilidad se aplicó de verdad.
function openWriteTx(db, variant) {
  const info = {
    solicitada: variant.durability,
    atributoExpuesto: false,
    opcionAceptada: true,
    efectiva: null,
  };
  let tx;
  try {
    tx = db.transaction(STORES, 'readwrite', { durability: variant.durability });
  } catch (e) {
    info.opcionAceptada = false;
    info.errorOpcion = e?.message ?? String(e);
    tx = db.transaction(STORES, 'readwrite'); // se usa el valor por defecto
  }
  info.efectiva = tx.durability ?? null;
  info.atributoExpuesto = tx.durability !== undefined;
  if (variant.durability !== 'relaxed') {
    info.relajadaAplicada = null;
    info.resumen = `Solicitada: ${variant.durability} (valor por defecto del navegador) · efectiva: ${info.efectiva ?? 'no expuesta por el navegador'}.`;
  } else if (!info.opcionAceptada) {
    info.relajadaAplicada = false;
    info.resumen = 'Solicitada: relaxed · el navegador rechazó la opción; se usó el valor por defecto.';
  } else if (info.efectiva === 'relaxed') {
    info.relajadaAplicada = true;
    info.resumen = 'Solicitada: relaxed · efectiva según el navegador: relaxed · aplicada: sí (la especificación la define como indicación al navegador).';
  } else if (info.efectiva === null) {
    info.relajadaAplicada = null;
    info.resumen = 'Solicitada: relaxed · el navegador no expone la durabilidad efectiva: no se puede confirmar si se aplicó.';
  } else {
    info.relajadaAplicada = false;
    info.resumen = `Solicitada: relaxed · efectiva según el navegador: ${info.efectiva} · NO aplicada.`;
  }
  return { tx, info };
}

export async function runVariant(variant, { longTables, wideTables }, reference, factory = globalThis.indexedDB) {
  const name = `bench-1a-${variant.id}`;
  await deleteDb(name, factory);
  const tables = variant.shape === 'long' ? longTables : wideTables;
  let db = null;
  try {
    db = await openBench(name, variant, factory);
    const { tx, info } = openWriteTx(db, variant);
    const done = txDone(tx);
    const t0 = performance.now();
    for (const n of STORES) {
      const st = tx.objectStore(n);
      for (const row of tables[n]) st.put(row);
    }
    await done;
    const t1 = performance.now();

    // Lectura de lo guardado (recuentos independientes con count() y filas con getAll()).
    const rtx = db.transaction(STORES, 'readonly');
    const counted = {};
    const rows = {};
    await Promise.all(
      STORES.map(async (n) => {
        counted[n] = await req(rtx.objectStore(n).count());
        rows[n] = await req(rtx.objectStore(n).getAll());
      }),
    );
    const t2 = performance.now();
    const agg = variant.shape === 'long' ? cellsFromLong(rows.repetitions, rows.repvalues) : cellsFromWide(rows.repetitions);
    const t3 = performance.now();
    const got = variant.shape === 'long' ? pairsFromLong(rows.repvalues) : pairsFromWide(rows.repetitions);

    // Verificación contra los datos de origen.
    const e = reference.expected;
    const expectedRows = { players: e.players, sessions: e.sessions, repetitions: e.repetitions, repvalues: variant.shape === 'long' ? e.values : 0 };
    const gotRows = Object.fromEntries(STORES.map((n) => [n, rows[n].length]));
    const rowsOk = STORES.every((n) => expectedRows[n] === counted[n] && expectedRows[n] === gotRows[n]);
    const examples = [];
    const roll = rollup(agg.cells);
    const byCell = diffMaps(reference.cells, agg.cells, 'sesión×variable', examples);
    const bySession = diffMaps(reference.perSession, roll.perSession, 'sesión', examples);
    const byVariable = diffMaps(reference.perVariable, roll.perVariable, 'variable', examples);
    const digest = await digestOf(agg.cells);
    const pairExamples = [];
    const byPair = diffPairs(reference.pairs, got.pairs, got.duplicates, pairExamples);
    const gotPairsDigest = await pairsDigest(got.pairs);
    const ok =
      rowsOk &&
      agg.values === e.values &&
      byCell.distintos === 0 &&
      bySession.distintos === 0 &&
      byVariable.distintos === 0 &&
      digest === reference.digest &&
      byPair.distintos === 0 &&
      gotPairsDigest === reference.pairsDigest;
    const t4 = performance.now();

    return {
      id: variant.id,
      descripcion: variant.label,
      durabilidad: info,
      filasTotales: STORES.reduce((a, n) => a + gotRows[n], 0),
      msEscribir: Math.round(t1 - t0),
      msLeer: Math.round(t2 - t1),
      msAgregar: Math.round(t3 - t2),
      msVerificar: Math.round(t4 - t3),
      verificacion: {
        ok,
        filas: { esperadas: expectedRows, contadasEnBD: counted, leidas: gotRows, coinciden: rowsOk },
        valores: { esperados: e.values, leidos: agg.values },
        porSesion: bySession,
        porVariable: byVariable,
        porSesionYVariable: byCell,
        resumenSha256: { esperado: reference.digest.slice(0, 16) + '…', leido: digest.slice(0, 16) + '…', coincide: digest === reference.digest },
        ejemplosDeDiferencias: examples,
        porRepeticionYVariable: byPair,
        resumenSha256Pares: {
          esperado: reference.pairsDigest.slice(0, 16) + '…',
          leido: gotPairsDigest.slice(0, 16) + '…',
          coincide: gotPairsDigest === reference.pairsDigest,
        },
        ejemplosDeDiferenciasPares: pairExamples,
      },
    };
  } finally {
    try {
      db?.close();
    } catch {
      /* ya cerrada */
    }
    await deleteDb(name, factory);
  }
}
