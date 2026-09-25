require('dotenv/config');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.API_PORT || 3001;
const ARCGIS_URL = process.env.ARCGIS_FEATURE_SERVICE_URL;
const ARCGIS_KEY = process.env.ARCGIS_API_KEY;

// Dominios de la Feature Service (códigos → nombres legibles)
const DOM_OCURRENCIA = {
  '1': 'Puntos Críticos',
  '2': 'Ingresos no Autorizados',
  '3': 'Afectación de árboles de castaña',
  '4': 'Apertura de trochas o caminos',
  '5': 'Presencia de quemas o riesgo de fuego',
  '6': 'Cambio de uso de suelo',
};

const DOM_PRIORIDAD = {
  'A': 'Alto',
  'M': 'Medio',
  'B': 'Bajo',
};

// Códigos actuales del dominio Equipos_EPP. También se usa como respaldo
// cuando ArcGIS no publica los metadatos del dominio.
const DOM_EQUIPOS_INICIAL = {
  EPP1: 'GPS',
  EPP2: 'Smartphone',
  EPP3: 'Binoculares',
  EPP4: 'RPAS / Drons',
  EPP5: 'Brujulas',
  EPP6: 'Fajas',
  EPP7: 'Casco',
  EPP8: 'Ponchos',
  EPP9: 'Botas de jebe',
};

let dominioEquiposCache = null;

function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const CORS_ORIGINS_POR_DEFECTO = [
  'http://localhost:3000',
  'https://reporte-territorial-web.vercel.app',
];

const corsOrigins = new Set(
  (process.env.CORS_ORIGIN || CORS_ORIGINS_POR_DEFECTO.join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);

const permitirPreviewsDeVercel = process.env.CORS_ALLOW_VERCEL_PREVIEWS !== 'false';
const previewsDeEsteProyecto = /^https:\/\/reporte-territorial(?:-[a-z0-9-]+)?\.vercel\.app$/i;

app.use(cors({
  origin(origin, callback) {
    // Las solicitudes sin Origin (por ejemplo, health checks con curl) no
    // necesitan CORS. Los navegadores sí deben enviar un Origin permitido.
    if (!origin || corsOrigins.has('*') || corsOrigins.has(origin)) {
      return callback(null, true);
    }

    if (permitirPreviewsDeVercel && previewsDeEsteProyecto.test(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
}));
app.use(express.json());

// ============================================================
// 1. HEALTH CHECK
// ============================================================
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', arcgis: ARCGIS_URL, timestamp: new Date().toISOString() });
});

// ============================================================
// 2. SOCIOS - lee el Excel inline (sin sharedStrings)
// ============================================================
let sociosCache = null;

const sectoresData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'sectores.json'), 'utf8'));

function buscarProvincia(sector) {
  if (!sector) return { provincia: '', distrito: '' };
  const s = sector.trim().toLowerCase();
  for (const [prov, info] of Object.entries(sectoresData.provincias)) {
    for (const sec of info.sectores) {
      if (sec.toLowerCase() === s) {
        return { provincia: prov, distrito: info.distrito };
      }
    }
  }
  return { provincia: '', distrito: '' };
}

async function cargarSocios() {
  if (sociosCache) return sociosCache;

  const JSZip = require('jszip');
  const filePath = path.join(__dirname, 'public', 'socios.xlsx');
  if (!fs.existsSync(filePath)) throw new Error('No se encontró socios.xlsx');

  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const sheetXml = await zip.file('xl/worksheets/sheet.xml').async('string');

  const socios = [];
  const rowRegex = /<x:row r="(\d+)">(.*?)<\/x:row>/gs;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowNum = parseInt(rowMatch[1]);
    if (rowNum === 1) continue;
    const cells = new Map();
    const cellRegex = /<x:c r="([A-Z]+)\d+"[^>]*><x:v>([^<]*)<\/x:v><\/x:c>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[2])) !== null) {
      cells.set(cellMatch[1], cellMatch[2]);
    }
    const nombre = cells.get('D');
    if (nombre && nombre.trim()) {
      const sector = cells.get('J') || '';
      const { provincia, distrito } = buscarProvincia(sector);
      socios.push({
        nombre: nombre.trim(),
        codigoConcesion: cells.get('C') || '',
        contratoTH: cells.get('E') || '',
        sector,
        provincia,
        departamento: sectoresData.departamento,
      });
    }
  }

  sociosCache = socios;
  console.log(`[API] Socios cargados: ${socios.length}`);
  return socios;
}

