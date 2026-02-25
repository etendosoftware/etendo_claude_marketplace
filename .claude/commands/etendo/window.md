# /etendo:window — Crear o modificar una Window en el Application Dictionary

**Arguments:** `$ARGUMENTS` (opcional: `create`, `alter WindowName`, o descripción)

---

Primero, leer `.claude/commands/etendo/_context.md` y `.claude/commands/etendo/_webhooks.md`.

Una **Window** en Etendo es el entry point de UI. Contiene Tabs (nivel 0 = header, 1 = detalle, etc.), cada Tab mapea a una tabla.

## Step 1: Contexto

Resolver:
- Módulo activo (javapackage, DB prefix, AD_MODULE_ID)
- API key disponible (ver `_webhooks.md`)
- Tomcat corriendo (requerido para webhooks)

## Step 2: Determinar operación

- `create` o vacío → crear ventana nueva
- `alter {WindowName}` → modificar ventana existente (usar `GetWindowTabOrTableInfo`)
- Lenguaje natural → inferir intención

## Step 3: Recopilar información

Preguntar sólo lo que no puede inferirse:

**Ventana:**
- Nombre (requerido)
- Descripción (opcional)

**Tabs:** para cada tab:
- ¿Qué tabla? (listar tablas del módulo o entrada manual)
- Nivel: 0=header (default para el primero), 1=detail, 2=subdetail...
- ¿Es sólo lectura? (default N)
- ¿WhereClause? (ej: `em_smft_iscourse='Y'` para filtrar)

**Menú:** ¿Agregar entrada de menú? (default sí)

Confirmar todo junto antes de ejecutar.

## Step 4: Crear la ventana

```bash
ETENDO_URL="http://localhost:8080/etendo"
API_KEY="{apikey}"
DB_PREFIX="{dbprefix}"

# 1. Crear ventana + menú
RESP=$(curl -s -G "${ETENDO_URL}/webhooks/RegisterWindow" \
  --data-urlencode "name=RegisterWindow" \
  --data-urlencode "apikey=${API_KEY}" \
  --data-urlencode "DBPrefix=${DB_PREFIX}" \
  --data-urlencode "Name={NombreVentana}" \
  --data-urlencode "Description={descripcion}")
echo $RESP
WINDOW_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else '')")
echo "Window ID: $WINDOW_ID"
```

## Step 5: Crear tabs

Por cada tab en orden (nivel 0 primero, luego 1, 2...):

```bash
# Crear tab
RESP=$(curl -s -G "${ETENDO_URL}/webhooks/RegisterTab" \
  --data-urlencode "name=RegisterTab" \
  --data-urlencode "apikey=${API_KEY}" \
  --data-urlencode "WindowID=${WINDOW_ID}" \
  --data-urlencode "TableName={NombreTablaDB}" \
  --data-urlencode "DBPrefix=${DB_PREFIX}" \
  --data-urlencode "TabLevel={0|1|2...}" \
  --data-urlencode "SequenceNumber={10|20|30...}" \
  --data-urlencode "Description={descripcion}")
echo $RESP
TAB_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else '')")
echo "Tab ID: $TAB_ID"

# Auto-registrar todos los fields del tab
RESP=$(curl -s -G "${ETENDO_URL}/webhooks/RegisterFields" \
  --data-urlencode "name=RegisterFields" \
  --data-urlencode "apikey=${API_KEY}" \
  --data-urlencode "WindowTabID=${TAB_ID}" \
  --data-urlencode "DBPrefix=${DB_PREFIX}")
echo $RESP
```

Repetir para cada tab en el árbol.

## Step 6: WhereClause (si aplica)

Si un tab necesita filtro (ej: sólo mostrar productos que son cursos), actualizar directamente en DB:

```bash
docker exec -i etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
  "UPDATE ad_tab SET whereclause = '{clausula}' WHERE ad_tab_id = '{tab_id}';"
```

## Step 7: Exportar a XML

Con Tomcat DOWN:
```bash
./gradlew resources.down
JAVA_HOME=/Users/sebastianbarrozo/Library/Java/JavaVirtualMachines/corretto-17.0.18/Contents/Home \
  ./gradlew export.database -Dmodule={javapackage} > /tmp/etendo-export.log 2>&1
tail -5 /tmp/etendo-export.log
./gradlew resources.up
```

## Step 8: Resultado

```
✓ Ventana "{nombre}" creada

  Window ID: {id}
  Tabs creados: {N}

  Para verla en Etendo:
    /etendo:smartbuild → recompilar y desplegar
    Luego: UI → refresh → {nombre} en el menú
```
