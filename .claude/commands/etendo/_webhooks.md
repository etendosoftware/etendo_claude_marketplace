# Etendo Webhooks — Shared Helper

Este archivo NO es un command de usuario. Lo leen los commands `/etendo:*` para invocar las operaciones de AD via webhooks HTTP en lugar de SQL manual.

---

## Cuándo usar webhooks vs SQL

| Tarea | Usar |
|---|---|
| Crear tabla + registrarla en AD | Webhook `CreateAndRegisterTable` |
| Agregar columna | Webhook `CreateColumn` |
| Crear ventana + menú | Webhook `RegisterWindow` |
| Crear tab | Webhook `RegisterTab` |
| Registrar fields de un tab | Webhook `RegisterFields` |
| Registrar background process | Webhook `RegisterBGProcessWebHook` |
| Registrar Jasper report | Webhook `ProcessDefinitionJasper` |
| Crear módulo (AD_MODULE) | SQL directo (los webhooks requieren que el módulo ya exista) |

---

## Prerequisito: API Key

Los webhooks requieren autenticación por API key. Antes de cualquier call, asegurate de tener una key disponible:

### Verificar / crear API key

```bash
# Verificar si ya existe en context.json
cat .etendo/context.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('apikey',''))" 2>/dev/null

# Si no existe, crear una y guardarla:
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c "
  INSERT INTO smfwhe_definedwebhook_token
    (smfwhe_definedwebhook_token_id, ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby, ad_user_roles_id, name, apikey)
  SELECT get_uuid(), '0', '0', 'Y', now(), '0', now(), '0',
    (SELECT ad_user_roles_id FROM ad_user_roles WHERE ad_user_id = (SELECT ad_user_id FROM ad_user WHERE username='admin') LIMIT 1),
    'claude-agent',
    'claude-etendo-key-' || get_uuid()
  RETURNING apikey;
"
```

Guardar la key en `.etendo/context.json`:
```json
{
  "module": "...",
  "apikey": "claude-etendo-key-XXXXXXXX"
}
```

---

## Patrón de invocación

**SIEMPRE usar POST con JSON body.** El webhook usa `?name=` para routing, y todos los parámetros van en el body JSON. Si usás GET con `&name=valor`, el parámetro `name` del body colisiona con el `name` de routing.

```bash
ETENDO_URL="http://localhost:8080/etendo"
API_KEY="{apikey desde context.json}"

curl -s -X POST "${ETENDO_URL}/webhooks/?name={WebhookName}&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"Param1":"Value1","Param2":"Value2"}'
```

La respuesta es JSON: `{"message":"..."}` en éxito, `{"error":"..."}` en fallo.

**Verificar éxito:**
```bash
RESP=$(curl -s ...)
echo $RESP | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('message') or r.get('error','?'))"
```

---

## ⚠️ Bugs conocidos y workarounds

### Bug 1: `CreateColumn` no crea `AD_ELEMENT`

**Síntoma:** `RegisterFields` falla con `"Cannot invoke element.getName() because element is null"`.

**Causa:** `CreateColumn` inserta en `AD_COLUMN` pero no crea ni linkea un registro en `AD_ELEMENT`. El `AD_ELEMENT` es obligatorio para que `RegisterFields` pueda generar labels de los fields.

**Workaround obligatorio:** Antes de llamar `RegisterFields` en tabs de tablas SMFT, ejecutar este SQL que crea elementos faltantes y los vincula:

```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c "
DO \$\$
DECLARE
  rec RECORD;
  new_elem_id TEXT;
BEGIN
  FOR rec IN
    SELECT DISTINCT c.ad_column_id, c.columnname
    FROM ad_column c
    JOIN ad_table t ON t.ad_table_id = c.ad_table_id
    WHERE t.tablename ILIKE '{PREFIX}%'
      AND c.ad_element_id IS NULL
  LOOP
    SELECT ad_element_id INTO new_elem_id
    FROM ad_element WHERE LOWER(columnname) = LOWER(rec.columnname) LIMIT 1;
    IF new_elem_id IS NULL THEN
      new_elem_id := get_uuid();
      INSERT INTO ad_element (ad_element_id, ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby, columnname, name, printname, ad_module_id)
      VALUES (new_elem_id, '0', '0', 'Y', now(), '0', now(), '0',
        rec.columnname, initcap(replace(rec.columnname, '_', ' ')),
        initcap(replace(rec.columnname, '_', ' ')), '{MODULE_ID}');
    END IF;
    UPDATE ad_column SET ad_element_id = new_elem_id WHERE ad_column_id = rec.ad_column_id;
  END LOOP;
END;
\$\$;
"
```

