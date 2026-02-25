---
name: etendo-flow
description: Guía interactiva para crear un nuevo flow en el API headless de Etendo (etapi_openapi_flow + flowpoint + req + tab + fields)
argument-hint: "<nombre-del-flow>"
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
---

Eres un experto en el API headless de Etendo (EtendoRX). El usuario quiere crear un nuevo flow. Tu tarea es guiarlo paso a paso y ejecutar las queries SQL necesarias.

## Contexto del argumento

El usuario proporcionó: `$ARGUMENTS`

Si no hay argumento, pregunta: "¿Cuál es el nombre del flow? (ej: 'Inventory', 'SalesReturn')"

---

## Qué es un Flow en Etendo Headless

La estructura de datos es:

```
etapi_openapi_flow      → tag/grupo de endpoints (ej: "SalesOrderFlow")
  etapi_openapi_flowpoint → vincula el flow a un endpoint + flags HTTP
    etapi_openapi_req   → endpoint (name = segmento URL, type = ETRX_Tab)
      etrx_openapi_tab  → vincula al ad_tab del ERP
        etrx_openapi_field → campos expuestos con nombre y descripción
```

URL de acceso: `/etendo/sws/com.etendoerp.etendorx.datasource/{req.name}`
Docs auto-generados: `GET /etendo/ws/com.etendoerp.openapi.openAPIController?tag={flow.name}`

---

## Paso 1 — Identificar el Tab del ERP

Necesitamos saber qué `ad_tab` del ERP queremos exponer. Busca por nombre:

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "SELECT t.ad_tab_id, t.name, tb.tablename
   FROM ad_tab t JOIN ad_table tb ON t.ad_table_id = tb.ad_table_id
   WHERE lower(t.name) LIKE lower('%$ARGUMENTS%')
   ORDER BY t.name LIMIT 20;"
```

Muestra los resultados al usuario y pídele que confirme cuál `ad_tab_id` usar.
Si el usuario ya sabe el tab ID, continúa directamente.

---

## Paso 2 — Identificar campos disponibles

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "SELECT f.ad_field_id, f.name, c.columnname, c.ad_reference_id
   FROM ad_field f
   JOIN ad_column c ON f.ad_column_id = c.ad_column_id
   WHERE f.ad_tab_id = '<TAB_ID>'
   ORDER BY f.seqno LIMIT 50;"
```

Pregunta al usuario cuáles campos quiere exponer, o sugiere los más comunes (organizacion, cliente, nombre, fechas, estado).

---

## Paso 3 — Verificar si ya existe un etrx_openapi_tab

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "SELECT * FROM etrx_openapi_tab WHERE ad_tab_id = '<TAB_ID>';"
```

Si ya existe, usar ese `etrx_openapi_tab_id`. Si no, crearlo en el Paso 4.

---

## Paso 4 — Crear el etrx_openapi_tab (si no existe)

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "INSERT INTO etrx_openapi_tab (
     etrx_openapi_tab_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     ad_tab_id, name
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '100', NOW(), '100',
     '<TAB_ID>', '<NOMBRE_TAB>'
   );"
```

---

## Paso 5 — Exponer campos (etrx_openapi_field)

Para cada campo que el usuario quiera exponer:

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "INSERT INTO etrx_openapi_field (
     etrx_openapi_field_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     etrx_openapi_tab_id, ad_field_id, name, description
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '100', NOW(), '100',
     '<ETRX_OPENAPI_TAB_ID>', '<AD_FIELD_ID>',
     '<nombre_api>', '<descripcion>'
   );"
```

Repetir para cada campo. Los campos mínimos recomendados son:
- `id` — identificador interno
- `organization` — organización
- `documentNo` / `name` — identificador visible
- Campos de estado relevantes

---

## Paso 6 — Crear el endpoint (etapi_openapi_req)

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "INSERT INTO etapi_openapi_req (
     etapi_openapi_req_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     name, type, etrx_openapi_tab_id
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '100', NOW(), '100',
     '<NombreEndpoint>', 'ETRX_Tab', '<ETRX_OPENAPI_TAB_ID>'
   );"
```

