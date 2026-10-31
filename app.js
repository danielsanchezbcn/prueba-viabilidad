import * as core from './core.js';
import * as db from './db.js';
import * as bench from './bench.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString('es-ES');
const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
const results = {};
let database = null;
let pendingRestore = null; // { inner, summary }

// ---------- Utilidades de interfaz ----------

function log(msg, level = 'info') {
  const t = new Date().toLocaleTimeString('es-ES');
  const tag = level === 'error' ? 'ERROR: ' : '';
  if (level === 'ok') msg = msg.replace(/^Correcto: /, '');
  if (level === 'ok') msg = 'Correcto: ' + msg;
  const el = $('log');
  el.textContent += `[${t}] ${tag}${msg}\n`;
  el.scrollTop = el.scrollHeight;
}

function setStatus(id, text, level = '') {
  const el = $(id);
  el.textContent = text;
  el.className = 'status' + (level ? ' ' + level : '');
}

async function busy(buttonIds, fn) {
  const buttons = buttonIds.map($);
  buttons.forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (e) {
    if (e?.name === 'AbortError') {
      log('Operación cancelada por el usuario.');
    } else {
      log(e?.message || String(e), 'error');
    }
  } finally {
    buttons.forEach((b) => (b.disabled = false));
    $('btn-restore').disabled = !pendingRestore;
  }
}

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

// ---------- 1. Entorno ----------

