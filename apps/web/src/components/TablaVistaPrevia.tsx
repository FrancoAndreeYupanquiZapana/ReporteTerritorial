'use client';

interface ReporteFila {
  fecha: string;
  tipoAlerta: string;
  descripcion: string;
  estado: string;
  coordenadas: string;
}

interface Props {
  reportes: ReporteFila[];
}

export function TablaVistaPrevia({ reportes }: Props) {
  if (reportes.length === 0) return null;

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-ronap-green mb-3">
        Vista Previa ({reportes.length} reportes)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-green-50 text-left">
              <th className="px-3 py-2 rounded-l-lg">Fecha</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 rounded-r-lg">Coordenadas</th>
            </tr>
          </thead>
          <tbody>
            {reportes.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2">{r.fecha}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs">
                    {r.tipoAlerta}
                  </span>
                </td>
                <td className="px-3 py-2 max-w-xs truncate">{r.descripcion}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    r.estado === 'Cerrada' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {r.estado}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 font-mono">{r.coordenadas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
