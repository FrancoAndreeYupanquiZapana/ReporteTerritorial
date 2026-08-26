# Flujo de Usuario

## Flujo Principal

```
┌─────────────────────────────────────────────────────────────┐
│                    PANTALLA DE INICIO                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           FICHA DE REPORTE TERRITORIAL               │   │
│  │                   RONAP                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  SECCIÓN 1: DATOS DEL SOCIO                         │   │
│  │                                                      │   │
│  │  Nombre: [▼ Seleccionar socio...]                   │   │
│  │                                                      │   │
│  │  (Al seleccionar, se autocompletan:)                 │   │
│  │  N° Contrato TH: ──────────────────                  │   │
│  │  Código Concesión: ─────────────────                 │   │
│  │  Sector: ──────────────────                          │   │
│  │  Provincia: ──────────────────                       │   │
│  │  Departamento: ──────────────────                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  SECCIÓN 2: PERÍODO DEL REPORTE                     │   │
│  │                                                      │   │
│  │  Fecha Inicio: [📅 01/08/2026]                      │   │
│  │  Fecha Fin:    [📅 31/08/2026]                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           [ 🔍 GENERAR REPORTE ]                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Opcional: Guardar en Google Sheets [✅]             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Secuencia de Pasos

### Paso 1: El usuario abre la aplicación
```
Navegador → http://localhost:3000 (o URL de Vercel)
  → Se carga page.tsx
  → useEffect llama a GET /api/socios
  → Se llena el dropdown con nombres de socios
```

### Paso 2: El usuario selecciona un socio
```
Usuario selecciona "JUAN PEREZ" en el dropdown
  → Se busca el socio en el array cargado
  → Se autocompletan los campos:
    - N° Contrato TH: CTH-001
    - Código Concesión: CC-2024-001
    - Sector: Norte
    - Provincia: Loreto
    - Departamento: San Martín
```

### Paso 3: El usuario selecciona fechas
```
Usuario abre calendario de "Fecha Inicio" → selecciona 01/08/2026
Usuario abre calendario de "Fecha Fin" → selecciona 31/08/2026
```

### Paso 4: El usuario hace clic en "Generar Reporte"
```
Click en botón
  → Se muestra LoadingSpinner
  → Se envía POST /api/generar-reporte
    Body: {
      socio: "JUAN PEREZ",
      fechaInicio: "2026-08-01",
      fechaFin: "2026-08-31"
    }
```

### Paso 5: Backend procesa la solicitud
```
POST /api/generar-reporte
  │
  ├─→ 1. Leer socios.xlsx → buscar "JUAN PEREZ"
  │     → obtener: contratoTH, codigoConcesion, sector, provincia, depto
  │
  ├─→ 2. Consultar ArcGIS Online
  │     GET FeatureServer/0/query
  │       ?where=nombre_socio='JUAN PEREZ'
  │         AND fecha_reporte BETWEEN '2026-08-01' AND '2026-08-31'
  │       &outFields=*&returnGeometry=true&f=json
  │     → obtener: array de reportes con atributos + geometría
  │
  ├─→ 3. Cargar plantilla_base.xlsx (mantiene formato original)
  │
  ├─→ 4. Rellenar celdas de la plantilla:
  │     Sección 1 → datos del socio (auto-completados)
  │     Sección 2 → fechas del período
  │     Sección 3 → tabla de alertas/reports de ArcGIS
  │     Sección 4 → coordenadas del recorrido (de geometría)
  │
  ├─→ 5. Generar buffer en memoria (exceljs)
  │
  └─→ 6a. Si "Solo descargar":
  │       → Retornar archivo .xlsx como attachment
  │
  └─→ 6b. Si "Guardar en Google Sheets":
          → Subir datos a Google Sheets vía API
          → Retornar URL de la hoja de cálculo
```

### Paso 6: El usuario recibe el resultado
```
Opción A: Descarga automática
  → Se descarga "reporte_JUAN_PEREZ_2026-08-01.xlsx"
  → El archivo se abre en Excel/LibreOffice
  → Formato verde oficial intacto

Opción B: Google Sheets
  → Se muestra enlace a la hoja de Google Sheets
  → Click → se abre en nueva pestaña
  → Datos guardados históricamente
```

## Flujo de Error

```
Si hay error en cualquier paso:

ArcGIS no responde
  → Mensaje: "Error al conectar con ArcGIS Online. Verifique su conexión."

Socio no encontrado en ArcGIS
  → Mensaje: "No se encontraron reportes para este socio en el período seleccionado."

Excel de socios no encontrado
  → Mensaje: "Error al cargar el padrón de socios. Contacte al administrador."

Google Sheets falla
  → Mensaje: "Error al guardar en Google Sheets. El archivo se descargará localmente."
```

## Vista Previa (Opcional - Fase 2)

Antes de generar el Excel, se podría mostrar una tabla con los datos que se insertarán:

```
┌─────────────────────────────────────────────────────┐
│  VISTA PREVIA DEL REPORTE                           │
│                                                      │
│  Socio: JUAN PEREZ | Período: 01/08 - 31/08/2026   │
│  Contrato TH: CTH-001 | Concesión: CC-2024-001     │
│                                                      │
│  ┌──────┬────────────┬─────────────┬──────────┐     │
│  │ Fecha│ Tipo       │ Descripción │ Estado   │     │
│  ├──────┼────────────┼─────────────┼──────────┤     │
│  │ 03/08│ Tala Ilegal│ Corte de... │ Abierta  │     │
│  │ 10/08│ Fauna      │ Avistamiento│ Cerrada  │     │
│  │ 15/08│ Incendio   │ Humo en ... │ Abierta  │     │
│  └──────┴────────────┴─────────────┴──────────┘     │
│                                                      │
│  Total alertas: 3                                    │
│                                                      │
│  [ ✅ Generar Excel ]  [ 📊 Guardar en Sheets ]     │
└─────────────────────────────────────────────────────┘
```