async function showEnv() {
  const brands = navigator.userAgentData?.brands?.filter((b) => !/not.?a.?brand/i.test(b.brand)).map((b) => `${b.brand} ${b.version}`).join(', ');
  const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const yn = (v) => (v ? 'sí' : 'no');
  const env = {
    origen: location.origin === 'null' ? '(sin origen: abierto desde disco)' : location.origin,
    protocolo: location.protocol,
    contextoSeguro: yn(window.isSecureContext),
    navegador: brands || navigator.userAgent,
    sistema: navigator.userAgentData?.platform || navigator.platform || 'desconocido',
    indexedDB: yn('indexedDB' in window),
    webCrypto: yn(globalThis.crypto?.subtle),
    compresionGzip: yn(typeof CompressionStream !== 'undefined'),
    selectorDeFicheros: yn('showSaveFilePicker' in window),
    selectorDeCarpetas: yn('showDirectoryPicker' in window),
    persistenciaConcedida: persisted === null ? 'no disponible' : yn(persisted),
    espacioUsado: est ? mb(est.usage) : 'no disponible',
    cuotaEstimada: est ? mb(est.quota) : 'no disponible',
  };
  results.entorno = env;
  const labels = {
    origen: 'Origen',
    protocolo: 'Protocolo',
    contextoSeguro: 'Contexto seguro (HTTPS)',
    navegador: 'Navegador',
    sistema: 'Sistema',
    indexedDB: 'IndexedDB disponible',
    webCrypto: 'Cifrado (Web Crypto)',
    compresionGzip: 'Compresión gzip',
    selectorDeFicheros: 'Guardar en ubicación elegida',
    selectorDeCarpetas: 'Recordar carpeta',
    persistenciaConcedida: 'Persistencia concedida',
    espacioUsado: 'Espacio usado por este sitio',
    cuotaEstimada: 'Cuota estimada del sitio',
  };
  const dl = $('env');
  dl.replaceChildren();
  for (const [k, v] of Object.entries(env)) {
    const dt = document.createElement('dt');
    dt.textContent = labels[k];
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  const warn = $('env-warn');
  warn.replaceChildren();
  const addWarn = (t) => {
    const p = document.createElement('p');
    p.className = 'warn-box';
    p.textContent = t;
    warn.append(p);
  };
  if (location.protocol === 'file:') addWarn('Estás abriendo la página desde el disco. Esta prueba no es válida: súbela a una URL HTTPS y ábrela desde allí.');
  else if (!window.isSecureContext) addWarn('La página no está en un contexto seguro (HTTPS). El cifrado y el selector de ficheros pueden no funcionar.');
  if (!('showSaveFilePicker' in window)) addWarn('Este navegador no permite elegir la ubicación de guardado: las copias se descargarán a la carpeta de descargas. Usa Chrome o Edge.');
  addWarn('No uses ventanas privadas o de incógnito para esta prueba: los datos se borran al cerrarlas.');
}

// ---------- 2. Persistencia ----------

async function requestPersistence() {
  if (!navigator.storage?.persist) {
    setStatus('persist-status', 'Este navegador no ofrece la función de persistencia.', 'fail');
    results.persistencia = { disponible: false };
    return;
  }
  const antes = await navigator.storage.persisted();
  const concedida = await navigator.storage.persist();
  const despues = await navigator.storage.persisted();
  results.persistencia = { antes, respuesta: concedida, despues };
  if (despues) setStatus('persist-status', 'Correcto: el navegador marca el almacenamiento de este sitio como persistente.', 'ok');
  else setStatus('persist-status', 'No concedida: el navegador puede borrar estos datos si falta espacio. Las copias de seguridad siguen siendo imprescindibles.', 'warn');
  log(`Persistencia: antes=${antes}, respuesta=${concedida}, después=${despues}`, despues ? 'ok' : 'info');
  await showEnv();
}

// ---------- 3. Datos sintéticos ----------

async function refreshFound(isStartup = false) {
  const counts = await db.countAll(database);
  const marker = await db.getMeta(database, 'marker');
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (marker) {
    setStatus('found', `Hay datos de prueba guardados: creados el ${new Date(marker.createdAt).toLocaleString('es-ES')} · ${fmt(counts.players)} jugadores, ${fmt(counts.sessions)} sesiones, ${fmt(counts.repvalues)} valores.`, 'ok');
  } else if (total > 0) {
    setStatus('found', `Hay ${fmt(total)} registros sin marca de creación.`, 'warn');
  } else {
    setStatus('found', 'No hay datos de prueba guardados todavía.');
  }
  if (isStartup) {
    results.alAbrir = { datosEncontrados: !!marker, creadosEl: marker?.createdAt ?? null, recuentos: counts };
    log(marker ? `Al abrir: datos de una sesión anterior encontrados (creados el ${marker.createdAt}).` : 'Al abrir: no había datos de prueba.', marker ? 'ok' : 'info');
  }
  return counts;
}

const intVal = (id, min, max) => {
  const n = Number($(id).value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Valor no válido en «${$(id).labels?.[0]?.firstChild?.textContent?.trim() ?? id}»: debe ser un entero entre ${min} y ${max}.`);
  return n;
};

async function generate() {
  const params = {
    players: intVal('n-players', 1, 200),
    sessionsPerPlayer: intVal('n-sessions', 1, 500),
    repsPerSession: intVal('n-reps', 1, 20),
    variables: intVal('n-vars', 1, 60),
    seed: 1,
  };
  const existing = await db.countAll(database);
  if (existing.players > 0 && !confirm('Ya hay datos de prueba. Generar nuevos datos los reemplaza. ¿Continuar?')) return;
  setStatus('data-status', 'Generando y guardando… puede tardar unos segundos.');
  const usoAntes = (await navigator.storage?.estimate?.())?.usage ?? null;
  const t0 = performance.now();
  const tables = core.generateSynthetic(params);
  const counts = core.countTables(tables);
  counts.meta = 1;
  tables.meta = [{ key: 'marker', value: { createdAt: new Date().toISOString(), params, counts } }];
  const t1 = performance.now();
  await db.replaceAll(database, tables);
  const t2 = performance.now();
  const usoDespues = (await navigator.storage?.estimate?.())?.usage ?? null;
  const msg = `Correcto: ${fmt(counts.repvalues)} valores guardados (generar ${Math.round(t1 - t0)} ms, guardar ${Math.round(t2 - t1)} ms).`;
  setStatus('data-status', msg, 'ok');
  results.generacion = {
    params,
    recuentos: counts,
    msGenerar: Math.round(t1 - t0),
    msGuardar: Math.round(t2 - t1),
    usoAntes: usoAntes === null ? null : mb(usoAntes),
    usoDespues: usoDespues === null ? null : mb(usoDespues),
  };
  log(msg + (usoAntes !== null ? ` Uso estimado del sitio: ${mb(usoAntes)} → ${mb(usoDespues)} (estimación del navegador, aproximada).` : ''), 'ok');
  await refreshFound();
  await showEnv();
}

async function countRecords() {
  const counts = await refreshFound();
  setStatus('data-status', `Recuento: ${Object.entries(counts).map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}`);
  log(`Recuento: ${JSON.stringify(counts)}`);
}

async function deleteData() {
  if (!confirm('Se borrarán todos los datos de prueba de este navegador (no la carpeta recordada). ¿Continuar?')) return;
  await db.clearAll(database);
  setStatus('data-status', 'Datos de prueba borrados.', 'ok');
  results.borrado = { ok: true, recuentos: await db.countAll(database) };
  log('Datos de prueba borrados.', 'ok');
  await refreshFound();
  await showEnv();
}

// ---------- 4. Copia de seguridad ----------

function backupOptions() {
  const gzip = $('opt-gzip').checked;
  const encrypt = $('opt-pass-on').checked;
  const password = encrypt ? $('pass-backup').value : '';
  if (encrypt && password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  return { gzip, password, encrypt };
}

async function makeBackup() {
  const opts = backupOptions();
  const t0 = performance.now();
  const tables = await db.readAll(database);
  const total = Object.values(core.countTables(tables)).reduce((a, b) => a + b, 0);
  if (total === 0) throw new Error('No hay datos que copiar. Genera datos de prueba primero.');
  const inner = await core.buildBackup(tables);
  const { blob } = await core.encodeBackup(inner, { gzip: opts.gzip, password: opts.password });
  const name = `copia-prueba-${stamp()}${opts.gzip ? '-gzip' : ''}${opts.encrypt ? '-cifrada' : ''}.json`;
  return { blob, name, inner, ms: Math.round(performance.now() - t0), opts };
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function writeToHandle(fileHandle, blob) {
  const w = await fileHandle.createWritable();
  await w.write(blob);
  await w.close();
  const written = await fileHandle.getFile();
  return written.size;
}

function reportBackup(kind, made, writtenSize) {
  const sizeOk = writtenSize === undefined ? null : writtenSize === made.blob.size;
  results.copia = {
    destino: kind,
    nombre: made.name,
    tamano: mb(made.blob.size),
    gzip: made.opts.gzip,
    cifrada: made.opts.encrypt,
    msCrear: made.ms,
    checksum: made.inner.checksum.slice(0, 16) + '…',
    tamanoEscritoCoincide: sizeOk,
  };
  const msg = `Copia «${made.name}» (${mb(made.blob.size)}) creada en ${made.ms} ms · destino: ${kind}${sizeOk === null ? '' : sizeOk ? ' · tamaño escrito verificado' : ' · AVISO: el tamaño escrito no coincide'}.`;
  setStatus('backup-status', (sizeOk === false ? 'Revisar: ' : 'Correcto: ') + msg, sizeOk === false ? 'fail' : 'ok');
  log(msg, sizeOk === false ? 'error' : 'ok');
}

async function saveWithPicker() {
  const made = await makeBackup();
  if ('showSaveFilePicker' in window) {
    const handle = await window.showSaveFilePicker({
      suggestedName: made.name,
      types: [{ description: 'Copia de seguridad (JSON)', accept: { 'application/json': ['.json'] } }],
    });
    const size = await writeToHandle(handle, made.blob);
    reportBackup(`ubicación elegida (${handle.name})`, made, size);
  } else {
    downloadBlob(made.blob, made.name);
    reportBackup('descarga del navegador', made);
  }
}

async function dirHandleStatus() {
  const handle = await db.getKv(database, 'dirHandle');
  if (!handle) {
    setStatus('dir-status', 'No hay carpeta recordada.');
    results.carpeta = { recordada: false };
    return null;
  }
  let perm = 'desconocido';
  try {
    perm = await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    /* sin soporte */
  }
  results.carpeta = { recordada: true, nombre: handle.name, permisoAlAbrir: perm };
  setStatus('dir-status', `Carpeta recordada: «${handle.name}» · permiso de escritura: ${perm === 'granted' ? 'concedido' : perm === 'prompt' ? 'hay que volver a concederlo (un clic)' : perm}.`, perm === 'granted' ? 'ok' : 'warn');
  return handle;
}

async function pickDirectory() {
  if (!('showDirectoryPicker' in window)) throw new Error('Este navegador no permite elegir carpetas.');
  const dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'copias-dashboard' });
  await db.putKv(database, 'dirHandle', dir);
  log(`Carpeta elegida y guardada en el navegador: ${dir.name}`, 'ok');
  await dirHandleStatus();
}

async function saveToRememberedDir() {
  const handle = await db.getKv(database, 'dirHandle');
  if (!handle) throw new Error('Primero elige una carpeta.');
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  results.carpeta = { ...(results.carpeta ?? {}), permisoTrasSolicitar: perm };
  if (perm !== 'granted') throw new Error('No se concedió permiso de escritura en la carpeta.');
  const made = await makeBackup();
  const fileHandle = await handle.getFileHandle(made.name, { create: true });
  const size = await writeToHandle(fileHandle, made.blob);
  reportBackup(`carpeta recordada (${handle.name})`, made, size);
  await dirHandleStatus();
}

// ---------- 5. Restauración ----------

async function readAndValidate() {
  pendingRestore = null;
  $('btn-restore').disabled = true;
  const file = $('file-restore').files?.[0];
  if (!file) throw new Error('Elige primero un fichero de copia.');
  const text = await file.text();
  const obj = core.inspectBackupText(text);
  let decoded;
  try {
    decoded = await core.decodeBackupObject(obj, $('pass-restore').value);
  } catch (e) {
    setStatus('restore-status', e.message, 'fail');
    throw e;
  }
  const v = await core.validateBackup(decoded.inner);
  if (!v.ok) {
    setStatus('restore-status', 'La copia no es válida: ' + v.errors.join(' '), 'fail');
    results.restauracion = { validada: false, errores: v.errors };
    log('Copia rechazada: ' + v.errors.join(' | '), 'error');
    return;
  }
  const c = v.summary.counts;
  pendingRestore = { inner: decoded.inner, summary: v.summary };
  setStatus('restore-status', `Copia válida: creada el ${new Date(v.summary.createdAt).toLocaleString('es-ES')} · versión de esquema ${v.summary.schemaVersion} · ${fmt(c.players)} jugadores, ${fmt(c.sessions)} sesiones, ${fmt(c.repvalues)} valores${decoded.encrypted ? ' · cifrada' : ''}${decoded.compression === 'gzip' ? ' · comprimida' : ''}. Pulsa «Restaurar» para reemplazar los datos actuales.`, 'ok');
  results.restauracion = { validada: true, resumen: v.summary };
  log('Copia leída y validada (suma de verificación correcta).', 'ok');
  $('btn-restore').disabled = false;
}

async function restore() {
  if (!pendingRestore) throw new Error('No hay ninguna copia validada.');
  const current = await db.countAll(database);
  const incoming = pendingRestore.summary.counts;
  const ok = confirm(`Se reemplazarán los datos actuales (${fmt(current.repvalues)} valores) por los de la copia (${fmt(incoming.repvalues)} valores, creada el ${new Date(pendingRestore.summary.createdAt).toLocaleString('es-ES')}). ¿Continuar?`);
  if (!ok) return;
  const t0 = performance.now();
  await db.replaceAll(database, pendingRestore.inner.tables);
  const t1 = performance.now();
  const after = await db.readAll(database);
  const checksum = await core.checksumTables(after);
  const match = checksum === pendingRestore.inner.checksum;
  results.restauracion = { ...results.restauracion, restaurada: true, msRestaurar: Math.round(t1 - t0), checksumCoincide: match };
  setStatus('restore-status', match ? `Correcto: restauración completada en ${Math.round(t1 - t0)} ms y verificada (los datos son idénticos a la copia).` : 'Fallo: la restauración terminó pero la verificación no coincide.', match ? 'ok' : 'fail');
  log(match ? 'Restauración verificada: suma de verificación idéntica.' : 'La verificación posterior a la restauración NO coincide.', match ? 'ok' : 'error');
  pendingRestore = null;
  $('btn-restore').disabled = true;
  await refreshFound();
  await showEnv();
}

// ---------- 6. CSP ----------

async function testCsp() {
  const hasMeta = !!document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  const violations = [];
  const handler = (e) => violations.push(e.violatedDirective);
  document.addEventListener('securitypolicyviolation', handler);
  const targets = ['https://prueba-csp.invalid/', location.href];
  const outcomes = [];
  for (const t of targets) {
    try {
      await fetch(t, { mode: 'no-cors', cache: 'no-store' });
      outcomes.push({ destino: t === location.href ? 'mismo origen' : t, resultado: 'la petición se realizó' });
    } catch {
      outcomes.push({ destino: t === location.href ? 'mismo origen' : t, resultado: 'falló' });
    }
  }
  await new Promise((r) => setTimeout(r, 200));
  document.removeEventListener('securitypolicyviolation', handler);
  const blocked = violations.filter((v) => v.startsWith('connect-src')).length;
  const pass = hasMeta && blocked === targets.length;
  results.csp = { metaPresente: hasMeta, violacionesConnectSrc: blocked, intentos: targets.length, resultados: outcomes, correcto: pass };
  if (pass) setStatus('csp-status', `Correcto: la política de seguridad bloqueó los ${blocked} intentos de conexión.`, 'ok');
  else setStatus('csp-status', `Fallo: solo ${blocked} de ${targets.length} intentos fueron bloqueados por la política${hasMeta ? '' : ' (no se encuentra la política en la página)'}. Revisa el informe.`, 'fail');
  log(`Prueba CSP: ${JSON.stringify(results.csp)}`, pass ? 'ok' : 'error');
}


// ---------- Benchmark ----------

async function runBenchmark() {
  const params = { players: 40, sessionsPerPlayer: 60, repsPerSession: 5, variables: 19, seed: 1 };
  const longTables = core.generateSynthetic(params);
  const wideTables = bench.toWide(longTables, params.variables);
  setStatus('bench-status', 'Calculando la referencia de verificación a partir de los datos de origen…');
  const reference = await bench.buildReference(longTables);
  const out = [];
  for (const variant of bench.VARIANTS) {
    setStatus('bench-status', `Ejecutando ${variant.id} (${out.length + 1} de ${bench.VARIANTS.length})… no cierres la pestaña.`);
    log(`Benchmark ${variant.id}: ${variant.label}`);
    const r = await bench.runVariant(variant, { longTables, wideTables }, reference);
    out.push(r);
    const v = r.verificacion;
    log(`${variant.id}: escribir ${fmt(r.msEscribir)} ms · leer ${fmt(r.msLeer)} ms · agregar ${fmt(r.msAgregar)} ms · ${fmt(r.filasTotales)} filas`, 'ok');
    log(`${variant.id} durabilidad: ${r.durabilidad.resumen}`);
    log(`${variant.id} verificación: ${v.ok ? 'correcta' : 'FALLIDA'} · valores ${fmt(v.valores.leidos)}/${fmt(v.valores.esperados)} · sesiones ${fmt(v.porSesion.leidos)} (${v.porSesion.distintos} distintas) · variables ${fmt(v.porVariable.leidos)} (${v.porVariable.distintos} distintas) · sesión×variable ${fmt(v.porSesionYVariable.leidos)} (${v.porSesionYVariable.distintos} distintas) · repetición×variable ${fmt(v.porRepeticionYVariable.comprobados)} pares comprobados (${fmt(v.porRepeticionYVariable.distintos)} difieren; SHA-256 de pares ${v.resumenSha256Pares.coincide ? 'coincide' : 'NO coincide'})`, v.ok ? 'ok' : 'error');
  }
  const allOk = out.every((r) => r.verificacion.ok);
  results.benchmark = {
    escala: params,
    referencia: { ...reference.expected, resumenSha256: reference.digest.slice(0, 16) + '…', resumenSha256Pares: reference.pairsDigest.slice(0, 16) + '…' },
    verificacionCompleta: allOk,
    resultados: out,
  };
  const times = out.map((r) => `${r.id} ${(r.msEscribir / 1000).toFixed(1)} s`).join(' · ');
  const relaxed = out.filter((r) => r.durabilidad.solicitada === 'relaxed').map((r) => `${r.id}: ${r.durabilidad.relajadaAplicada === true ? 'aplicada' : r.durabilidad.relajadaAplicada === false ? 'NO aplicada' : 'no verificable'}`).join(', ');
  setStatus('bench-status', (allOk ? 'Correcto: ' : 'Fallo de verificación: ') + times + ` · durabilidad relajada → ${relaxed} · verificación contra los datos de origen ${allOk ? 'correcta en las cinco variantes' : 'fallida en alguna variante (ver informe)'}.`, allOk ? 'ok' : 'fail');
  await showEnv();
}

// ---------- 7. Informe ----------

async function copyReport() {
  await showEnv();
  const header = `Informe de la prueba de viabilidad 1a · ${new Date().toLocaleString('es-ES')} · versión ${core.APP_VERSION}\n(solo datos sintéticos; no contiene datos de jugadores)\n\n`;
  const text = header + JSON.stringify(results, null, 2);
  const area = $('report');
  area.value = text;
  area.hidden = false;
  try {
    await navigator.clipboard.writeText(text);
    setStatus('report-status', 'Informe copiado al portapapeles. Pégalo en el chat.', 'ok');
  } catch {
    area.select();
    setStatus('report-status', 'No se pudo copiar automáticamente: el informe está en el cuadro de texto; selecciónalo y cópialo.', 'warn');
  }
}

// ---------- Arranque ----------

function wire() {
  const on = (id, fn, others = []) => $(id).addEventListener('click', () => busy([id, ...others], fn));
  on('btn-persist', requestPersistence);
  on('btn-gen', generate, ['btn-count', 'btn-del']);
  on('btn-count', countRecords);
  on('btn-del', deleteData, ['btn-gen']);
  on('btn-save', saveWithPicker, ['btn-save-dir']);
  on('btn-pick-dir', pickDirectory);
  on('btn-save-dir', saveToRememberedDir, ['btn-save']);
  on('btn-read', readAndValidate);
  on('btn-restore', restore, ['btn-read']);
  on('btn-csp', testCsp);
  on('btn-bench', runBenchmark);
  on('btn-report', copyReport);
  $('opt-pass-on').addEventListener('change', (e) => {
    $('pass-backup').disabled = !e.target.checked;
    if (!e.target.checked) $('pass-backup').value = '';
  });
  $('file-restore').addEventListener('change', () => {
    pendingRestore = null;
    $('btn-restore').disabled = true;
    setStatus('restore-status', '');
  });
}

async function init() {
  wire();
  await showEnv();
  if (!('indexedDB' in window)) {
    log('Este navegador no tiene IndexedDB.', 'error');
    return;
  }
  try {
    database = await db.openDb();
  } catch (e) {
    log('No se pudo abrir la base de datos: ' + e.message, 'error');
    return;
  }
  const prevOpen = await db.getKv(database, 'lastOpenAt');
  results.aperturaAnterior = prevOpen ?? null;
  await db.putKv(database, 'lastOpenAt', new Date().toISOString());
  log(prevOpen ? `Apertura anterior registrada: ${prevOpen}` : 'Primera apertura de esta página en este navegador.');
  await refreshFound(true);
  await dirHandleStatus();
  log('Página lista. Todo se ejecuta en este navegador; no hay peticiones a servidores.');
}

init().catch((e) => log('Error de arranque: ' + (e?.message || e), 'error'));
