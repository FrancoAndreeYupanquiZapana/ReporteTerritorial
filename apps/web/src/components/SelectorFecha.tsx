'use client';

interface Props {
  fechaInicio: string;
  fechaFin: string;
  onChangeInicio: (v: string) => void;
  onChangeFin: (v: string) => void;
}

export function SelectorFecha({ fechaInicio, fechaFin, onChangeInicio, onChangeFin }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Fecha de Inicio</label>
        <input
          type="date"
          value={fechaInicio}
          onChange={e => onChangeInicio(e.target.value)}
          className="input-field"
        />
      </div>
      <div>
        <label className="label">Fecha de Fin</label>
        <input
          type="date"
          value={fechaFin}
          min={fechaInicio || undefined}
          onChange={e => onChangeFin(e.target.value)}
          className="input-field"
        />
      </div>
      {fechaInicio && fechaFin && (
        <p className="text-xs text-gray-500">
          Período: {fechaInicio} al {fechaFin}
        </p>
      )}
    </div>
  );
}
