# Arquitectura del Sistema

## Diagrama General

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAVEGADOR (USER)                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Buscador    │  │  Selector    │  │  Botón Generar       │  │
│  │  Socio       │  │  Fecha       │  │  Reporte             │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼────────────────┼──────────────────────┼───────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS (APP ROUTER)                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    FRONTEND (React)                      │   │
│  │  page.tsx → Formulario de búsqueda                      │   │
│  │  → Seleccionar socio del dropdown                       │   │
│  │  → Elegir fecha del calendario                          │   │
│  │  → Enviar petición POST a /api/generar-reporte          │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │               API ROUTES (Backend)                       │   │
│  │                                                          │   │
│  │  /api/socios/route.ts                                    │   │
│  │  → Lee public/socios.xlsx                               │   │
│  │  → Retorna lista de socios para el dropdown             │   │
│  │                                                          │   │
│  │  /api/generar-reporte/route.ts                           │   │
│  │  → Recibe: { socio, fecha }                             │   │
│  │  → Consulta ArcGIS Online (fetch REST API)              │   │
│  │  → Consulta socio en Excel                              │   │
│  │  → Rellena plantilla con exceljs                        │   │
│  │  → Opcional: sube a Google Sheets                       │   │
│  │  → Retorna: archivo .xlsx o URL de Sheets               │   │
│  └──────┬───────────────────────────┬──────────────────────┘   │
│         │                           │                          │
└─────────┼───────────────────────────┼──────────────────────────┘
          │                           │
          ▼                           ▼
┌──────────────────┐    ┌──────────────────────────────┐
│  ARCGIS ONLINE   │    │     GOOGLE SHEETS API        │
│                  │    │                              │
│  Feature Service │    │  Hoja de cálculo de reportes │
│  REST API        │    │  (almacenamiento histórico)  │
│  (query + where) │    │                              │
└──────────────────┘    └──────────────────────────────┘
```

## Flujo de Datos

### 1. Carga Inicial
```
App arranca
  → GET /api/socios
    → Lee public/socios.xlsx
    → Retorna array de socios: [{ nombre, contratoTH, sector, provincia, departamento }]
  → Frontend renderiza dropdown con nombres de socios
```

### 2. Generación de Reporte
```
Usuario selecciona socio + fecha
  → POST /api/generar-reporte { socio: "Juan Perez", fecha: "2026-08-01" }
    → 1. Buscar socio en socios.xlsx → obtener código concesión, contrato, etc.
    → 2. Consultar ArcGIS Online:
         GET FeatureServer/0/query
           ?where=nombre_socio='Juan Perez' AND fecha_reporte='2026-08-01'
           &outFields=*
           &returnGeometry=true
           &f=json
    → 3. Procesar respuesta: extraer atributos + geometría (coordenadas)
    → 4. Cargar plantilla plantilla_base.xlsx
    → 5. Rellenar celdas específicas con datos del socio + alertas
    → 6. Generar buffer en memoria
    → 7a. Descargar como .xlsx
    → 7b. O subir a Google Sheets vía API
```

## Capas del Feature Service

El Feature Service `Servicio_Gestion_Territorial_RONAP` contiene **2 capas**:

### Capa 0: Datos de Monitoreo
Contiene los registros de patrullaje/reportes territoriales con:
- Atributos del reporte (fecha, socio, descripción, etc.)
- Geometría (puntos/líneas/zonas del recorrido)

### Capa 1: Visualización
Posiblemente capas de visualización oreferencia para el mapa.

## Variables de Entorno Requeridas

```env
# ArcGIS Online
ARCGIS_FEATURE_SERVICE_URL=https://services8.arcgis.com/T9uUJQ5byxgBtGFO/arcgis/rest/services/Servicio_Gestion_Territorial_RONAP/FeatureServer
ARCGIS_API_KEY=tu_api_key_aqui  # O token de acceso

# Google Sheets (opcional)
GOOGLE_SHEETS_SPREADSHEET_ID=tu_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Decisiones de Arquitectura

| Decisión | Elección | Razón |
|----------|----------|-------|
| Framework | Next.js 14+ | Fullstack en uno solo, API Routes + React |
| Conexión ArcGIS | fetch REST API | Sin dependencias externas, nativo de Node.js |
| Manipulación Excel | exceljs | Permite celdas específicas, estilos, bordes |
| Autenticación ArcGIS | API Key / Token | Simple y seguro desde backend |
| Google Sheets | googleapis | SDK oficial de Google para Node.js |
| Estilos | Tailwind CSS | Rápido, responsive, sin CSS custom |
| Despliegue | Vercel | Hosting nativo para Next.js |
