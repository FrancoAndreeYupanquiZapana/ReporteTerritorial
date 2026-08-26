# Configuración de ArcGIS Online

## Feature Service

**Nombre:** Servicio_Gestion_Territorial_RONAP

**URL Base:**
```
https://services8.arcgis.com/T9uUJQ5byxgBtGFO/arcgis/rest/services/Servicio_Gestion_Territorial_RONAP/FeatureServer
```

**Organización:** RECOLECTORES ORGÁNICOS DE LA NUEZ AMAZÓNICA PERUANA

## Estructura del Feature Service

```
Servicio_Gestion_Territorial_RONAP (FeatureServer)
├── Capa 0: [Nombre de capa de datos]     ← Capa principal de reportes
└── Capa 1: [Nombre de capa de viz]       ← Capa de visualización
```

## Cómo Obtener la API Key / Token

### Opción 1: API Key desde ArcGIS Online

1. Ir a `https://www.arcgis.com/` → Iniciar sesión con tu cuenta RONAP
2. Ir a **My Organization** → **Edit Settings**
3. Pestaña **Security** → **API Keys**
4. Crear nueva API Key con permisos de lectura sobre el Feature Service
5. Copiar la key generada

### Opción 2: Token de Aplicación

1. Ir a `https://developers.arcgis.com/`
2. Crear una **Application** nueva
3. Registrar el Feature Service como servicio autorizado
4. Obtener el **Client ID** y **Client Secret**
5. Generar token vía OAuth

### Opción 3: Acceso Público (si aplica)

Si tu Feature Service está compartido públicamente:
- No necesitas autenticación
- Solo necesitas la URL del FeatureServer
- En el código usarías fetch directo sin headers de auth

## Consultas REST API

### Listar Capas Disponibles
```
GET https://services8.arcgis.com/T9uUJQ5byxgBtGFO/arcgis/rest/services/Servicio_Gestion_Territorial_RONAP/FeatureServer?f=json
```

### Obtener Esquema de una Capa (Campos)
```
GET .../FeatureServer/0?f=json
```
Esto retorna los nombres de los campos, tipos de datos y metadatos.

### Consultar Registros (Query)
```
GET .../FeatureServer/0/query
  ?where=nombre_socio='JUAN PEREZ' AND fecha_reporte BETWEEN TIMESTAMP '2026-08-01 00:00:00' AND TIMESTAMP '2026-08-31 23:59:59'
  &outFields=*
  &returnGeometry=true
  &outSR=4326
  &f=json
```

### Parámetros Importantes

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `where` | Filtro SQL | `nombre='Juan' AND fecha > '2026-01-01'` |
| `outFields` | Campos a retornar | `*` (todos) o `campo1,campo2` |
| `returnGeometry` | Incluir geometría | `true` o `false` |
| `outSR` | Sistema de coordenadas | `4326` (WGS84, lat/lng) |
| `f` | Formato respuesta | `json` o `pjson` |
| `resultOffset` | Paginación | `0`, `1000`, `2000`... |
| `resultRecordCount` | Límite de registros | `1000` |

## Ejemplo Completo de Conexión en TypeScript

```typescript
// src/services/arcgis.ts

const ARCGIS_BASE_URL = process.env.ARCGIS_FEATURE_SERVICE_URL;
const ARCGIS_API_KEY = process.env.ARCGIS_API_KEY;

interface ArcGISResponse {
  features: Array<{
    attributes: Record<string, unknown>;
    geometry: {
      x?: number;
      y?: number;
      paths?: number[][][];
      rings?: number[][][];
    };
  }>;
  exceededTransferLimit?: boolean;
}

export async function queryReportes(
  nombreSocio: string,
  fechaInicio: string,
  fechaFin: string
): Promise<ArcGISResponse> {
  const where = `nombre_socio='${nombreSocio}' AND fecha_reporte BETWEEN TIMESTAMP '${fechaInicio} 00:00:00' AND TIMESTAMP '${fechaFin} 23:59:59'`;

  const params = new URLSearchParams({
    where,
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
    ...(ARCGIS_API_KEY && { token: ARCGIS_API_KEY }),
  });

  const url = `${ARCGIS_BASE_URL}/0/query?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error consultando ArcGIS: ${response.statusText}`);
  }

  return response.json();
}
```

## Campos Esperados (A verificar en tu Feature Service)

Para consultar los campos exactos, ejecuta:
```
GET .../FeatureServer/0?f=json
```

Campos típicos que deberías tener:
- `nombre_socio` o `concesionario` - Nombre del socio
- `fecha_reporte` o `fecha` - Fecha del reporte
- `descripcion` o `observaciones` - Descripción del patrullaje
- `tipo_alerta` o `categoria` - Tipo de alerta encontrada
- `objeto_patrullaje` - Objetivo del patrullaje
- `equipo` - Equipo usado
- `estado` - Estado de la alerta
- `coordenadas` o `geometry` - Geometría del punto/ruta

> **IMPORTANTE:** Antes de implementar, ejecuta el query `?f=json` para obtener el esquema exacto de tus campos y ajustar el código acorde.
