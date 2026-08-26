import type { ArcGISQueryResponse } from '@ronap/types';

const ARCGIS_BASE_URL = process.env.ARCGIS_FEATURE_SERVICE_URL;
const ARCGIS_API_KEY = process.env.ARCGIS_API_KEY;

export async function queryReportes(
  nombreSocio: string,
  fechaInicio: string,
  fechaFin: string
): Promise<ArcGISQueryResponse> {
  if (!ARCGIS_BASE_URL) {
    throw new Error('ARCGIS_FEATURE_SERVICE_URL no está configurada en .env');
  }

  // Field names from the actual Feature Service:
  // Titular, Fecha_Hora, Ocurrencia, Descripcion_ocurrencia,
  // Prioridad, Responsable, Autores_Afectados, Observadores_Adicionales, Equipos_EPP
  const where = [
    `Titular='${nombreSocio}'`,
    `Fecha_Hora >= DATE '${fechaInicio}'`,
    `Fecha_Hora < DATE '${fechaFin}'`,
  ].join(' AND ');

  const params = new URLSearchParams({
    where,
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
    resultRecordCount: '2000',
  });

  if (ARCGIS_API_KEY) {
    params.append('token', ARCGIS_API_KEY);
  }

  const url = `${ARCGIS_BASE_URL}/0/query?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error consultando ArcGIS Online: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`ArcGIS error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data as ArcGISQueryResponse;
}

export async function queryRecorridos(
  nombreSocio: string,
  fechaInicio: string,
  fechaFin: string
): Promise<ArcGISQueryResponse> {
  if (!ARCGIS_BASE_URL) {
    throw new Error('ARCGIS_FEATURE_SERVICE_URL no está configurada en .env');
  }

  const params = new URLSearchParams({
    where: `1=1`,
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
    resultRecordCount: '2000',
  });

  if (ARCGIS_API_KEY) {
    params.append('token', ARCGIS_API_KEY);
  }

  // Layer 1 = Recorridos y Trochas
  const url = `${ARCGIS_BASE_URL}/1/query?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error consultando ArcGIS Online (Recorridos): ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`ArcGIS error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data as ArcGISQueryResponse;
}
