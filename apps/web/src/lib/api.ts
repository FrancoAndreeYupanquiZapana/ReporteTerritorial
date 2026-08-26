const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = {
  socios: `${API_URL}/api/socios`,
  generarReporte: `${API_URL}/api/generar-reporte`,
  health: `${API_URL}/api/health`,
};