Reemplazar `{PREFIX}` con el DB prefix del módulo (ej: `SMFT`) y `{MODULE_ID}` con el UUID del módulo.

---

### Bug 2: `RegisterWindow` y `RegisterTab` requieren `HelpComment`

**Síntoma:** `{"error":"Missing parameter: \"HelpComment\"."}` aunque el campo parece opcional.

**Workaround:** Siempre incluir `"HelpComment"` en el body JSON (puede ser igual a `Description`).

```json
{"Name":"MiVentana","Description":"desc","HelpComment":"desc","DBPrefix":"SMFT"}
```

---

### Bug 3: `RegisterTab` — formato del ID en la respuesta

**Síntoma:** El response de `RegisterTab` devuelve el ID con comillas simples: `ID: 'ABCD...'`, no el formato sin comillas que usa `RegisterWindow`.

**Regex correcto para parsear:**
```bash
TAB_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID: '([A-F0-9a-f]{32})'\",r.get('message','')); print(m.group(1) if m else '')")
```

---

### Bug 4: `CreateAndRegisterTable` requiere que el módulo tenga un `ad_package`

**Síntoma:** Error `"Module has not a datapackage"`.

**Causa:** El webhook busca un registro en `ad_package` para el módulo. Si el módulo se creó por SQL directo (sin usar el installer de Etendo), no tiene un package.

**Fix:** Insertar el package manualmente:
```sql
INSERT INTO ad_package (ad_package_id, ad_client_id, ad_org_id, name, description, javapackage, ad_module_id, isactive, created, createdby, updated, updatedby)
VALUES (get_uuid(), '0', '0', '{javapackage}', '{name} Package', '{javapackage}', '{MODULE_ID}', 'Y', now(), '0', now(), '0');
```

---

### Bug 5: `RegisterFields` en tab de M_Product — falla con NullPointer en columnas sin elemento

**Síntoma:** El tab de nivel 0 sobre `M_Product` falla en RegisterFields porque la tabla tiene 100+ columnas de distintos módulos con estados inconsistentes.

**Workaround:** No llamar `RegisterFields` en tabs sobre tablas estándar de Etendo (M_Product, C_BPartner, etc.). Esas tablas ya tienen sus fields registrados en otras ventanas estándar. Los campos SMFT de extensión aparecerán automáticamente vía el mecanismo de `EM_` prefix al hacer smartbuild.

---

### Bug 6: `CreateAndRegisterTable` no registra la columna PK en AD_COLUMN

**Síntoma:** `ModelProvider` loga `Ignoring table/view smft_xxx because it has no primary key columns`. Las tablas son invisibles para el DAL, el export.database las omite, y las ventanas no cargan datos.

**Causa:** El webhook crea la tabla física con la columna PK (`smft_xxx_id`) pero NO la registra en `AD_COLUMN` con `iskey='Y'`. Sin ese registro, Etendo no reconoce la PK.

**Workaround obligatorio:** Después de crear todas las tablas con `CreateAndRegisterTable`, ejecutar este SQL para registrar la PK de cada tabla del módulo:

```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c "
DO \$\$
DECLARE
  rec RECORD;
  pk_col TEXT;
  MODULE_ID TEXT := '{MODULE_ID}';
  elem_id TEXT;
  new_col_id TEXT;
BEGIN
  FOR rec IN
    SELECT ad_table_id, tablename FROM ad_table WHERE tablename ILIKE '{PREFIX}%'
  LOOP
    pk_col := rec.tablename || '_id';
    IF EXISTS (SELECT 1 FROM ad_column WHERE ad_table_id = rec.ad_table_id AND LOWER(columnname) = LOWER(pk_col)) THEN
      RAISE NOTICE 'PK already registered for %', rec.tablename;
      CONTINUE;
    END IF;
    SELECT ad_element_id INTO elem_id FROM ad_element WHERE LOWER(columnname) = LOWER(pk_col) LIMIT 1;
    IF elem_id IS NULL THEN
      elem_id := get_uuid();
      INSERT INTO ad_element (ad_element_id, ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby, columnname, name, printname, ad_module_id)
      VALUES (elem_id, '0', '0', 'Y', now(), '0', now(), '0', pk_col,
        initcap(replace(rec.tablename, '_', ' ')) || ' ID',
        initcap(replace(rec.tablename, '_', ' ')) || ' ID', MODULE_ID);
    END IF;
    new_col_id := get_uuid();
    INSERT INTO ad_column (ad_column_id, ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby,
      columnname, name, description, ad_table_id, ad_reference_id, fieldlength, iskey, issecondarykey,
      isparent, ismandatory, isupdateable, isidentifier, isencrypted, isdesencryptable, ad_module_id, ad_element_id, position)
    VALUES (new_col_id, '0', '0', 'Y', now(), '0', now(), '0',
      pk_col, initcap(replace(rec.tablename, '_', ' ')) || ' ID', '',
      rec.ad_table_id, '13', 32, 'Y', 'N', 'N', 'Y', 'N', 'N', 'N', 'N', MODULE_ID, elem_id, 0);
    RAISE NOTICE 'Registered PK % for %', pk_col, rec.tablename;
  END LOOP;
END;
\$\$;
"
```

