// core.js — lógica pura (sin DOM ni IndexedDB). Probada con Node en /tests.
// Solo genera datos SINTÉTICOS. No contiene nada de jugadores reales.

export const FORMAT_ID = 'dashboard-backup-spike';
export const ENVELOPE_ID = 'dashboard-backup-spike-envelope';
export const FORMAT_VERSION = 1;
export const SCHEMA_VERSION = 1;
export const APP_VERSION = 'spike-1a';
export const DATA_STORES = ['players', 'sessions', 'repetitions', 'repvalues', 'meta'];
export const PBKDF2_ITERATIONS = 600000;

// ---------- Datos sintéticos ----------

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSynthetic({
  players = 40,
  sessionsPerPlayer = 60,
  repsPerSession = 5,
  variables = 19,
  seed = 1,
} = {}) {
  const rng = makeRng(seed);
  const tables = { players: [], sessions: [], repetitions: [], repvalues: [], meta: [] };
  let sid = 0;
  let rid = 0;
  let vid = 0;
  const base = Date.UTC(2024, 0, 1);
  for (let p = 1; p <= players; p++) {
    tables.players.push({
      id: p,
      jerseyName: `Jugador sintético ${String(p).padStart(2, '0')}`,
      active: true,
    });
    for (let s = 0; s < sessionsPerPlayer; s++) {
      sid++;
      const date = new Date(base + (s * 7 + (p % 7)) * 86400000).toISOString().slice(0, 10);
      tables.sessions.push({ id: sid, playerId: p, testId: 1 + (s % 5), date, status: 'valid' });
      for (let r = 1; r <= repsPerSession; r++) {
        rid++;
        tables.repetitions.push({ id: rid, sessionId: sid, repIndex: r, side: 'none' });
        for (let v = 0; v < variables; v++) {
          vid++;
          tables.repvalues.push({
            id: vid,
            repetitionId: rid,
            variableIdx: v,
            value: Math.round((50 + rng() * 100) * 1000) / 1000,
          });
        }
      }
    }
  }
  return tables;
}

export function countTables(tables) {
  const counts = {};
  for (const name of DATA_STORES) counts[name] = (tables[name] ?? []).length;
  return counts;
}

// ---------- Suma de verificación ----------

export function canonicalStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalStringify).join(',') + ']';
  return (
    '{' +
    Object.keys(v)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonicalStringify(v[k]))
      .join(',') +
    '}'
  );
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function checksumTables(tables) {
  const ordered = {};
  for (const name of DATA_STORES) ordered[name] = tables[name] ?? [];
  return sha256Hex(canonicalStringify(ordered));
}

// ---------- Construcción y validación de la copia ----------

export async function buildBackup(tables, createdAt = new Date().toISOString()) {
  const ordered = {};
  for (const name of DATA_STORES) ordered[name] = tables[name] ?? [];
  return {
    formatId: FORMAT_ID,
    formatVersion: FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt,
    counts: countTables(ordered),
    checksum: await checksumTables(ordered),
    tables: ordered,
  };
}

export async function validateBackup(inner) {
  const errors = [];
  if (!inner || typeof inner !== 'object') return { ok: false, errors: ['El fichero no es una copia válida.'] };
  if (inner.formatId !== FORMAT_ID) errors.push('Identificador de formato desconocido.');
  if (!Number.isInteger(inner.formatVersion) || inner.formatVersion > FORMAT_VERSION)
    errors.push('Versión de formato no soportada por esta aplicación.');
  if (!Number.isInteger(inner.schemaVersion) || inner.schemaVersion > SCHEMA_VERSION)
    errors.push('La copia es de una versión de esquema posterior a la de la aplicación.');
  if (!inner.tables || typeof inner.tables !== 'object') {
    errors.push('Faltan las tablas de datos.');
    return { ok: false, errors };
  }
  for (const name of DATA_STORES) {
    if (!Array.isArray(inner.tables[name])) errors.push(`Falta la tabla «${name}».`);
  }
  if (errors.length) return { ok: false, errors };
  const counts = countTables(inner.tables);
  for (const name of DATA_STORES) {
    if (inner.counts?.[name] !== counts[name])
      errors.push(`El recuento de «${name}» no coincide (${inner.counts?.[name]} declarado, ${counts[name]} real).`);
  }
  const checksum = await checksumTables(inner.tables);
  if (checksum !== inner.checksum) errors.push('La suma de verificación no coincide: el fichero está dañado o modificado.');
  return {
    ok: errors.length === 0,
    errors,
    summary: { createdAt: inner.createdAt, appVersion: inner.appVersion, schemaVersion: inner.schemaVersion, counts },
  };
}

// ---------- Codificación (gzip y cifrado opcionales) ----------

export function bytesToB64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function b64ToBytes(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

async function pipeBytes(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const gzipBytes = (bytes) => pipeBytes(bytes, new CompressionStream('gzip'));
const gunzipBytes = (bytes) => pipeBytes(bytes, new DecompressionStream('gzip'));

async function deriveKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encodeBackup(inner, { gzip = false, password = '' } = {}) {
  const json = JSON.stringify(inner);
  if (!gzip && !password) return { blob: new Blob([json], { type: 'application/json' }), encrypted: false, gzip: false };
  let bytes = new TextEncoder().encode(json);
  if (gzip) bytes = await gzipBytes(bytes);
  const envelope = {
    formatId: ENVELOPE_ID,
    formatVersion: 1,
    compression: gzip ? 'gzip' : 'none',
    encrypted: !!password,
  };
  if (password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
    envelope.kdf = { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS };
    envelope.cipher = 'AES-GCM-256';
    envelope.salt = bytesToB64(salt);
    envelope.iv = bytesToB64(iv);
    envelope.payload = bytesToB64(cipher);
  } else {
    envelope.payload = bytesToB64(bytes);
  }
  return { blob: new Blob([JSON.stringify(envelope)], { type: 'application/json' }), encrypted: !!password, gzip };
}

export function inspectBackupText(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw Object.assign(new Error('El fichero no es JSON válido.'), { code: 'NOT_JSON' });
  }
  return obj;
}

export async function decodeBackupObject(obj, password = '') {
  if (obj?.formatId !== ENVELOPE_ID) return { inner: obj, encrypted: false, compression: 'none' };
  let bytes;
  if (obj.encrypted) {
    if (!password) throw Object.assign(new Error('El fichero está cifrado: escribe la contraseña.'), { code: 'PASSWORD_REQUIRED' });
    const key = await deriveKey(password, b64ToBytes(obj.salt), obj.kdf?.iterations ?? PBKDF2_ITERATIONS);
    try {
      bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(obj.iv) }, key, b64ToBytes(obj.payload)));
    } catch {
      throw Object.assign(new Error('Contraseña incorrecta o fichero dañado.'), { code: 'BAD_PASSWORD' });
    }
  } else {
    bytes = b64ToBytes(obj.payload);
  }
  if (obj.compression === 'gzip') bytes = await gunzipBytes(bytes);
  const inner = JSON.parse(new TextDecoder().decode(bytes));
  return { inner, encrypted: !!obj.encrypted, compression: obj.compression ?? 'none' };
}
