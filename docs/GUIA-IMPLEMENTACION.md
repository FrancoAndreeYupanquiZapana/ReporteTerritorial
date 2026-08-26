# Guía de Implementación

## Requisitos Previos

- Node.js 18+ instalado
- npm o yarn
- Cuenta en ArcGIS Online (con acceso al Feature Service)
- (Opcional) Cuenta Google Cloud para Sheets API
- Archivo `plantilla_base.xlsx` (formato oficial de la ficha)
- Archivo `socios.xlsx` (padrón de socios)

## Paso 1: Crear el Proyecto

```bash
npx create-next-app@latest reporte-territorial-ronap \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd reporte-territorial-ronap
```

## Paso 2: Instalar Dependencias

```bash
# Manipulación de Excel
npm install exceljs

# Google Sheets (opcional)
npm install googleapis

# Utilidades
npm install date-fns
```

## Paso 3: Configurar Variables de Entorno

Crear `.env.local` en la raíz del proyecto:

```env
# === ARCGIS ONLINE ===
ARCGIS_FEATURE_SERVICE_URL=https://services8.arcgis.com/T9uUJQ5byxgBtGFO/arcgis/rest/services/Servicio_Gestion_Territorial_RONAP/FeatureServer
ARCGIS_API_KEY=tu_api_key_aqui

# === GOOGLE SHEETS (Opcional) ===
GOOGLE_SHEETS_SPREADSHEET_ID=tu_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----"

# === APP ===
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Paso 4: Colocar Archivos Estáticos

```
public/
├── plantilla_base.xlsx    ← Tu plantilla oficial de la ficha
└── socios.xlsx            ← Padrón de socios con: nombre, contrato_TH, sector, provincia, departamento
```

## Paso 5: Crear Estructura de Código

Crear la estructura de archivos según [ESTRUCTURA-PROYECTO.md](ESTRUCTURA-PROYECTO.md)

## Paso 6: Implementar Conexión con ArcGIS

Ver [CONFIGURACION-ARCGIS.md](CONFIGURACION-ARCGIS.md) para el código del servicio de conexión.

## Paso 7: Implementar API de Socios

```typescript
// src/app/api/socios/route.ts
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import path from 'path';

export async function GET() {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(process.cwd(), 'public', 'socios.xlsx'));
    
    const worksheet = workbook.getWorksheet(1);
    const socios: Socio[] = [];

    worksheet?.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Saltar header
      
      socios.push({
        nombre: row.getCell(1).value?.toString() || '',
        contratoTH: row.getCell(2).value?.toString() || '',
        sector: row.getCell(3).value?.toString() || '',
        provincia: row.getCell(4).value?.toString() || '',
        departamento: row.getCell(5).value?.toString() || '',
        codigoConcesion: row.getCell(6).value?.toString() || '',
      });
    });

    return NextResponse.json({ socios });
  } catch (error) {
    return NextResponse.json({ error: 'Error leyendo socios' }, { status: 500 });
  }
}
```

## Paso 8: Implementar API de Generación de Reporte

```typescript
// src/app/api/generar-reporte/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { queryReportes } from '@/services/arcgis';
import { generarExcel } from '@/services/excel';

export async function POST(request: NextRequest) {
  const { socio, fechaInicio, fechaFin } = await request.json();

  // 1. Consultar ArcGIS Online
  const datosArcGIS = await queryReportes(socio, fechaInicio, fechaFin);

  // 2. Generar Excel con la plantilla
  const excelBuffer = await generarExcel(socio, datosArcGIS);

  // 3. Retornar archivo
  return new NextResponse(excelBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte_${socio}_${fechaInicio}.xlsx"`,
    },
  });
}
```

## Paso 9: Implementar Frontend

Crear el formulario de búsqueda en `src/app/page.tsx` con:
- Dropdown de socios (cargado de /api/socios)
- Selector de rango de fechas
- Botón de generar reporte
- Indicador de carga

## Paso 10: (Opcional) Integrar Google Sheets

Ver [GOOGLE-SHEETS-INTEGRATION.md](GOOGLE-SHEETS-INTEGRATION.md)

## Paso 11: Verificar Esquema de ArcGIS

**CRÍTICO:** Antes de continuar, verificar los campos exactos de tu Feature Service:

```bash
# Ejecutar en terminal
curl "https://services8.arcgis.com/T9uUJQ5byxgBtGFO/arcgis/rest/services/Servicio_Gestion_Territorial_RONAP/FeatureServer/0?f=json" | jq '.fields[] | .name'
```

Esto mostrará todos los nombres de campos. Ajustar el código de `arcgis.ts` y el mapeo en `generarExcel` según los campos reales.

## Paso 12: Verificar Formato del Excel de Socios

El archivo `socios.xlsx` debe tener estas columnas (ajustar según tu archivo real):

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Nombre | Contrato TH | Sector | Provincia | Departamento | Código Concesión |
| Juan Perez | CTH-001 | Norte | Loreto | San Martín | CC-2024-001 |

> Ajustar los índices de columna en el código de la API de socios según el orden real de tu archivo.

## Pasos Finales

```bash
# Ejecutar en desarrollo
npm run dev

# Abrir http://localhost:3000
# Probar: seleccionar socio → elegir fecha → generar reporte
```

## Despliegue en Vercel

```bash
# Instalar CLI de Vercel
npm i -g vercel

# Desplegar
vercel

# Configurar variables de entorno en el dashboard de Vercel
# Subir plantilla_base.xlsx y socios.xlsx a public/
```