Reemplazar `{PREFIX}` (ej: `SMFT`) y `{MODULE_ID}` con el UUID del módulo.

---

### Bug 7: Columnas estándar no registradas en AD_COLUMN → `NOT_EXIST_IN_AD` fatal en export

**Síntoma:** `export.database` falla con `Errors for Validation type: NOT_EXIST_IN_AD` para columnas estándar (ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby).

**Causa:** `CreateAndRegisterTable` crea la tabla física con esas columnas pero NO las registra en AD_COLUMN. El export las detecta en la DB y no las encuentra en el AD → validación fatal.

**Workaround obligatorio:** Registrar las columnas estándar en AD_COLUMN con los atributos EXACTOS descritos en Bug 8. El error es **bloqueante** — no se puede exportar sin este fix.

---

### Bug 8: Columnas estándar en AD_COLUMN con `ad_reference_id` incorrecto → Hibernate falla

**Síntoma:** `export.database` lanza `org.openbravo.base.util.CheckException: Property createdBy does not exist for entity {tablename}` → `Could not get constructor for SingleTableEntityPersister`.

**Causa:** Las columnas `Createdby` y `Updatedby` deben usar `ad_reference_id='30'` (Search), NO `'18'` (Table). Con `'18'` (Table), Hibernate no puede resolver la FK a AD_User y el entity model queda incompleto: la propiedad `createdBy` nunca se agrega al property map del entity.

**Fix confirmado:** `Createdby` y `Updatedby` deben tener `ad_reference_id='30'`. El resto de las columnas estándar no cambia.

**Workaround obligatorio:** Registrar TODAS las columnas estándar para cada tabla del módulo con exactamente estos atributos (matching el patrón de módulos como `smfwhe`):

```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} << 'SQLEOF'
DO $$
DECLARE
  v_table RECORD;
  v_table_id VARCHAR(32);
  v_module_id VARCHAR(32) := '{MODULE_ID}';
BEGIN
  FOR v_table IN
    SELECT ad_table_id, tablename FROM ad_table WHERE tablename ILIKE '{PREFIX}_%'
  LOOP
    v_table_id := v_table.ad_table_id;
    INSERT INTO ad_column (ad_column_id, ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby,
      columnname, ad_table_id, ad_reference_id, fieldlength, iskey, isparent, ismandatory, isupdateable,
      isidentifier, isencrypted, ad_element_id, ad_module_id, name, position)
    VALUES
      (get_uuid(),'0','0','Y',now(),'0',now(),'0', 'AD_Client_ID', v_table_id, '19', 32, 'N','N','Y','N','N','N', '102', v_module_id, 'Client', 10),
      (get_uuid(),'0','0','Y',now(),'0',now(),'0', 'AD_Org_ID',    v_table_id, '19', 32, 'N','N','Y','N','N','N', '113', v_module_id, 'Organization', 20),
      (get_uuid(),'0','0','Y',now(),'0',now(),'0', 'Isactive',     v_table_id, '20',  1, 'N','N','Y','Y','N','N', '348', v_module_id, 'Active', 30),
      (get_uuid(),'0','0','Y',now(),'0',now(),'0', 'Created',      v_table_id, '16',  7, 'N','N','Y','N','N','N', '245', v_module_id, 'Creation Date', 50),
      (get_uuid(),'0','0','Y',now(),'0',now(),'0', 'Createdby',    v_table_id, '30', 32, 'N','N','Y','N','N','N', '246', v_module_id, 'Created By', 60),
      (get_uuid(),'0','0','Y',now(),'0',now(),'0', 'Updated',      v_table_id, '16',  7, 'N','N','Y','N','N','N', '607', v_module_id, 'Updated', 70),
      (get_uuid(),'0','0','Y',now(),'0',now(),'0', 'Updatedby',    v_table_id, '30', 32, 'N','N','Y','N','N','N', '608', v_module_id, 'Updated By', 80)
    ON CONFLICT DO NOTHING;
  END LOOP;
END$$;
SQLEOF
```