app.get('/api/socios', async (_req, res) => {
  try {
    const socios = await cargarSocios();
    res.json({ socios });
  } catch (e) {
    console.error('[API] Error socios:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// 3. CONSULTAR ARCGIS ONLINE (vista pública)
// ============================================================
async function consultarArcGIS(nombreSocio, fechaInicio, fechaFin) {
  if (!ARCGIS_URL) throw new Error('ARCGIS_FEATURE_SERVICE_URL no configurada');

  let where = `Titular='${nombreSocio}'`;
  if (fechaInicio && fechaFin) {
    where += ` AND Fecha_Hora >= DATE '${fechaInicio}' AND Fecha_Hora < DATE '${fechaFin}'`;
  }

  const params = new URLSearchParams({
    where,
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
    resultRecordCount: '2000',
  });
  if (ARCGIS_KEY) {
    params.append('token', ARCGIS_KEY);
  }

  // Layer 2 = Puntos_Importantes en la Vista
  const url = `${ARCGIS_URL}/2/query?${params.toString()}`;
  console.log(`[ArcGIS] WHERE: ${where}`);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`ArcGIS HTTP ${response.status}: ${response.statusText}`);

  const data = await response.json();
  if (data.error) throw new Error(`ArcGIS error: ${data.error.message || JSON.stringify(data.error)}`);

  console.log(`[ArcGIS] Resultados: ${data.features ? data.features.length : 0}`);
  return data;
}

// Lee los nombres visibles del dominio Equipos_EPP (por ejemplo, EPP1 => GPS).
// Así se reconocen automáticamente los productos nuevos o renombrados en ArcGIS.
async function obtenerDominioEquipos() {
  if (dominioEquiposCache) return dominioEquiposCache;

  const dominio = { ...DOM_EQUIPOS_INICIAL };
  if (ARCGIS_URL) {
    try {
      const params = new URLSearchParams({ f: 'json' });
      if (ARCGIS_KEY) params.append('token', ARCGIS_KEY);

      const response = await fetch(`${ARCGIS_URL}/2?${params.toString()}`);
      if (!response.ok) throw new Error(`ArcGIS HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      const campoEquipos = (data.fields || []).find(campo => campo.name === 'Equipos');
      const valores = campoEquipos?.domain?.codedValues || [];
      for (const valor of valores) {
        if (valor.code != null && valor.name) {
          dominio[String(valor.code)] = String(valor.name);
        }
      }
    } catch (error) {
      console.warn('[ArcGIS] No se pudo leer el dominio Equipos_EPP; se usará el respaldo:', error.message);
    }
  }

  dominioEquiposCache = dominio;
  return dominioEquiposCache;
}

function decodificarEquipos(valor, dominio) {
  if (Array.isArray(valor)) {
    return valor.map(item => decodificarEquipos(item, dominio)).filter(Boolean).join(', ');
  }
  if (valor && typeof valor === 'object') {
    if (valor.code != null) return decodificarEquipos(valor.code, dominio);
    if (valor.value != null) return decodificarEquipos(valor.value, dominio);
    return '';
  }
  if (valor == null || valor === '') return '';

  const texto = String(valor).trim();
  if (texto.includes(',')) {
    return texto
      .split(',')
      .map(item => {
        const limpio = item.trim();
        return dominio[limpio] || limpio;
      })
      .filter(Boolean)
      .join(', ');
  }
  return dominio[texto] || texto;
}

function normalizarClave(valor) {
  return normalizarTexto(valor).replace(/[^a-z0-9]+/g, '');
}

function valorIndicaEvidencia(valor) {
  if (valor == null || valor === false) return false;
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor > 0;
  if (Array.isArray(valor)) return valor.some(item => valorIndicaEvidencia(item));
  if (typeof valor === 'object') {
    return Object.values(valor).some(item => valorIndicaEvidencia(item));
  }

  const texto = normalizarTexto(valor);
  if (!texto) return false;
  return !['0', 'false', 'no', 'ninguno', 'n/a', 'na', 'null', 'sin evidencia', 'sin evidencia de video'].includes(texto);
}

function valorIndicaVideo(valor) {
  if (valor == null) return '';

  const texto = normalizarTexto(
    typeof valor === 'string' ? valor : JSON.stringify(valor)
  );

  return /\bvideo(s)?\b|\.mp4\b|\.mov\b|\.avi\b|\.mkv\b|\.webm\b|\.m4v\b|youtube|youtu\.be|vimeo/.test(texto);
}

function valorTieneEnlaceVideo(valor) {
  if (valor == null) return false;

  const texto = String(valor);
  return /https?:\/\/\S*(?:youtube|youtu\.be|vimeo)|https?:\/\/\S+\.(?:mp4|mov|avi|mkv|webm|m4v)(?:[?#]\S*)?/i.test(texto);
}

function tieneEvidenciaVideo(attributes) {
  return Object.entries(attributes || {}).some(([clave, valor]) => {
    if (valorTieneEnlaceVideo(valor)) return true;

    const claveNormalizada = normalizarClave(clave);
    const esVideo = claveNormalizada.includes('video') || claveNormalizada.includes('videograbado');
    const esEvidencia = claveNormalizada.includes('evidenc')
      || ['adjunto', 'adjuntos', 'archivo', 'archivos', 'mediosprobatorios'].includes(claveNormalizada);

    return valorIndicaEvidencia(valor)
      && (esVideo || (esEvidencia && valorIndicaVideo(valor)));
  });
}

function esAdjuntoVideo(adjunto) {
  const contentType = normalizarTexto(adjunto.contentType || adjunto.tipo || '');
  if (contentType.startsWith('video/')) return true;

  const nombre = String(adjunto.name || adjunto.fileName || adjunto.url || '');
  return valorIndicaVideo(nombre);
}

async function consultarIdsConVideosAdjuntos(features) {
  const ids = [...new Set(features
    .map(feature => feature.attributes?.OBJECTID)
    .filter(id => id != null)
    .map(String))];

  const idsConVideo = new Set();
  const LOTE = 100;

  for (let inicio = 0; inicio < ids.length; inicio += LOTE) {
    const lote = ids.slice(inicio, inicio + LOTE);
    const params = new URLSearchParams({ objectIds: lote.join(','), f: 'json' });
    if (ARCGIS_KEY) params.append('token', ARCGIS_KEY);

    try {
      const response = await fetch(`${ARCGIS_URL}/2/queryAttachments?${params.toString()}`);
      if (!response.ok) throw new Error(`ArcGIS HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      const featuresAdjunto = Array.isArray(data.features) ? data.features : [];
      const gruposAdjunto = Array.isArray(data.attachmentGroups) ? data.attachmentGroups : [];

      for (const feature of featuresAdjunto) {
        const adjunto = feature.attributes || feature;
        if (!esAdjuntoVideo(adjunto)) continue;
        const objectId = adjunto.OBJECTID ?? adjunto.objectId ?? adjunto.objectid;
        if (objectId != null) idsConVideo.add(String(objectId));
      }

      for (const grupo of gruposAdjunto) {
        const objectId = grupo.parentObjectId ?? grupo.objectId ?? grupo.objectid;
        const adjuntos = Array.isArray(grupo.attachmentInfos)
          ? grupo.attachmentInfos
          : (Array.isArray(grupo.attachments) ? grupo.attachments : []);

        if (objectId != null && adjuntos.some(esAdjuntoVideo)) {
          idsConVideo.add(String(objectId));
        }
      }
    } catch (error) {
      // Un fallo consultando adjuntos no debe impedir generar el Excel.
      console.warn('[ArcGIS] No se pudieron consultar adjuntos:', error.message);
    }
  }

  return idsConVideo;
}

// ============================================================
// UTIL: Convertir lat/lng (WGS84) a UTM Zona 19S
// ============================================================
function latLngToUtm19S(lat, lng) {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e;
  const ep2 = e2 / (1 - e2);
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat * Math.PI / 180) ** 2);
  const T = Math.tan(lat * Math.PI / 180) ** 2;
  const C = ep2 * Math.cos(lat * Math.PI / 180) ** 2;
  const A = Math.cos(lat * Math.PI / 180) * (lng - (-69)) * Math.PI / 180;

  const M = a * (
    (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * (lat * Math.PI / 180)
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * lat * Math.PI / 180)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * lat * Math.PI / 180)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * lat * Math.PI / 180)
  );

  const easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  const northing = k0 * (M + N * Math.tan(lat * Math.PI / 180) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));

  // Hemisferio sur: agregar 10,000,000
  const northingFinal = lat < 0 ? northing + 10000000 : northing;

  return { easting: Math.round(easting * 100) / 100, northing: Math.round(northingFinal * 100) / 100 };
}

