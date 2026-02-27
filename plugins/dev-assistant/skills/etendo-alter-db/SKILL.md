---
name: "etendo:alter-db"
description: "/etendo:alter-db — Crear o modificar tablas y columnas"
argument-hint: "<descripcion, ej: 'crear tabla SMFT_cliente con nombre y email'>"
---

# /etendo:alter-db — Crear o modificar tablas y columnas

**Arguments:** `$ARGUMENTS` (descripcion opcional, ej: "crear tabla SMFT_cliente con nombre y email")

---

Primero, leer `skills/etendo-_context/SKILL.md` y `skills/etendo-_webhooks/SKILL.md`.

## Step 1: Contexto

Resolver:
- Modulo activo (javapackage, DB prefix, AD_MODULE_ID)
- DB connection (Docker o local)
- API key disponible (ver `_webhooks` skill -- seccion "Prerequisito: API key")
- Tomcat corriendo (los webhooks requieren Tomcat UP -> `./gradlew resources.up` si esta apagado)

## Step 2: Entender el cambio

Si `$ARGUMENTS` lo describe claramente, usarlo. Si no, preguntar:

1. Crear tabla nueva
2. Agregar columna a tabla existente
3. Modificar columna (tipo, tamano, nullable)
4. Agregar indice
5. Eliminar columna (confirmar -- destructivo)

Para **tabla nueva**: pedir nombre (sugerir `{PREFIX}_tablename`), lista de columnas.
Para **columna nueva**: tabla, nombre, tipo, nullable, default.

## Step 3: Mostrar el plan y confirmar

Mostrar un resumen de que se va a crear. Pedir confirmacion antes de ejecutar.

## Step 4: Crear tabla (si aplica)

Usar el webhook `CreateAndRegisterTable`. Este crea la tabla fisica EN PostgreSQL Y la registra en AD_TABLE en un solo call:

```bash
ETENDO_URL="http://localhost:8080/etendo"  # o el puerto de context.json
API_KEY="{apikey}"
MODULE_ID="{ad_module_id}"

RESP=$(curl -s -G "${ETENDO_URL}/webhooks/CreateAndRegisterTable" \
  --data-urlencode "name=CreateAndRegisterTable" \
  --data-urlencode "apikey=${API_KEY}" \
  --data-urlencode "Name={NombreLogico}" \
  --data-urlencode "ModuleID=${MODULE_ID}" \
  --data-urlencode "DataAccessLevel=3" \
  --data-urlencode "Description={descripcion}")

echo $RESP
TABLE_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f\-]{32,36})',r.get('message','')); print(m.group(1).replace('-','') if m else '')")
echo "Table ID: $TABLE_ID"
```

**No usar `get_uuid()` ni SQL manual** -- el webhook lo maneja internamente.

## Step 5: Agregar columnas

Por cada columna, usar `CreateColumn`:

```bash
RESP=$(curl -s -G "${ETENDO_URL}/webhooks/CreateColumn" \
  --data-urlencode "name=CreateColumn" \
  --data-urlencode "apikey=${API_KEY}" \
  --data-urlencode "tableID=${TABLE_ID}" \
  --data-urlencode "name={NombreColumna}" \
  --data-urlencode "columnNameDB={nombre_db}" \
  --data-urlencode "moduleID=${MODULE_ID}" \
  --data-urlencode "referenceID={REF_ID}" \
  --data-urlencode "canBeNull={true|false}" \
  --data-urlencode "defaultValue={valor}")
echo $RESP
```

**Reference IDs mas usados:**
| ID | Tipo | Cuando usarlo |
|---|---|---|
| `10` | String (VARCHAR 60) | Textos cortos, nombres |
| `14` | Text | Descripcion larga, observaciones |
| `11` | Integer | Numeros enteros, codigos numericos |
| `22` | Amount/Decimal | Precios, puntajes, duraciones |
| `15` | Date | Fechas |
| `20` | Yes/No | Checkboxes, flags boolean |
| `17` | List | Campos con lista cerrada de valores |
| `19` | TableDir | FK a otra tabla del mismo modulo |
| `30` | Search | FK a tabla de otro modulo |

**Para columnas FK a tablas de OTRO modulo**, el webhook agrega automaticamente el prefijo `EM_` -- no hace falta especificarlo manualmente.

## Step 6: Exportar a XML

Con Tomcat DOWN (importante):
```bash
./gradlew resources.down
JAVA_HOME=/Users/sebastianbarrozo/Library/Java/JavaVirtualMachines/corretto-17.0.18/Contents/Home \
  ./gradlew export.database -Dmodule={javapackage} > /tmp/etendo-export.log 2>&1
tail -5 /tmp/etendo-export.log
./gradlew resources.up
```

## Step 7: Resultado

```
+ Tabla {tablename} creada y registrada en AD

  Columnas agregadas: {N}
  Table ID: {ad_table_id}

  Proximos pasos:
    /etendo:window   -> exponer la tabla en la UI
    /etendo:smartbuild -> recompilar y desplegar
```