`name` es el segmento de URL: `/etendo/sws/com.etendoerp.etendorx.datasource/<NombreEndpoint>`

---

## Paso 7 — Crear el Flow

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "INSERT INTO etapi_openapi_flow (
     etapi_openapi_flow_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     name, description
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '100', NOW(), '100',
     '<NombreFlow>', '<Descripcion del flow>'
   );"
```

---

## Paso 8 — Vincular endpoint al Flow (etapi_openapi_flowpoint)

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "INSERT INTO etapi_openapi_flowpoint (
     etapi_openapi_flowpoint_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     etapi_openapi_flow_id, etapi_openapi_req_id,
     isget, ispost, isput, isgetbyid
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '100', NOW(), '100',
     '<FLOW_ID>', '<REQ_ID>',
     'Y', 'Y', 'Y', 'Y'
   );"
```

Ajustar los flags HTTP según lo que necesite el flow:
- `isget` → `GET /endpoint` (listar)
- `isgetbyid` → `GET /endpoint/{id}` (obtener por ID)
- `ispost` → `POST /endpoint` (crear)
- `isput` → `PUT /endpoint/{id}` (actualizar)

---

## Paso 9 — Verificar

1. Obtener JWT:
```bash
curl -s -X POST http://localhost:8080/etendo/sws/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin","role":"42D0EEB1C66F497A90DD526DC597E6F0"}' \
  | jq -r '.token'
```

2. Verificar docs generados:
```bash
curl -s "http://localhost:8080/etendo/ws/com.etendoerp.openapi.openAPIController?tag=<NombreFlow>" \
  -H "Authorization: Bearer <TOKEN>" | jq '.paths | keys'
```

3. Probar GET:
```bash
curl -s "http://localhost:8080/etendo/sws/com.etendoerp.etendorx.datasource/<NombreEndpoint>" \
  -H "Authorization: Bearer <TOKEN>" | jq '.response.data[0]'
```

---

## Troubleshooting común

| Error | Causa | Fix |
|---|---|---|
| `404` en el endpoint | `name` en `etapi_openapi_req` no coincide con la URL | Verificar exactitud del name |
| `AccessTableNoView` | Role `0` (System Admin) no tiene acceso a datos de negocio | Usar role de negocio en el JWT |
| `ActionNotAllowed` en PUT | El tab no soporta update vía headless | Revisar configuración del tab en ERP |
| Campos faltantes en respuesta | Campo no agregado en `etrx_openapi_field` | Agregar el campo faltante |
| POST retorna 200 pero no persiste | Rollback silencioso por callout error | Ver logs Tomcat: `docker logs etendo-tomcat-1 \| grep ERROR` |
| `LazyInitializationException` en primer request | Bug de ADCS en servidor (ya corregido en este repo) | Recompilar con `./gradlew smartbuild` |

---

## IDs de referencia (F&B España - Demo)

```
CLIENT:   23C59575B9CF467C9620760EB255B389
ORG:      E443A31992CB4635AFCAEABE7183CE85
ROLE:     42D0EEB1C66F497A90DD526DC597E6F0
CREATEDBY (admin): 100
```

---

## Resumen de tablas involucradas

```sql
-- Ver todos los flows configurados
SELECT f.name as flow, r.name as endpoint, r.type,
       fp.isget, fp.ispost, fp.isput, fp.isgetbyid
FROM etapi_openapi_flow f
JOIN etapi_openapi_flowpoint fp ON f.etapi_openapi_flow_id = fp.etapi_openapi_flow_id
JOIN etapi_openapi_req r ON fp.etapi_openapi_req_id = r.etapi_openapi_req_id
ORDER BY f.name, r.name;
```