// ============================================================
// 4. GENERAR EXCEL CON PLANTILLA
// ============================================================

// Mapeo de palabras clave del campo Equipos → casillas del Excel
const EPP_MAP = {
  gps: 'A22', cps: 'A22',
  brujul: 'D22',
  smartphone: 'A23', celular: 'A23', telefono: 'A23', movil: 'A23',
  binocular: 'A24',
  dron: 'A25', rpas: 'A25', uav: 'A25',
  faj: 'B26_Fajas',
  casc: 'B26_Casco',
  ponch: 'B26_Poncho',
  bota: 'B26_Botas', jebe: 'B26_Botas',
};

function parsearEquipos(textoEquipos) {
  const marcas = { A22: false, D22: false, A23: false, A24: false, A25: false, B26: { Fajas: false, Casco: false, Poncho: false, Botas: false } };
  const otros = [];

  if (!textoEquipos) return { marcas, otros };

  const items = textoEquipos
    .split(/[,;|\n]+/)
    .map(item => item.trim())
    .filter(Boolean);

  for (const item of items) {
    const itemOriginal = item;
    const codigo = item.toUpperCase();
    const itemDecodificado = DOM_EQUIPOS_INICIAL[codigo] || itemOriginal;
    const normalizado = normalizarTexto(itemDecodificado);
    let encontrado = false;

    for (const [keyword, celda] of Object.entries(EPP_MAP)) {
      if (!normalizado.includes(keyword)) continue;

      if (celda.startsWith('B26_')) {
        marcas.B26[celda.split('_')[1]] = true;
      } else {
        marcas[celda] = true;
      }
      encontrado = true;
      break;
    }

    if (!encontrado && normalizado.length > 1) {
      otros.push(itemDecodificado);
    }
  }

  const otrosUnicos = [...new Map(otros.map(item => [normalizarTexto(item), item])).values()];
  return { marcas, otros: otrosUnicos };
}

