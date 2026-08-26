# Estructura del Proyecto

## Arquitectura: Monorepo con pnpm Workspaces

```
reporte-territorial-ronap/
│
├── package.json                         # Scripts raíz del monorepo
├── pnpm-workspace.yaml                  # Configuración de workspaces
├── tsconfig.base.json                   # Configuración TypeScript compartida
├── .env.example                         # Plantilla de variables de entorno
├── .gitignore
├── README.md
│
├── docs/                                # Documentación completa
│   ├── ARQUITECTURA.md
│   ├── CONFIGURACION-ARCGIS.md
│   ├── ESTRUCTURA-PROYECTO.md           # ← Este archivo
│   ├── FLUJO-USUARIO.md
│   ├── GUIA-IMPLEMENTACION.md
│   ├── PLANTILLA-EXCEL.md
│   └── GOOGLE-SHEETS-INTEGRATION.md
│
├── packages/
│   └── types/                           # Paquete compartido de tipos
│       ├── package.json
│       ├── tsconfig.json
│       └── index.ts                     # Interfaces: Socio, Reporte, ArcGIS...
│
├── apps/
│   ├── web/                             # FRONTEND - Next.js 14
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.js               # Proxy a backend en :3001
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── public/                      # (vacío por ahora)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx           # Layout con header RONAP
│   │       │   ├── page.tsx             # Página principal (formulario)
│   │       │   └── globals.css          # Tailwind + estilos custom
│   │       ├── components/
│   │       │   ├── BuscadorSocio.tsx    # Dropdown de búsqueda
│   │       │   ├── SelectorFecha.tsx    # Selector de fechas
│   │       │   └── TablaVistaPrevia.tsx # Tabla de vista previa
│   │       └── lib/
│   │           └── api.ts               # URLs del backend
│   │
│   └── api/                             # BACKEND - Express + TypeScript
│       ├── package.json
│       ├── tsconfig.json
│       ├── public/
│       │   ├── plantilla_base.xlsx      # ← Tu plantilla oficial
│       │   └── socios.xlsx              # ← Padrón de socios
│       └── src/
│           ├── index.ts                 # Servidor Express (puerto 3001)
│           ├── routes/
│           │   ├── health.ts            # GET /api/health
│           │   ├── socios.ts            # GET /api/socios
│           │   └── generarReporte.ts    # POST /api/generar-reporte
│           └── services/
│               ├── arcgis.ts            # Conexión a ArcGIS Online
│               ├── socios.ts            # Lectura del Excel de socios
│               ├── excel.ts             # Generación del Excel con plantilla
│               └── googleSheets.ts      # Subida a Google Sheets
│
└── node_modules/                        # (generado por pnpm install)
```

## Archivos que el usuario debe colocar

```
apps/api/public/
├── plantilla_base.xlsx    ← Tu plantilla oficial de la ficha (formato verde)
└── socios.xlsx            ← Padrón: nombre | contrato_TH | sector | provincia | depto | código_concesión
```

## Descripción de Componentes

### Frontend (`apps/web`)
| Archivo | Función |
|---------|---------|
| `page.tsx` | Página principal con formulario de búsqueda |
| `BuscadorSocio.tsx` | Dropdown con autocompletado de socios |
| `SelectorFecha.tsx` | Selector de rango de fechas |
| `TablaVistaPrevia.tsx` | Vista previa de datos antes de generar |
| `api.ts` | Configuración de URLs del backend |
| `globals.css` | Estilos Tailwind + clases custom RONAP |

### Backend (`apps/api`)
| Archivo | Función |
|---------|---------|
| `index.ts` | Servidor Express, puerto 3001 |
| `routes/health.ts` | Endpoint de verificación |
| `routes/socios.ts` | Retorna lista de socios del Excel |
| `routes/generarReporte.ts` | Genera el reporte (ArcGIS → Excel) |
| `services/arcgis.ts` | Consultas REST a ArcGIS Online |
| `services/socios.ts` | Lee el Excel de socios con cache |
| `services/excel.ts` | Rellena la plantilla con exceljs |
| `services/googleSheets.ts` | Sube datos a Google Sheets |

### Paquete Compartido (`packages/types`)
| Archivo | Función |
|---------|---------|
| `index.ts` | Interfaces TypeScript: Socio, Reporte, ArcGISQueryResponse |

## Dependencias Principales

| Paquete | Frontend | Backend | Uso |
|---------|----------|---------|-----|
| next | ✅ | - | Framework React |
| react | ✅ | - | UI |
| tailwindcss | ✅ | - | Estilos |
| express | - | ✅ | Servidor HTTP |
| exceljs | - | ✅ | Manipulación Excel |
| googleapis | - | ✅ | Google Sheets API |
| tsx | - | ✅ | Dev server TypeScript |
| @ronap/types | ✅ | ✅ | Tipos compartidos |

## Comandos

```bash
# Instalar todo
pnpm install

# Desarrollo (frontend + backend en paralelo)
pnpm dev

# Solo frontend
pnpm dev:web

# Solo backend
pnpm dev:api

# Build completo
pnpm build
```
