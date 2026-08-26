# Integración con Google Sheets

## Concepto

Opcionalmente, cada reporte generado puede guardarse automáticamente en una hoja de cálculo de Google Sheets para mantener un **histórico de reportes** sin depender solo del archivo Excel descargado.

## Configuración en Google Cloud

### Paso 1: Crear Proyecto en Google Cloud

1. Ir a [console.cloud.google.com](https://console.cloud.google.com/)
2. Crear nuevo proyecto: "RONAP Reportes"
3. Habilitar la API: **Google Sheets API**
4. Ir a **Credentials** → **Create Credentials** → **Service Account**
5. Copiar el email del Service Account
6. Generar **JSON Key** → descargar el archivo

### Paso 2: Compartir la Hoja de Cálculo

1. Crear una hoja de Google Sheets (o usar una existente)
2. Compartirla con el email del Service Account (dar permisos de **Editor**)
3. Copiar el **Spreadsheet ID** de la URL:
   ```
   https://docs.google.com/spreadsheets/d/ESTE_ES_EL_SPREADSHEET_ID/edit
   ```

### Paso 3: Variables de Entorno

```env
GOOGLE_SHEETS_SPREADSHEET_ID=1ABC...XYZ
GOOGLE_SERVICE_ACCOUNT_EMAIL=ronap-reportes@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----"
```

## Código de Conexión

```typescript
// src/services/googleSheets.ts

import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

// Cabecera de la hoja (fila 1)
const HEADERS = [
  'Fecha Reporte',
  'Socio',
  'Contrato TH',
  'Código Concesión',
  'Sector',
  'Provincia',
  'Departamento',
  'Fecha Inicio',
  'Fecha Fin',
  'N° Alertas',
  'Detalle Alertas',
  'Coordenadas Recorrido',
  'Generado El',
];

export async function guardarEnSheets(datos: {
  socio: string;
  contratoTH: string;
  codigoConcesion: string;
  sector: string;
  provincia: string;
  departamento: string;
  fechaInicio: string;
  fechaFin: string;
  totalAlertas: number;
  detalleAlertas: string;
  coordenadas: string;
}): Promise<string> {
  // 1. Verificar si la hoja tiene cabeceras
  const existingData = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Reportes!A1:M1',
  });

  // 2. Si no tiene cabeceras, insertarlas
  if (!existingData.data.values) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Reportes!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }

  // 3. Agregar nueva fila con los datos del reporte
  const now = new Date().toISOString();
  const row = [
    now,
    datos.socio,
    datos.contratoTH,
    datos.codigoConcesion,
    datos.sector,
    datos.provincia,
    datos.departamento,
    datos.fechaInicio,
    datos.fechaFin,
    datos.totalAlertas,
    datos.detalleAlertas,
    datos.coordenadas,
    now,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Reportes!A:M',
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });

  // 4. Retornar URL de la hoja
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
}
```

## Integración con la API de Generación

```typescript
// En src/app/api/generar-reporte/route.ts

import { guardarEnSheets } from '@/services/googleSheets';

// Después de generar el Excel...
if (guardarEnSheets) {
  const urlSheets = await guardarEnSheets({
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
    coordenadas: coordenadasRecorrido.join(' → '),
  });

  return NextResponse.json({
    success: true,
    urlSheets,
    message: 'Reporte guardado en Google Sheets',
  });
}
```

## Estructura de la Hoja de Google Sheets

```
Hoja: "Reportes"
┌───────┬────────────┬───────────┬──────────────┬────────┬─────────┬───────────┬───────────┬───────────┬───────────┬──────────┬──────────────┬───────────┐
│ A     │ B          │ C         │ D            │ E      │ F       │ G         │ H         │ I         │ J         │ K        │ L            │ M         │
├───────┼────────────┼───────────┼──────────────┼────────┼─────────┼───────────┼───────────┼───────────┼───────────┼──────────┼──────────────┼───────────┤
│Fecha  │ Socio      │ Contrato  │ Cod Conces.  │ Sector │ Prov.   │ Depto.    │ Fec Ini   │ Fec Fin   │ N Alertas │ Detalle  │ Coords       │ Gen El    │
│Reporte│            │ TH        │              │        │         │           │           │           │           │ Alertas  │ Recorrido    │           │
├───────┼────────────┼───────────┼──────────────┼────────┼─────────┼───────────┼───────────┼───────────┼───────────┼──────────┼──────────────┼───────────┤
│25/08  │ JUAN PEREZ │ CTH-001   │ CC-2024-001  │ Norte  │ Loreto  │ San Mart. │ 01/08/26  │ 31/08/26  │ 3         │ [{...}]  │ -3.4,-73.2   │ 25/08/26  │
└───────┴────────────┴───────────┴──────────────┴────────┴─────────┴───────────┴───────────┴───────────┴───────────┴──────────┴──────────────┴───────────┘
```

## Flujo del Usuario

```
1. Usuario genera reporte
2. App muestra opciones:
   ├─ [📥 Descargar Excel]
   └─ [📊 Guardar en Google Sheets] (checkbox)

3. Si marca "Guardar en Sheets":
   → Se genera el Excel
   → Se sube la fila a Google Sheets
   → Se muestra: "Reporte guardado. Ver en Sheets: [enlace]"
```

## Notas Importantes

- El Service Account solo puede acceder a hojas que le hayan sido **compartidas explícitamente**
- El nombre de la hoja dentro del spreadsheet debe ser **"Reportes"** (o ajustar en el código)
- Si la hoja ya tiene datos, `append` agrega al final sin sobreescribir
- Los datos se guardan como **texto plano** (no fórmulas)
- Para consultas históricas, se puede usar la hoja como base de datos