// ExcelJS 4.4.0 altera los rangos combinados al insertar filas. Este helper
// conserva los merges y los desplaza de forma segura, evitando que Videos,
// Fotografías o las demás casillas terminen sobrescritas.
function insertarFilasPreservandoMerges(ws, posicion, cantidad) {
  const ExcelJSCell = ws.getCell(1, 1).constructor;
  const mergesOriginales = Object.values(ws._merges).map(merge => ({ ...merge.model }));
  const mergeOriginal = ExcelJSCell.prototype.merge;

  ExcelJSCell.prototype.merge = function () {};
  try {
    ws.insertRows(posicion, Array(cantidad), 'i');
  } finally {
    ExcelJSCell.prototype.merge = mergeOriginal;
  }

  ws._merges = {};
  for (const merge of mergesOriginales) {
    const top = merge.top >= posicion ? merge.top + cantidad : merge.top;
    const bottom = merge.bottom >= posicion ? merge.bottom + cantidad : merge.bottom;
    ws.mergeCells(top, merge.left, bottom, merge.right);
  }
}

async function generarExcel(socio, reportes, coordenadas, nPatrullaje) {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(__dirname, 'public', 'plantilla_base.xlsx');
  await workbook.xlsx.readFile(templatePath);

  const ws = workbook.getWorksheet(1);
  if (!ws) throw new Error('No se encontró la hoja en plantilla_base.xlsx');

  // ── SECCIÓN 1: INFORMACIÓN GENERAL ──
  ws.getCell('B5').value = String(nPatrullaje);
  ws.getCell('D5').value = new Date().getFullYear();
  ws.getCell('F5').value = reportes.length > 0 ? reportes[0].fecha : '';

  ws.getCell('B6').value = socio.contratoTH;
  ws.getCell('F6').value = socio.nombre;
  const responsables = reportes.filter(r => r.responsable).map(r => r.responsable);
  ws.getCell('B7').value = responsables.length > 0 ? [...new Set(responsables)].join(', ') : socio.nombre;
  ws.getCell('B9').value = socio.sector;
  ws.getCell('D9').value = socio.provincia || '-';
  ws.getCell('F9').value = socio.departamento || '-';

  // Participantes: responsable en primera fila
  if (responsables.length > 0) {
    ws.getCell('B10').value = [...new Set(responsables)].join(', ');
  }

  // ── OBJETIVOS: marcar casillas según ocurrencias del grupo ──
  ws.getCell('A14').value = '[ x ]'; // Rutinario siempre

  const tiposOcurrencia = new Set(reportes.map(r => r.tipoAlerta));
  if (tiposOcurrencia.has('Puntos Críticos')) ws.getCell('D14').value = '[ x ]';
  if (tiposOcurrencia.has('Ingresos no Autorizados')) ws.getCell('D15').value = '[ x ]';
  if (tiposOcurrencia.has('Afectación de árboles de castaña')) ws.getCell('A16').value = '[ x ]';
  if (tiposOcurrencia.has('Apertura de trochas o caminos')) ws.getCell('D16').value = '[ x ]';
  if (tiposOcurrencia.has('Presencia de quemas o riesgo de fuego')) ws.getCell('A18').value = '[ x ]';
  if (tiposOcurrencia.has('Cambio de uso de suelo')) ws.getCell('D18').value = '[ x ]';

  // ── SECCIÓN 3: EQUIPOS Y EPP ──
  const todosEquipos = reportes.map(r => r.equipos).filter(Boolean).join(', ');
  const { marcas, otros } = parsearEquipos(todosEquipos);

  if (marcas.A22) ws.getCell('A22').value = '[ x ] GPS:';
  if (marcas.D22) ws.getCell('D22').value = '[ x ] Brújula:';
  if (marcas.A23) ws.getCell('A23').value = '[ x ] Smartphone:';
  if (marcas.A24) ws.getCell('A24').value = '[ x ] Binoculares:';
  if (marcas.A25) ws.getCell('A25').value = '[ x ] RPAS / Dron:';

  const eppLinea = [];
  if (marcas.B26.Fajas) eppLinea.push('[x] Fajas');
  if (marcas.B26.Casco) eppLinea.push('[x] Casco');
  if (marcas.B26.Poncho) eppLinea.push('[x] Poncho');
  if (marcas.B26.Botas) eppLinea.push('[x] Botas de jebe');
  if (eppLinea.length > 0) {
    ws.getCell('B26').value = eppLinea.join('    ');
  }
  if (otros.length > 0) {
    ws.getCell('A27').value = 'Otro EPP: ' + otros.join(', ');
  }

  // ── SECCIÓN 4: COORDENADAS UTM ──
  // Insertar filas extra si hay más de 5 coordenadas
  const filasInsertadas = Math.max(0, coordenadas.length - 5);
  if (filasInsertadas > 0) {
    insertarFilasPreservandoMerges(ws, 36, filasInsertadas);
    for (let i = 5; i < coordenadas.length; i++) {
      const newRow = 36 + (i - 5);
      ws.getCell(`A${newRow}`).value = `Punto de Verificación ${i}`;
    }
  }

  for (let i = 0; i < coordenadas.length; i++) {
    const p = coordenadas[i];
    const utm = latLngToUtm19S(p.lat, p.lng);
    const fila = 31 + i;
    ws.getCell(`B${fila}`).value = 'WGS84';
    ws.getCell(`C${fila}`).value = '19S';
    ws.getCell(`D${fila}`).value = utm.easting;
    ws.getCell(`E${fila}`).value = utm.northing;
  }

  // ── SECCIÓN 5: DESCRIPCIÓN DEL HECHO ──
  const lineasDesc = reportes.map(r => {
    let linea = `[${r.fecha}] ${r.tipoAlerta}`;
    if (r.descripcion) linea += `: ${r.descripcion}`;
    if (r.prioridad) linea += ` (${r.prioridad})`;
    return linea;
  });
  if (lineasDesc.length > 0) {
    const descCell = ws.getCell(`B${39 + filasInsertadas}`);
    descCell.value = lineasDesc.join('\n');
    descCell.alignment = { wrapText: true, vertical: 'top' };
  }

  // 5.2 Autores (fila 43)
  const autores = reportes.filter(r => r.autores).map(r => r.autores);
  if (autores.length > 0) {
    const autoresCell = ws.getCell(`B${43 + filasInsertadas}`);
    autoresCell.value = [...new Set(autores)].join('\n');
    autoresCell.alignment = { wrapText: true, vertical: 'top' };
  }

  // 5.3 Observaciones adicionales (fila 47)
  const observaciones = reportes.filter(r => r.observadores).map(r => r.observadores);
  if (observaciones.length > 0) {
    const obsCell = ws.getCell(`B${47 + filasInsertadas}`);
    obsCell.value = [...new Set(observaciones)].join('\n');
    obsCell.alignment = { wrapText: true, vertical: 'top' };
  }

  // Medios probatorios
  if (reportes.some(r => r.evidenciasVideos)) {
    ws.getCell(`D${52 + filasInsertadas}`).value = '[x] Videos';
  }
  if (coordenadas.length > 0) {
    ws.getCell(`B${52 + filasInsertadas}`).value = '[x] Fotografías';
    ws.getCell(`E${52 + filasInsertadas}`).value = '[x] Mapa Satelital / Track GPS';
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================================
// 5. GENERAR REPORTE - endpoint principal
// ============================================================
app.post('/api/generar-reporte', async (req, res) => {
  try {
    const { socio, fechaInicio, fechaFin, guardarEnSheets } = req.body;

    if (!socio) {
      return res.status(400).json({ success: false, message: 'Faltan campos: socio' });
    }

    // 1. Buscar socio
    const socios = await cargarSocios();
    const socioData = socios.find(s => s.nombre.toLowerCase() === socio.toLowerCase());
    if (!socioData) {
      return res.status(404).json({ success: false, message: `Socio "${socio}" no encontrado en el padrón` });
    }
    console.log(`[API] Socio: ${socioData.nombre} | Cód: ${socioData.codigoConcesion} | Contrato: ${socioData.contratoTH}`);

    // 2. Consultar ArcGIS (vista pública)
    const arcgisData = await consultarArcGIS(socio, fechaInicio, fechaFin);
    const features = arcgisData.features || [];

    if (features.length === 0) {
      return res.json({
        success: false,
        message: `No se encontraron reportes para "${socio}". Verifique el nombre exacto.`,
      });
    }

    const [dominioEquipos, idsConVideosAdjuntos] = await Promise.all([
      obtenerDominioEquipos(),
      consultarIdsConVideosAdjuntos(features),
    ]);

    // 3. Mapear campos de ArcGIS → nombres de la vista + dominios
    const reportes = features.map((f, i) => {
      const a = f.attributes;
      const objectId = a.OBJECTID;
      const fechaHora = a.Fecha_Hora;
      let fechaISO = '';
      let fechaStr = '';
      if (fechaHora) {
        const d = new Date(fechaHora);
        fechaISO = d.toISOString().split('T')[0];
        fechaStr = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
      }

      return {
        id: i + 1,
        fechaISO,
        fecha: fechaStr,
        tipoAlerta: DOM_OCURRENCIA[a.Ocurrencia] || a.Ocurrencia || '',
        descripcion: a.Descripcion || '',
        prioridad: DOM_PRIORIDAD[a.Prioridad] || a.Prioridad || '',
        responsable: a.Responsable || '',
        equipos: decodificarEquipos(a.Equipos, dominioEquipos),
        evidenciasVideos: objectId != null && idsConVideosAdjuntos.has(String(objectId))
          ? true
          : tieneEvidenciaVideo(a),
        autores: a.Autores || '',
        observadores: a.Observadores || '',
        latitud: f.geometry?.y || null,
        longitud: f.geometry?.x || null,
      };
    });

    // 4. Agrupar por fecha
    const grupos = {};
    for (const r of reportes) {
      if (!grupos[r.fechaISO]) grupos[r.fechaISO] = [];
      grupos[r.fechaISO].push(r);
    }

    // 5. Generar un Excel por cada fecha, con N°Patrullaje secuencial
    const fechas = Object.keys(grupos).sort();
    const archivos = [];

    for (let idx = 0; idx < fechas.length; idx++) {
      const fecha = fechas[idx];
      const grupoReportes = grupos[fecha];
      const coordsGrupo = grupoReportes
        .filter(r => r.latitud && r.longitud)
        .map(r => ({ lat: r.latitud, lng: r.longitud }));

      const buffer = await generarExcel(socioData, grupoReportes, coordsGrupo, idx + 1);
      archivos.push({
        fecha,
        fechaStr: grupoReportes[0].fecha,
        totalReportes: grupoReportes.length,
        archivoBase64: buffer.toString('base64'),
        nombreArchivo: `Reporte_${socio.replace(/\s+/g, '_')}_${fecha}.xlsx`,
      });
    }

    console.log(`[API] Total: ${reportes.length} registros en ${archivos.length} fechas`);

    res.json({
      success: true,
      message: `${reportes.length} registros en ${archivos.length} fecha(s)`,
      totalReportes: reportes.length,
      archivos,
    });

  } catch (e) {
    console.error('[API] Error generando reporte:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log(`[API] Servidor corriendo en http://localhost:${PORT}`);
  console.log(`[API] ArcGIS URL: ${ARCGIS_URL ? 'OK' : 'FALTA'}`);
  console.log(`[API] ArcGIS Key: ${ARCGIS_KEY ? 'CONFIGURADA (no necesaria para vista pública)' : 'SIN KEY (vista pública)'}`);
});
