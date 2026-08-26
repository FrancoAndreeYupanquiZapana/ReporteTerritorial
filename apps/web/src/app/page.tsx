'use client';

import { useState, useEffect, useRef } from 'react';
import { BuscadorSocio } from '@/components/BuscadorSocio';
import type { Socio, GenerarReporteResponse } from '@ronap/types';

export default function Home() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [socioSeleccionado, setSocioSeleccionado] = useState<Socio | null>(null);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoSocios, setCargandoSocios] = useState(true);
  const [resultado, setResultado] = useState<GenerarReporteResponse | null>(null);
  const [archivosPendientes, setArchivosPendientes] = useState<GenerarReporteResponse['archivos']>([]);
  const [error, setError] = useState('');
  const autoGeneradoRef = useRef<string>('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/socios`)
      .then(res => res.json())
      .then(data => {
        setSocios(data.socios || []);
        setCargandoSocios(false);
      })
      .catch(() => {
        setError('Error al cargar el padron de socios');
        setCargandoSocios(false);
      });
  }, []);

  const generar = async (nombre: string) => {
    setCargando(true);
    setError('');
    setResultado(null);
    setArchivosPendientes([]);

    try {
      const body: Record<string, string> = { socio: nombre };
      if (fechaInicio) body.fechaInicio = fechaInicio;
      if (fechaFin) body.fechaFin = fechaFin;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/generar-reporte`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      const data: GenerarReporteResponse = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setResultado(data);
      setArchivosPendientes(data.archivos || []);
    } catch {
      setError('Error al conectar con el servidor. Verifique que el backend este activo.');
    } finally {
      setCargando(false);
    }
  };

  const handleSelectSocio = (socio: Socio | null) => {
    setSocioSeleccionado(socio);
    setResultado(null);
    setArchivosPendientes([]);
    setError('');
    if (socio && socio.nombre !== autoGeneradoRef.current) {
      autoGeneradoRef.current = socio.nombre;
      generar(socio.nombre);
    }
  };

  const handleDescargar = (archivo: { archivoBase64: string; nombreArchivo: string; fecha: string }) => {
    const byteCharacters = atob(archivo.archivoBase64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteArray], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = archivo.nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
    setArchivosPendientes(prev => (prev ?? []).filter(f => f.fecha !== archivo.fecha));
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">
          Ficha de Reporte Territorial
        </h2>
        <p className="text-gray-500 mt-1">
          Busque el nombre del socio para generar los reportes
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-ronap-green mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-ronap-green text-white rounded-full flex items-center justify-center text-sm">
              1
            </span>
            Buscar Socio
          </h3>
          <BuscadorSocio
            socios={socios}
            seleccionado={socioSeleccionado}
            onSelect={handleSelectSocio}
            cargando={cargandoSocios}
          />

          {socioSeleccionado && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Contrato TH:</span>
                <span className="font-medium">{socioSeleccionado.contratoTH}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Codigo Concesion:</span>
                <span className="font-medium">{socioSeleccionado.codigoConcesion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sector:</span>
                <span className="font-medium">{socioSeleccionado.sector}</span>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-ronap-green mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-ronap-green text-white rounded-full flex items-center justify-center text-sm">
              2
            </span>
            Filtrar por Fecha (Opcional)
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha Inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Fecha Fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                min={fechaInicio || undefined}
                className="input-field"
              />
            </div>
          </div>
          {fechaInicio && fechaFin && (
            <p className="text-xs text-gray-500 mt-2">
              Desde {new Date(fechaInicio + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}
              {' '}hasta {new Date(fechaFin + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          {!fechaInicio && !fechaFin && (
            <p className="text-xs text-gray-400 mt-2">
              Sin filtro: se mostraran todos los registros del socio
            </p>
          )}
          {socioSeleccionado && (
            <button
              onClick={() => generar(socioSeleccionado.nombre)}
              disabled={cargando}
              className="btn-primary mt-4 w-full"
            >
              {cargando ? 'Generando...' : 'Buscar y Generar'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {cargando && (
        <div className="flex justify-center">
          <span className="text-gray-500">Buscando reportes en ArcGIS...</span>
        </div>
      )}

      {resultado?.success && (archivosPendientes ?? []).length > 0 && (
        <div className="card border-green-200 bg-green-50">
          <h3 className="font-semibold text-green-800 mb-2">
            {resultado.totalReportes} registros encontrados en {(archivosPendientes ?? []).length} fecha(s)
          </h3>
          <p className="text-sm text-green-700 mb-4">
            Descargue un archivo por cada dia del recorrido:
          </p>
          <div className="space-y-2">
            {(archivosPendientes ?? []).map((archivo) => (
              <div key={archivo.fecha} className="flex items-center justify-between bg-white p-3 rounded-lg border border-green-200">
                <div>
                  <span className="font-medium text-gray-800">
                    {new Date(archivo.fecha + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">({archivo.totalReportes} registros)</span>
                </div>
                <button
                  onClick={() => handleDescargar(archivo)}
                  className="btn-primary text-sm px-4 py-1.5"
                >
                  Descargar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
