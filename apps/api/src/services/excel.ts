import ExcelJS from 'exceljs';
import path from 'path';
import type { Socio, ReporteMonitoreo, CoordenadaRecorrido } from '@ronap/types';

interface GenerarExcelParams {
  socio: Socio;
  fechaInicio: string;
  fechaFin: string;
  reportes: ReporteMonitoreo[];
  coordenadasRecorrido: CoordenadaRecorrido[];
}

interface GenerarExcelResult {
  buffer: Buffer;
  nombreArchivo: string;
}

export async function generarExcel(params: GenerarExcelParams): Promise<GenerarExcelResult> {
  const { socio, fechaInicio, fechaFin, reportes, coordenadasRecorrido } = params;

  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(process.cwd(), 'public', 'plantilla_base.xlsx');
  await workbook.xlsx.readFile(templatePath);

  const ws = workbook.getWorksheet(1);
  if (!ws) throw new Error('No se encontró la primera hoja en plantilla_base.xlsx');

  // === SECCIÓN 1: INFORMACIÓN GENERAL Y UBICACIÓN ===
  // Fila 5: B5=N° Patrullaje, D5=Año, F5=Fecha y Hora inicio
  ws.getCell('B5').value = reportes.length > 0 ? String(reportes[0].id) : '';
  ws.getCell('D5').value = new Date().getFullYear();
  ws.getCell('F5').value = fechaInicio;

  // Fila 6: B6=N° Contrato TH, F6=Titular / Rep. Legal
  ws.getCell('B6').value = socio.contratoTH;
  ws.getCell('F6').value = socio.nombre;

  // Fila 7: B7=Resp. del Registro
  ws.getCell('B7').value = socio.nombre;

  // Fila 9: B9=Sector/Distrito, D9=Provincia, F9=Departamento
  ws.getCell('B9').value = socio.sector;
  ws.getCell('D9').value = socio.provincia || '-';
  ws.getCell('F9').value = socio.departamento || '-';

  // Fila 10: B10=Participantes (usar observadores del primer reporte)
  if (reportes.length > 0 && reportes[0].observadores) {
    ws.getCell('B10').value = reportes[0].observadores;
  }

  // === SECCIÓN 4: COORDENADAS REFERENCIALES (UTM) ===
  // Fila 31: Inicio Patrullaje
  if (coordenadasRecorrido.length > 0) {
    const inicio = coordenadasRecorrido[0];
    ws.getCell('D31').value = inicio.lng.toFixed(6);
    ws.getCell('E31').value = inicio.lat.toFixed(6);
  }

  // Filas 32-35: Puntos de Verificación 1-4
  for (let i = 0; i < Math.min(4, coordenadasRecorrido.length - 1); i++) {
    const fila = 32 + i;
    const punto = coordenadasRecorrido[i + 1] || coordenadasRecorrido[i];
    ws.getCell(`D${fila}`).value = punto.lng.toFixed(6);
    ws.getCell(`E${fila}`).value = punto.lat.toFixed(6);
  }

  // === SECCIÓN 5: DESCRIPCIÓN DEL HECHO ===
  // Filas 39-41: Breve descripción de lo ocurrido
  const descripciones = reportes.map(r => {
    let desc = `[${r.fecha}] ${r.tipoAlerta}`;
    if (r.descripcion) desc += `: ${r.descripcion}`;
    if (r.estado) desc += ` (Prioridad: ${r.estado})`;
    return desc;
  });
  if (descripciones.length > 0) {
    ws.getCell('B39').value = descripciones.join('\n');
  }

  // Filas 43-45: Presuntos autores
  const autores = reportes
    .filter(r => r.autores)
    .map(r => r.autores);
  if (autores.length > 0) {
    ws.getCell('B43').value = [...new Set(autores)].join(', ');
  }

  // === SECCIÓN 6: MEDIOS PROBATORIOS ===
  if (coordenadasRecorrido.length > 0) {
    ws.getCell('B52').value = '[x] Fotografías';
    ws.getCell('E52').value = '[x] Mapa Satelital / Track GPS';
  }

  // Generar buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
  const nombreArchivo = `Reporte_${socio.nombre.replace(/\s+/g, '_')}_${fechaInicio}.xlsx`;

  return { buffer, nombreArchivo };
}
