import { Router } from 'express';
import { queryReportes } from '../services/arcgis';
import { leerSocioPorNombre } from '../services/socios';
import { generarExcel } from '../services/excel';
import { guardarEnSheets } from '../services/googleSheets';
import type { GenerarReporteRequest, GenerarReporteResponse } from '@ronap/types';

export const generarReporteRouter = Router();

generarReporteRouter.post('/generar-reporte', async (req, res) => {
  try {
    const { socio, fechaInicio, fechaFin, guardarEnSheets: debeGuardar } = req.body as GenerarReporteRequest;

    if (!socio || !fechaInicio || !fechaFin) {
      res.status(400).json({ success: false, message: 'Faltan campos obligatorios: socio, fechaInicio, fechaFin' });
      return;
    }

    // 1. Buscar socio en el Excel
    const socioData = await leerSocioPorNombre(socio);
    if (!socioData) {
      res.status(404).json({ success: false, message: `No se encontró el socio "${socio}" en el padrón` });
      return;
    }

    // 2. Consultar reportes en ArcGIS Online (Puntos_Importantes)
    const arcgisResponse = await queryReportes(socio, fechaInicio, fechaFin);

    // Map ArcGIS fields to our format
    // Fields: Titular, Fecha_Hora, Ocurrencia, Descripcion_ocurrencia,
    //         Prioridad, Responsable, Autores_Afectados, Observadores_Adicionales, Equipos_EPP
    const reportes = arcgisResponse.features.map((f, i) => ({
      id: i + 1,
      fecha: formatDate(f.attributes.Fecha_Hora as number),
      tipoAlerta: (f.attributes.Ocurrencia as string) || '',
      descripcion: (f.attributes.Descripcion_ocurrencia as string) || '',
      estado: (f.attributes.Prioridad as string) || '',
      objetoPatrullaje: (f.attributes.Responsable as string) || '',
      equipo: (f.attributes.Equipos_EPP as string) || '',
      coordenadas: f.geometry
        ? `${(f.geometry.y as number)?.toFixed(6) || ''}, ${(f.geometry.x as number)?.toFixed(6) || ''}`
        : '',
      latitud: f.geometry?.y as number || null,
      longitud: f.geometry?.x as number || null,
      autores: (f.attributes.Autores_Afectados as string) || '',
      observadores: (f.attributes.Observadores_Adicionales as string) || '',
    }));

    // 3. Extraer coordenadas del recorrido
    const coordenadasRecorrido = arcgisResponse.features
      .filter(f => f.geometry?.x && f.geometry?.y)
      .map(f => ({
        lat: f.geometry!.y as number,
        lng: f.geometry!.x as number,
      }));

    // 4. Generar Excel
    const { buffer, nombreArchivo } = await generarExcel({
      socio: socioData,
      fechaInicio,
      fechaFin,
      reportes,
      coordenadasRecorrido,
    });

    const archivoBase64 = buffer.toString('base64');

    // 5. Opcionalmente guardar en Google Sheets
    let urlSheets: string | undefined;
    if (debeGuardar) {
      try {
        urlSheets = await guardarEnSheets({
          socio: socioData.nombre,
          contratoTH: socioData.contratoTH,
          codigoConcesion: socioData.codigoConcesion,
          sector: socioData.sector,
          provincia: socioData.provincia,
          departamento: socioData.departamento,
          fechaInicio,
          fechaFin,
          totalAlertas: reportes.length,
          detalleAlertas: JSON.stringify(reportes),
          coordenadas: coordenadasRecorrido.map(c => `${c.lat},${c.lng}`).join(' → '),
        });
      } catch (sheetsError) {
        console.error('[API] Error guardando en Google Sheets:', sheetsError);
      }
    }

    const respuesta: GenerarReporteResponse = {
      success: true,
      message: `Reporte generado con ${reportes.length} registros`,
      archivoBase64,
      nombreArchivo,
      urlSheets,
      totalReportes: reportes.length,
    };

    res.json(respuesta);
  } catch (error) {
    console.error('[API] Error generando reporte:', error);
    const message = error instanceof Error ? error.message : 'Error al generar el reporte';
    res.status(500).json({ success: false, message });
  }
});

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
