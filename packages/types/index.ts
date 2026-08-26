export interface Socio {
  nombre: string;
  contratoTH: string;
  sector: string;
  provincia: string;
  departamento: string;
  codigoConcesion: string;
}

export interface ReporteMonitoreo {
  id: number;
  fecha: string;
  tipoAlerta: string;
  descripcion: string;
  estado: string;
  objetoPatrullaje: string;
  equipo: string;
  coordenadas: string;
  latitud: number | null;
  longitud: number | null;
  autores: string;
  observadores: string;
}

export interface CoordenadaRecorrido {
  lat: number;
  lng: number;
}

export interface GenerarReporteRequest {
  socio: string;
  fechaInicio: string;
  fechaFin: string;
  guardarEnSheets?: boolean;
}

export interface GenerarReporteResponse {
  success: boolean;
  message: string;
  totalReportes?: number;
  archivos?: Array<{
    fecha: string;
    fechaStr: string;
    totalReportes: number;
    archivoBase64: string;
    nombreArchivo: string;
  }>;
  urlSheets?: string;
}

export interface ArcGISFeature {
  attributes: Record<string, unknown>;
  geometry: {
    x?: number;
    y?: number;
    paths?: number[][][];
    rings?: number[][][];
  } | null;
}

export interface ArcGISQueryResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
  count?: number;
}