**Atributos clave:**
| Columna | reference_id | element_id | Nota |
|---|---|---|---|
| AD_Client_ID | 19 (TableDir) | 102 | |
| AD_Org_ID | 19 (TableDir) | 113 | |
| Isactive | 20 (YesNo) | 348 | |
| Created | 16 (DateTime) | 245 | |
| **Createdby** | **30 (Search)** | **246** | ⚠️ NO usar 18 |
| Updated | 16 (DateTime) | 607 | |
| **Updatedby** | **30 (Search)** | **608** | ⚠️ NO usar 18 |

---

### Bug 9: FK constraint names tienen límite de 30 caracteres en export.database

**Síntoma:** `Errors for Validation type: INCORRECT_NAME_LENGTH` / `NAME_TOO_LONG` — `Name of ForeignKey X for table Y is too long. Only 30 characters allowed.`

**Causa:** Los nombres de FK constraints generados automáticamente (ej: `SMFT_ANSWER_SMFT_QUESTION_ID_FK` = 31 chars) exceden el límite de 30 chars que valida el export.

**Workaround:** Renombrar el constraint antes de exportar:
```sql
ALTER TABLE {tabla} RENAME CONSTRAINT {nombre_largo_fk} TO {nombre_corto_max30};
```
Verificar longitudes antes de exportar:
```sql
SELECT conname, length(conname), conrelid::regclass
FROM pg_constraint WHERE contype='f' AND conrelid::regclass::text ILIKE '{PREFIX}_%'
ORDER BY length(conname) DESC;
```

---

## Webhooks disponibles y sus parámetros

### `CreateAndRegisterTable`
Crea la tabla física en PostgreSQL Y la registra en AD_TABLE con columnas base (id, client, org, active, created, updated).

> ⚠️ Requiere que el módulo tenga un registro en `ad_package` — ver Bug 4 arriba.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateAndRegisterTable&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "Asignatura",
    "DBTableName": "SMFT_Asignatura",
    "ModuleID": "'${MODULE_ID}'",
    "DataAccessLevel": "3",
    "Description": "Tabla de asignaturas",
    "Help": "Tabla de asignaturas",
    "JavaClass": "com.smf.tutorial.SMFT_Asignatura"
  }'
```

**Parámetros requeridos:**
- `Name`: nombre lógico
- `DBTableName`: nombre físico completo con prefix (ej: `SMFT_Asignatura`)
- `ModuleID`: UUID del módulo
- `DataAccessLevel`: `3`=System/Org, `4`=Client/Org, `1`=Org
- `Description`: descripción
- `Help`: texto de ayuda
- `JavaClass`: clase Java (ej: `com.smf.tutorial.SMFT_Asignatura`)

Respuesta: `{"message": "Table registered successfully with ID: <ad_table_id>"}`

---

### `CreateColumn`
Agrega una columna a una tabla existente (física + AD_COLUMN).

> ⚠️ No crea `AD_ELEMENT` — ejecutar workaround de Bug 1 antes de llamar `RegisterFields`.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateColumn&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "tableID": "{ad_table_id}",
    "name": "Nombre",
    "columnNameDB": "nombre",
    "moduleID": "{ad_module_id}",
    "referenceID": "10",
    "canBeNull": "false",
    "defaultValue": ""
  }'
```

**Reference IDs más comunes:**
| ID | Tipo | SQL type |
|---|---|---|
| `10` | String (varchar) | VARCHAR(60) |
| `14` | Text (long) | TEXT |
| `11` | Integer | NUMERIC(10,0) |
| `22` | Amount/Number | NUMERIC(19,2) |
| `15` | Date | DATE |
| `16` | DateTime | TIMESTAMP |
| `20` | Yes/No (boolean) | CHAR(1) |
| `17` | List (ref cerrada) | VARCHAR(60) |
| `19` | TableDir (FK mismo módulo) | VARCHAR(32) |
| `30` | Search (FK general) | VARCHAR(32) |
| `13` | ID (PK) | VARCHAR(32) |

