'use client';

import { useState, useRef, useEffect } from 'react';
import type { Socio } from '@ronap/types';

interface Props {
  socios: Socio[];
  seleccionado: Socio | null;
  onSelect: (socio: Socio | null) => void;
  cargando: boolean;
}

export function BuscadorSocio({ socios, seleccionado, onSelect, cargando }: Props) {
  const [query, setQuery] = useState('');
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtrados = socios.filter(s =>
    s.nombre.toLowerCase().includes(query.toLowerCase()) ||
    s.codigoConcesion.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="label">Nombre del Socio</label>
      <input
        type="text"
        value={seleccionado ? seleccionado.nombre : query}
        onChange={e => {
          setQuery(e.target.value);
          onSelect(null);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        placeholder={cargando ? 'Cargando socios...' : 'Buscar por nombre o código...'}
        disabled={cargando}
        className="input-field"
      />
      {abierto && query.length > 0 && filtrados.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtrados.slice(0, 20).map((socio, i) => (
            <button
              key={i}
              onClick={() => {
                onSelect(socio);
                setQuery('');
                setAbierto(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-green-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <div className="font-medium text-sm text-gray-800">{socio.nombre}</div>
              <div className="text-xs text-gray-500">
                {socio.codigoConcesion} · {socio.sector}
              </div>
            </button>
          ))}
        </div>
      )}
      {abierto && query.length > 0 && filtrados.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
          No se encontraron socios con "{query}"
        </div>
      )}
    </div>
  );
}
