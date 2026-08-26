# Reporte Territorial - RONAP

Sistema web para la generación automática de Fichas de Reporte Territorial para concesiones castañeras de **RECOLECTORES ORGÁNICOS DE LA NUEZ AMAZÓNICA PERUANA (RONAP)**.

## Descripción

Aplicación web que conecta directamente con **ArcGIS Online** para obtener datos de monitoreo territorial en tiempo real, cruza la información con el padrón de socios, y genera automáticamente la ficha de reporte en formato Excel (.xlsx) con el formato oficial.

## Funcionalidades Principales

1. **Búsqueda de Socio** - Buscar por nombre o código de concesión desde el padrón de socios (Excel)
2. **Conexión en tiempo real con ArcGIS Online** - Consulta directa al Feature Service `Servicio_Gestion_Territorial_RONAP`
3. **Filtro por Fecha** - Seleccionar el período del reporte
4. **Generación Automática del Excel** - Rellena la plantilla oficial con datos del socio + alertas del reporte
5. **Exportación Dual** - Descargar el .xlsx localmente O guardarlo automáticamente en Google Sheets

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14+ (App Router) + React + TypeScript |
| Estilos | Tailwind CSS |
| Backend | Next.js API Routes |
| Datos | Excel de Socios (.xlsx) + ArcGIS Online REST API |
| Excel | exceljs (manipulación de plantilla) |
| Almacenamiento | Google Sheets API v4 + Descarga local |
| Despliegue | Vercel (recomendado) |

## Inicio Rápido

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd reporte-territorial-ronap

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 4. Colocar archivos
# Colocar plantilla en: public/plantilla_base.xlsx
# Colocar padrón de socios en: public/socios.xlsx

# 5. Ejecutar en desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## Documentación

- [Arquitectura del Sistema](docs/ARQUITECTURA.md)
- [Configuración de ArcGIS Online](docs/CONFIGURACION-ARCGIS.md)
- [Guía de Implementación](docs/GUIA-IMPLEMENTACION.md)
- [Estructura del Proyecto](docs/ESTRUCTURA-PROYECTO.md)
- [Flujo de Usuario](docs/FLUJO-USUARIO.md)
- [Generación de Excel](docs/PLANTILLA-EXCEL.md)
- [Integración Google Sheets](docs/GOOGLE-SHEETS-INTEGRATION.md)

## ArcGIS Online - Feature Service

```
Organización: RECOLECTORES ORGÁNICOS DE LA NUEZ AMAZÓNICA PERUANA
Categoría: Gestión territorial
Etiquetas: RONAP, QuickCapture, Monitoreo, Concesiones
```

## Licencia

Uso interno - RONAP
