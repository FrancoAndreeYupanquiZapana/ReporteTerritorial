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

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
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
  brujula: 'D22', 'brújula': 'D22',
  smartphone: 'A23', celular: 'A23', telefono: 'A23', teléfono: 'A23',
  binocular: 'A24', binoculares: 'A24',
  dron: 'A25', rpas: 'A25', uav: 'A25',
  faja: 'B26_Fajas', fajas: 'B26_Fajas',
  casco: 'B26_Casco', cascos: 'B26_Casco',
  poncho: 'B26_Poncho', ponchos: 'B26_Poncho',
  bota: 'B26_Botas', botas: 'B26_Botas', jebe: 'B26_Botas',
};

function parsearEquipos(textoEquipos) {
  const marcas = { A22: false, D22: false, A23: false, A24: false, A25: false, B26: { Fajas: false, Casco: false, Poncho: false, Botas: false } };
  const otros = [];

  if (!textoEquipos) return { marcas, otros };

  const items = textoEquipos.split(',').map(s => s.trim().toLowerCase());
  for (const item of items) {
    if (!item) continue;
    let encontrado = false;
    for (const [kw, cell] of Object.entries(EPP_MAP)) {
      if (item.includes(kw)) {
        if (cell.startsWith('B26_')) {
          const eppKey = cell.split('_')[1];
          marcas.B26[eppKey] = true;
        } else {
          marcas[cell] = true;
        }
        encontrado = true;
        break;
      }
    }
    if (!encontrado && item.length > 1) {
      otros.push(item);
    }
  }
  return { marcas, otros };
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
  if (coordenadas.length > 5) {
    const extrasNecesarias = coordenadas.length - 5;
    ws.insertRows(36, extrasNecesarias);
    for (let i = 5; i < coordenadas.length; i++) {
      const newRow = 36 + (i - 5);
      ws.getCell(`A${newRow}`).value = `Punto de Verificación ${i}`;
    }
  }

  const maxCoord = Math.min(coordenadas.length, 5 + (coordenadas.length > 5 ? coordenadas.length - 5 : 0));
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
    const descCell = ws.getCell('B39');
    descCell.value = lineasDesc.join('\n');
    descCell.alignment = { wrapText: true, vertical: 'top' };
  }

  // 5.2 Autores (fila 43)
  const autores = reportes.filter(r => r.autores).map(r => r.autores);
  if (autores.length > 0) {
    const autoresCell = ws.getCell('B43');
    autoresCell.value = [...new Set(autores)].join('\n');
    autoresCell.alignment = { wrapText: true, vertical: 'top' };
  }

  // 5.3 Observaciones adicionales (fila 47)
  const observaciones = reportes.filter(r => r.observadores).map(r => r.observadores);
  if (observaciones.length > 0) {
    const obsCell = ws.getCell('B47');
    obsCell.value = [...new Set(observaciones)].join('\n');
    obsCell.alignment = { wrapText: true, vertical: 'top' };
  }

  // Medios probatorios
  if (coordenadas.length > 0) {
    ws.getCell('B52').value = '[x] Fotografías';
    ws.getCell('E52').value = '[x] Mapa Satelital / Track GPS';
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

    // 3. Mapear campos de ArcGIS → nombres de la vista + dominios
    const reportes = features.map((f, i) => {
      const a = f.attributes;
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
        equipos: a.Equipos || '',
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
