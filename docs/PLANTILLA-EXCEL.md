# Generación del Excel (Plantilla)

## Concepto

La aplicación NO genera el Excel desde cero. Utiliza la **plantilla oficial** (`plantilla_base.xlsx`) que ya tiene el formato verde, bordes, encabezados y celdas predefinidas. Solo se rellenan las celdas vacías con los datos correspondientes.

## Por qué exceljs

| Librería | Fortalezas | Debilidades |
|----------|-----------|-------------|
| `exceljs` | Modifica celdas específicas, preserva estilos, soporta bordes y colores | Más pesada |
| `xlsx` (SheetJS) | Rápida, ligera | Difícil preservar formato original, pierde estilos |

**elección: `exceljs`** porque necesitamos mantener el formato verde de la plantilla intacto.

## Flujo de Generación

```
1. Cargar plantilla_base.xlsx
   ↓
2. Obtener worksheet (primera hoja)
   ↓
3. Rellenar celdas de la Sección 1 (Datos del Socio)
   - Celda B3: Nombre del socio
   - Celda B4: N° Contrato TH
   - Celda B5: Código de Concesión
   - Celda B6: Sector
   - Celda B7: Provincia
   - Celda B8: Departamento
   ↓
4. Rellenar celdas de la Sección 2 (Período)
   - Celda D3: Fecha de inicio
   - Celda D4: Fecha de fin
   ↓
5. Rellenar celdas de la Sección 3 (Alertas/Reportes)
   - Fila 9 en adelante: cada fila = 1 reporte de ArcGIS
   - Columna A: Fecha
   - Columna B: Tipo de alerta
   - Columna C: Descripción
   - Columna D: Estado
   - Columna E: Coordenadas (lat, lng)
   ↓
6. Rellenar celdas de la Sección 4 (Coordenadas del Recorrido)
   - Insertar puntos de geometría del recorrido
   ↓
7. Generar buffer en memoria
   ↓
8. Retornar como descarga o subir a Sheets
```

## Código Base del Servicio Excel

```typescript
// src/services/excel.ts

import ExcelJS from 'exceljs';
import path from 'path';

interface DatosReporte {
  socio: {
    nombre: string;
    contratoTH: string;
    codigoConcesion: string;
    sector: string;
    provincia: string;
    departamento: string;
  };
  fechaInicio: string;
  fechaFin: string;
  reportes: Array<{
    fecha: string;
    tipoAlerta: string;
    descripcion: string;
    estado: string;
    coordenadas: string;
  }>;
  coordenadasRecorrido: Array<{ lat: number; lng: number }>;
}

export async function generarExcel(datos: DatosReporte): Promise<Buffer> {
  // 1. Cargar plantilla
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(
    path.join(process.cwd(), 'public', 'plantilla_base.xlsx')
  );

  const worksheet = workbook.getWorksheet(1); // Primera hoja

  if (!worksheet) {
    throw new Error('No se encontró la primera hoja de la plantilla');
  }

  // 2. Sección 1: Datos del Socio
  // NOTA: Estos índices de celda son EJEMPLO.
  // Ajustar según la posición real en tu plantilla.
  worksheet.getCell('B3').value = datos.socio.nombre;
  worksheet.getCell('B4').value = datos.socio.contratoTH;
  worksheet.getCell('B5').value = datos.socio.codigoConcesion;
  worksheet.getCell('B6').value = datos.socio.sector;
  worksheet.getCell('B7').value = datos.socio.provincia;
  worksheet.getCell('B8').value = datos.socio.departamento;

  // 3. Sección 2: Período
  worksheet.getCell('D3').value = datos.fechaInicio;
  worksheet.getCell('D4').value = datos.fechaFin;

  // 4. Sección 3: Alertas/Reportes
  // Empezar en fila 9 (ajustar según tu plantilla)
  let filaActual = 9;
  for (const reporte of datos.reportes) {
    worksheet.getCell(`A${filaActual}`).value = reporte.fecha;
    worksheet.getCell(`B${filaActual}`).value = reporte.tipoAlerta;
    worksheet.getCell(`C${filaActual}`).value = reporte.descripcion;
    worksheet.getCell(`D${filaActual}`).value = reporte.estado;
    worksheet.getCell(`E${filaActual}`).value = reporte.coordenadas;
    filaActual++;
  }

  // 5. Sección 4: Coordenadas del Recorrido
  // Coordenadas en formato texto para la celda
  const coordsTexto = datos.coordenadasRecorrido
    .map(c => `${c.lat}, ${c.lng}`)
    .join(' → ');
  worksheet.getCell('B20').value = coordsTexto; // Ajustar celda

  // 6. Generar buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
```

## Mapeo de Celdas de la Plantilla

**IMPORTANTE:** Antes de implementar, abrir `plantilla_base.xlsx` en Excel y anotar la posición exacta de cada celda.

Estructura típón de la ficha:

```
     A              B              C              D              E
┌──────────┬──────────────┬──────────────┬──────────────┬──────────────┐
1│          │  FICHA DE REPORTE TERRITORIAL - RONAP                    │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┤
2│ SECCIÓN 1: DATOS DEL SOCIO                                         │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┤
3│ Nombre   │ [JUAN PEREZ] │              │ Fecha Ini:  │ [01/08/2026] │
4│ Contrato │ [CTH-001]    │              │ Fecha Fin:  │ [31/08/2026] │
5│ Código   │ [CC-2024-001]│              │              │              │
6│ Sector   │ [Norte]      │              │              │              │
7│ Prov.    │ [Loreto]     │              │              │              │
8│ Depto.   │ [San Martín] │              │              │              │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┤
9│ SECCIÓN 2: REPORTES DE MONITOREO                                   │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┤
10│ Fecha   │ Tipo Alerta  │ Descripción  │ Estado       │ Coordenadas  │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┤
11│ [03/08] │ [Tala Ilegal]│ [Corte de..] │ [Abierta]    │ [-3.4, -73.2]│
12│ [10/08] │ [Fauna]      │ [Avistami..] │ [Cerrada]    │ [-3.5, -73.1]│
...│ ...    │ ...          │ ...          │ ...          │ ...          │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ SECCIÓN 3: COORDENADAS DEL RECORRIDO                               │
├──────────┼──────────────┼──────────────┼──────────────┼──────────────┤
20│ Ruta:   │ -3.4,-73.2 → -3.5,-73.1 → -3.6,-73.0               │
└──────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

> **Ajustar los índices de celda (B3, D3, etc.) según la posición REAL en tu plantilla oficial.**

## Mapeo de Campos de ArcGIS → Excel

| Campo ArcGIS | Celda Excel | Sección |
|-------------|-------------|---------|
| `nombre_socio` | B3 | Datos del Socio |
| `fecha_reporte` | A11, A12... | Reportes |
| `tipo_alerta` | B11, B12... | Reportes |
| `descripcion` | C11, C12... | Reportes |
| `estado` | D11, D12... | Reportes |
| geometry (x,y) | E11, E12... | Reportes |
| geometry (paths) | B20 | Recorrido |

> **Nota:** Los nombres de campos de ArcGIS se obtienen de `?f=json` del Feature Service. Ajustar según tu esquema real.