---

### `RegisterWindow`
Crea AD_WINDOW + entrada en AD_MENU.

> ⚠️ `HelpComment` es obligatorio aunque no esté documentado en versiones anteriores.

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterWindow&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"DBPrefix":"SMFT","Name":"Curso","Description":"Gestion de cursos","HelpComment":"Gestion de cursos"}')
echo $RESP
WINDOW_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else '')")
echo "Window ID: $WINDOW_ID"
```
- Retorna el `ad_window_id` en el mensaje (formato: `ID: ABCD...` sin comillas).

---

### `RegisterTab`
Crea un AD_TAB dentro de una ventana.

> ⚠️ `HelpComment` es obligatorio. El ID en el response viene entre comillas simples `ID: 'XXXX'`.
> La jerarquía de tabs se determina por `TabLevel` + `SequenceNumber`: un tab de nivel N es hijo del último tab de nivel N-1 antes de él (por secuencia).

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterTab&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "WindowID": "'${WINDOW_ID}'",
    "TableName": "SMFT_Inscripcion",
    "DBPrefix": "SMFT",
    "TabLevel": "1",
    "SequenceNumber": "20",
    "Description": "Tab de inscripciones",
    "HelpComment": "Tab de inscripciones"
  }')
echo $RESP
TAB_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID: '([A-F0-9a-f]{32})'\",r.get('message','')); print(m.group(1) if m else '')")
echo "Tab ID: $TAB_ID"
```
- `TabLevel`: 0=header, 1=detail, 2=subdetail, etc.
- `SequenceNumber`: orden de display (10, 20, 30...)

---

### `RegisterFields`
Auto-crea AD_FIELD para todas las columnas de un tab.

> ⚠️ `Description` y `HelpComment` son obligatorios.
> ⚠️ Requiere que todas las columnas tengan `ad_element_id` seteado — ver Bug 1 arriba.
> ⚠️ No usar en tabs sobre tablas estándar de Etendo (M_Product, C_BPartner, etc.) — ver Bug 5.

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterFields&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "WindowTabID": "'${TAB_ID}'",
    "DBPrefix": "SMFT",
    "Description": "Descripcion del tab",
    "HelpComment": "Descripcion del tab"
  }')
echo $RESP
```
- Registra todas las columnas de la tabla como fields visibles.
- Salta las columnas clave (PK).

---

### `RegisterBGProcessWebHook`
Registra un proceso en background en AD_PROCESS.

```bash
curl -s -G "${ETENDO_URL}/webhooks/RegisterBGProcessWebHook" \
  --data-urlencode "name=RegisterBGProcessWebHook" \
  --data-urlencode "apikey=${API_KEY}" \
  --data-urlencode "Javapackage=com.smf.tutorial" \
  --data-urlencode "Name=Expire Inscripciones" \
  --data-urlencode "SearchKey=SMFT_ExpireInscripciones" \
  --data-urlencode "Description=Expires past-due enrollments" \
  --data-urlencode "PreventConcurrent=true"
```

---

### `GetWindowTabOrTableInfo`
Consulta IDs de ventanas, tabs o tablas existentes. Útil para obtener IDs sin hacer SQL.

```bash
curl -s -G "${ETENDO_URL}/webhooks/GetWindowTabOrTableInfo" \
  --data-urlencode "name=GetWindowTabOrTableInfo" \
  --data-urlencode "apikey=${API_KEY}" \
  --data-urlencode "TableName=SMFT_Inscripcion"
```

---

## Flujo completo: nueva tabla + ventana

```
1. CreateAndRegisterTable  → obtener ad_table_id del response
2. CreateColumn x N        → agregar columnas a la tabla
3. RegisterWindow          → obtener ad_window_id del response
4. RegisterTab             → obtener ad_tab_id del response (TabLevel=0 para header)
5. RegisterFields          → auto-registrar todos los fields del tab
6. export.database         → exportar cambios a XML
```

---

## Extraer IDs del response

```bash
# Extraer ad_table_id del response de CreateAndRegisterTable
RESP=$(curl -s ...)
TABLE_ID=$(echo $RESP | python3 -c "
import sys, json, re
r = json.load(sys.stdin)
msg = r.get('message','')
m = re.search(r'ID:\s*([A-F0-9]{32})', msg, re.I)
print(m.group(1) if m else '')
")
echo "Table ID: $TABLE_ID"
```
