---
name: "etendo:_webhooks"
description: "Etendo Webhooks — Shared Helper"
---

# Etendo Webhooks — Shared Helper

Este archivo NO es un command de usuario. Lo leen los commands `/etendo:*` para invocar las operaciones de AD via webhooks HTTP en lugar de SQL manual.

---

## Cuando usar webhooks vs SQL

| Tarea | Usar |
|---|---|
| Crear modulo (AD_MODULE + prefix + package) | Webhook `CreateModule` |
| Crear template (AD_MODULE tipo T, sin prefix) | SQL directo (CreateModule falla para templates -- ver nota) |
| Agregar dependencia entre modulos | Webhook `AddModuleDependency` |
| Crear tabla + registrarla en AD | Webhook `CreateAndRegisterTable` |
| Crear vista de BD y registrarla en AD | Webhook `CreateView` |
| Agregar columna a tabla propia o estandar | Webhook `CreateColumn` |
| Crear referencia de lista (dropdown) | Webhook `CreateReference` |
| Asignar referenceValueID a columna ya creada | SQL: `UPDATE ad_column SET ad_reference_value_id=... WHERE ...` |
| Crear ventana + menu | Webhook `RegisterWindow` |
| Crear tab | Webhook `RegisterTab` |
| Registrar fields de un tab | Webhook `RegisterFields` |
| Registrar background process | Webhook `RegisterBGProcessWebHook` |
| Registrar Action Process (lanzable desde menu) | Webhook `ProcessDefinitionButton` |
| Registrar Jasper report | Webhook `ProcessDefinitionJasper` |
| Registrar endpoint headless EtendoRX | Webhook `RegisterHeadlessEndpoint` |
| Registrar columnas fisicas en AD_COLUMN | Webhook `RegisterColumns` |
| Registrar nuevo webhook en BD | Webhook `RegisterNewWebHook` |
| Filtro de tab (Where Clause) | Webhook `SetTabFilter` |
| Columna computada (SQL expression) | Webhook `CreateComputedColumn` |
| Agregar FK fisico en PostgreSQL | SQL: `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...` |
| Agregar campo a Field Group existente | SQL directo (no hay webhook) |
| Renombrar ventana/tab/menu | SQL: `UPDATE ad_window/ad_tab/ad_menu SET name=...` |

---

## Prerequisito: API Key

Los webhooks requieren autenticacion por API key. Antes de cualquier call, asegurate de tener una key disponible:

### Verificar / crear API key

```bash
# Verificar si ya existe en context.json
cat .etendo/context.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('apikey',''))" 2>/dev/null

# Si no existe, crear token Y dar acceso a todos los webhooks en un solo bloque:
NEW_KEY=$(docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c "
  INSERT INTO smfwhe_definedwebhook_token
    (smfwhe_definedwebhook_token_id, ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby, ad_user_roles_id, name, apikey)
  SELECT get_uuid(), '0', '0', 'Y', now(), '0', now(), '0',
    (SELECT ad_user_roles_id FROM ad_user_roles WHERE ad_user_id = (SELECT ad_user_id FROM ad_user WHERE username='admin') LIMIT 1),
    'claude-agent',
    'claude-etendo-key-' || get_uuid()
  RETURNING apikey;
" | tr -d ' ')
echo "KEY: $NEW_KEY"

# CRITICO: el acceso se controla por smfwhe_definedwebhook_ACC (token+webhook), NO por role.
# La tabla smfwhe_definedwebhook_role NO es suficiente -- se necesita smfwhe_definedwebhook_acc.
# Despues de crear el token, dar acceso a todos los webhooks:
TOKEN_ID=$(docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c "
  SELECT smfwhe_definedwebhook_token_id FROM smfwhe_definedwebhook_token WHERE name='claude-agent';
" | tr -d ' ')

docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c "
  INSERT INTO smfwhe_definedwebhook_acc
    (smfwhe_definedwebhook_acc_id, ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby, smfwhe_definedwebhook_id, smfwhe_definedwebhook_token_id)
  SELECT get_uuid(), '0', '0', 'Y', now(), '0', now(), '0', dw.smfwhe_definedwebhook_id, '${TOKEN_ID}'
  FROM smfwhe_definedwebhook dw
  WHERE NOT EXISTS (
    SELECT 1 FROM smfwhe_definedwebhook_acc a
    WHERE a.smfwhe_definedwebhook_id = dw.smfwhe_definedwebhook_id
      AND a.smfwhe_definedwebhook_token_id = '${TOKEN_ID}'
  );
"
```

Guardar la key en `.etendo/context.json`:
```json
{
  "module": "...",
  "apikey": "claude-etendo-key-XXXXXXXX"
}
```

> **Nota:** Si despues se registra un nuevo webhook via `RegisterNewWebHook`, ese webhook nuevo
> no tendra entrada en `smfwhe_definedwebhook_acc`. Repetir el INSERT con `WHERE NOT EXISTS`.

---

## Patron de invocacion

**SIEMPRE usar POST con JSON body.** El webhook usa `?name=` para routing, y todos los parametros van en el body JSON.

```bash
ETENDO_URL="http://localhost:8080/etendo"
API_KEY="{apikey desde context.json}"

curl -s -X POST "${ETENDO_URL}/webhooks/?name={WebhookName}&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"Param1":"Value1","Param2":"Value2"}'
```

La respuesta es JSON: `{"message":"..."}` en exito, `{"error":"..."}` en fallo.

**Verificar exito:**
```bash
RESP=$(curl -s ...)
echo $RESP | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('message') or r.get('error','?'))"
```

---

## Webhooks disponibles y sus parametros

### `CreateModule`
Crea AD_MODULE + AD_MODULE_DBPREFIX + AD_PACKAGE en una sola llamada.

> **Templates (Type=T) no pueden tener DB prefix** -- el trigger `ad_module_dbprefix_trg` lo bloquea.
> Usar SQL directo para templates (ver seccion abajo).

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateModule&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "Tutorial Module",
    "JavaPackage": "com.smf.tutorial",
    "DBPrefix": "SMFT",
    "Description": "Tutorial module",
    "Version": "1.0.0"
  }')
MODULE_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
echo "Module ID: $MODULE_ID"
```

**Parametros requeridos:** `Name`, `JavaPackage`, `DBPrefix`
**Opcionales:** `Description` (default=Name), `Version` (default=1.0.0), `Author`, `Type` (M/T/P, default=M)

Respuesta: `{"message": "Module created successfully with ID: <32-char-hex>"}`

#### Crear template via SQL (porque CreateModule falla para Type=T con DBPrefix)

```bash
cat > /tmp/create_template.sql << 'EOF'
DO $$
DECLARE
  v_module_id TEXT := get_uuid();
  v_dep_id TEXT := get_uuid();
  v_tutorial_id TEXT := '{MODULE_ID_DEL_MODULO_BASE}';
BEGIN
  INSERT INTO AD_MODULE (AD_MODULE_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
                         NAME, VERSION, DESCRIPTION, JAVAPACKAGE, TYPE, ISINDEVELOPMENT,
                         ISTRANSLATIONREQUIRED, ISREGISTERED, HASCHARTOFACCOUNTS,
                         ISTRANSLATIONMODULE, LICENSETYPE)
  VALUES (v_module_id, '0', '0', 'Y', now(), '0', now(), '0',
          '{Template Name}', '1.0.0', '{description}', '{com.smf.tutorial.template}', 'T', 'Y',
          'N', 'N', 'N', 'N', 'ETENDO');

  -- Dependencia con ISINCLUDED=Y (modulo incluido en el template)
  INSERT INTO AD_MODULE_DEPENDENCY (AD_MODULE_DEPENDENCY_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE,
                                     CREATED, CREATEDBY, UPDATED, UPDATEDBY,
                                     AD_MODULE_ID, AD_DEPENDENT_MODULE_ID, DEPENDANT_MODULE_NAME,
                                     ISINCLUDED, STARTVERSION, DEPENDENCY_ENFORCEMENT)
  VALUES (v_dep_id, '0', '0', 'Y', now(), '0', now(), '0',
          v_module_id, v_tutorial_id, '{Tutorial Module}', 'Y', '1.0.0', 'MAJOR');

  RAISE NOTICE 'Template ID: %', v_module_id;
END $$;
EOF
docker cp /tmp/create_template.sql etendo-db-1:/tmp/create_template.sql
docker exec etendo-db-1 psql -U tad -d etendo -f /tmp/create_template.sql
```

> **Columnas reales de AD_MODULE_DEPENDENCY**: `startversion` (NOT NULL), `dependency_enforcement` (con underscore), `isincluded`.
> No existe `dependencyenforcement` como palabra junta -- usar `dependency_enforcement`.

---

### `AddModuleDependency`
Agrega una dependencia entre dos modulos.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=AddModuleDependency&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "ModuleID": "'${MODULE_ID}'",
    "DependsOnModuleID": "0",
    "FirstVersion": "3.0.0"
  }'
```

**Parametros requeridos:** `ModuleID`, y uno de: `DependsOnModuleID` | `DependsOnJavaPackage`
**Opcionales:** `FirstVersion`, `LastVersion`, `IsIncluded` ("true"/"false"), `Enforcement` ("MAJOR"/"MINOR"/"NONE")

> `DependsOnModuleID="0"` -> core (org.openbravo, el modulo base de Etendo)

---

### `CreateAndRegisterTable`
Crea la tabla fisica en PostgreSQL Y la registra en AD_TABLE con columnas base (id, client, org, active, created, updated).

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateAndRegisterTable&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "Asignatura",
    "DBTableName": "SMFT_Asignatura",
    "ModuleID": "'${MODULE_ID}'",
    "DataAccessLevel": "3",
    "Description": "Tabla de asignaturas",
    "Help": "Tabla de asignaturas",
    "JavaClass": "com.smf.tutorial.data.Asignatura"
  }')
TABLE_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID: '([A-F0-9a-f]{32})'\",r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
```

**Parametros requeridos:** `Name`, `DBTableName`, `ModuleID`, `DataAccessLevel`, `Description`, `Help`, `JavaClass`
**DataAccessLevel:** `3`=System/Org, `4`=Client/Org, `1`=Org

Respuesta: `{"message": "Table registered successfully in Etendo with the ID: '<id>'."}`
El ID viene entre comillas simples.

---

### `CreateColumn`
Agrega una columna a una tabla existente (fisica en PostgreSQL + registro en AD_COLUMN).

> **Parametros en camelCase** -- NO mayusculas como otros webhooks.
> **`canBeNull`** acepta `"true"`/`"false"` (no `"Y"`/`"N"`).
> **Columnas en tablas core** (M_Product, C_BPartner, etc.) reciben prefijo `EM_{PREFIX}_` automaticamente.
>   Pasar el nombre SIN el prefijo del modulo: `"columnNameDB": "Is_Course"` -> se crea como `EM_SMFT_Is_Course`.
> **`referenceValueID` no esta soportado** -- para columnas de lista, crear con `referenceID=10` y actualizar
>   `ad_reference_value_id` via SQL despues.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateColumn&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "tableID": "'${TABLE_ID}'",
    "columnNameDB": "nombre_columna",
    "name": "Nombre Visible",
    "referenceID": "10",
    "moduleID": "'${MODULE_ID}'",
    "canBeNull": "true",
    "defaultValue": ""
  }'
```

**Parametros requeridos:** `tableID`, `columnNameDB`, `name`, `referenceID`, `moduleID`, `canBeNull`
**Opcionales:** `defaultValue`

**Reference IDs mas comunes:**
| ID | Tipo | SQL type |
|---|---|---|
| `10` | String (varchar 60) | VARCHAR(200) |
| `14` | Text (long) | TEXT |
| `11` | Integer | NUMERIC(10,0) |
| `22` | Amount/Number | NUMERIC(19,2) |
| `15` | Date | TIMESTAMP |
| `20` | Yes/No (boolean) | CHAR(1) |
| `17` | List (ref cerrada) | VARCHAR(60) |
| `19` | TableDir (FK auto por nombre) | VARCHAR(32) |
| `30` | Search (FK general) | VARCHAR(32) |

#### Actualizar referenceValueID via SQL (para columnas List):
```bash
cat > /tmp/fix_ref.sql << 'EOF'
UPDATE ad_column
SET ad_reference_id = '17',
    ad_reference_value_id = '{REF_ID}'
WHERE ad_table_id = '{TABLE_ID}' AND LOWER(columnname) = 'type';
EOF
docker cp /tmp/fix_ref.sql etendo-db-1:/tmp/fix_ref.sql
docker exec etendo-db-1 psql -U tad -d etendo -f /tmp/fix_ref.sql
```

#### Agregar FKs fisicas via SQL:
Las FKs en la BD NO se crean automaticamente -- el webhook solo crea la columna.
Los nombres de columna en la BD son **lowercase** (PostgreSQL normaliza).

```bash
cat > /tmp/add_fks.sql << 'EOF'
ALTER TABLE smft_asignatura ADD CONSTRAINT smft_asig_teacher_fk
  FOREIGN KEY (teacher) REFERENCES ad_user(ad_user_id);
ALTER TABLE smft_enrollment ADD CONSTRAINT smft_enroll_edition_fk
  FOREIGN KEY (courseedition) REFERENCES smft_course_edition(smft_course_edition_id);
-- etc.
EOF
docker cp /tmp/add_fks.sql etendo-db-1:/tmp/add_fks.sql
docker exec etendo-db-1 psql -U tad -d etendo -f /tmp/add_fks.sql
```

---

### `CreateReference`
Crea una referencia de tipo Lista (dropdown) con sus items.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateReference&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "NameReference": "SMFT_TipoDictado",
    "Prefix": "SMFT",
    "ReferenceList": "Anual,1er Cuatrimestre,2do Cuatrimestre",
    "Description": "Tipo de dictado de la asignatura",
    "Help": "Tipo de dictado"
  }'
```

**Parametros requeridos:** `NameReference`, `Prefix`, `ReferenceList` (CSV de nombres), `Description`, `Help`

> `ReferenceList` es una lista separada por comas de **nombres** (no `value:name`).
> El search key se auto-genera con los primeros 2 caracteres de cada nombre (mayusculas).
> Para search keys personalizadas, actualizar `ad_ref_list` via SQL.

---

### `RegisterWindow`
Crea AD_WINDOW + entrada en AD_MENU.

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterWindow&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "DBPrefix": "SMFT",
    "Name": "Curso",
    "Description": "Gestion de cursos",
    "HelpComment": "Gestion de cursos"
  }')
WINDOW_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
echo "Window ID: $WINDOW_ID"
```

**Parametros requeridos:** `DBPrefix`, `Name`, `Description`, `HelpComment`

---

### `RegisterTab`
Crea un AD_TAB dentro de una ventana.

> La jerarquia de tabs se determina por `TabLevel` + `SequenceNumber`:
> un tab de nivel N es hijo del ultimo tab de nivel N-1 antes de el (por secuencia).
> El ID en el response viene entre comillas simples: `ID: 'XXXX'`.

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterTab&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "WindowID": "'${WINDOW_ID}'",
    "TableName": "SMFT_Asignatura",
    "DBPrefix": "SMFT",
    "TabLevel": "0",
    "SequenceNumber": "10",
    "Name": "Asignatura",
    "Description": "Tab de asignaturas",
    "HelpComment": "Tab de asignaturas"
  }')
TAB_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID: '([A-F0-9a-f]{32})'\",r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
echo "Tab ID: $TAB_ID"
```

**Parametros requeridos:** `WindowID`, `TableName`, `DBPrefix`, `TabLevel`, `SequenceNumber`, `Description`, `HelpComment`
**Opcionales:** `Name` (default=TableName), `IsReadOnly` ("true"/"false")

---

### `SetTabFilter`
Establece un filtro SQL/HQL en un tab existente.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=SetTabFilter&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "TabID": "'${TAB_ID}'",
    "WhereClause": "e.iscourse='\''Y'\''",
    "HQLWhereClause": "as e where e.course = '\''Y'\''",
    "OrderByClause": "name"
  }'
```

**Parametros requeridos:** `TabID`, `WhereClause`
**Opcionales:** `HQLWhereClause`, `OrderByClause`

---

### `RegisterFields`
Auto-crea AD_FIELD para todas las columnas de un tab.

> `Description` y `HelpComment` son obligatorios.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterFields&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "WindowTabID": "'${TAB_ID}'",
    "DBPrefix": "SMFT",
    "Description": "Descripcion del tab",
    "HelpComment": "Descripcion del tab"
  }'
```

---

### `RegisterBGProcessWebHook`
Registra un Background Process en AD_PROCESS.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterBGProcessWebHook&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Javapackage": "com.smf.tutorial",
    "Name": "Expire Enrollments",
    "SearchKey": "SMFT_ExpireEnrollments",
    "Description": "Marks past-due enrollments as expired",
    "PreventConcurrent": "true"
  }'
```

---

### `ProcessDefinitionButton`
Registra un Action Process (lanzable desde menu o boton) en AD_PROCESS.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=ProcessDefinitionButton&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Prefix": "SMFT",
    "SearchKey": "SMFT_EnrollStudent",
    "ProcessName": "Enroll Student",
    "Description": "Enrolls a student in a course",
    "HelpComment": "Enrolls a student in a course",
    "JavaPackage": "com.smf.tutorial",
    "Parameters": "[{\"BD_NAME\":\"p_student\",\"NAME\":\"Student\",\"LENGTH\":\"32\",\"SEQNO\":\"10\",\"REFERENCE\":\"Search\"},{\"BD_NAME\":\"p_course\",\"NAME\":\"Course\",\"LENGTH\":\"32\",\"SEQNO\":\"20\",\"REFERENCE\":\"Search\"},{\"BD_NAME\":\"p_date\",\"NAME\":\"Date\",\"LENGTH\":\"10\",\"SEQNO\":\"30\",\"REFERENCE\":\"Date\"}]"
  }'
```

**Parametros `Parameters`:** JSON array, cada item: `BD_NAME`, `NAME`, `LENGTH`, `SEQNO`, `REFERENCE`

---

### `ProcessDefinitionJasper`
Registra un reporte Jasper en AD_PROCESS.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=ProcessDefinitionJasper&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Prefix": "SMFT",
    "SearchKey": "SMFT_EvaluacionReport",
    "ProcessName": "Evaluacion Report",
    "Description": "Prints evaluation with questions and answers",
    "HelpComment": "Prints evaluation with questions and answers",
    "JavaPackage": "com.smf.tutorial",
    "JasperFile": "@basedesign/com/smf/tutorial/reports/EvaluacionReport.jrxml"
  }'
```

---

### `CreateComputedColumn`
Crea una columna calculada (virtual/transient) en AD_COLUMN con una expresion SQL.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateComputedColumn&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "TableName": "C_BPartner",
    "ColumnName": "smft_first_expiry_course",
    "Name": "First Expiry Course",
    "SQLLogic": "(SELECT p.name FROM m_product p JOIN smft_enrollment e ON e.courseedition IN (SELECT smft_course_edition_id FROM smft_course_edition WHERE course = p.m_product_id) WHERE e.student = C_BPartner.C_BPartner_ID AND e.dateto >= now() ORDER BY e.dateto ASC LIMIT 1)",
    "ModuleID": "'${MODULE_ID}'"
  }'
```

**Parametros requeridos:** `ColumnName`, `Name`, `SQLLogic`, `ModuleID`, y uno de: `TableID` | `TableName`
**Opcionales:** `ReferenceID` (default="10"=String), `Description`

---

### `RegisterHeadlessEndpoint`
Registra un endpoint EtendoRX headless para exponer un Tab via REST.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterHeadlessEndpoint&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "RequestName": "MyCourses",
    "ModuleID": "'${MODULE_ID}'",
    "TableName": "smft_course_edition",
    "Description": "REST endpoint for Course Edition records"
  }'
```

**Parametros requeridos:** `RequestName`, `ModuleID`, y uno de: `TabID` | `TableName`
**Opcionales:** `Description`, `Type` (default=R)

---

### `RegisterNewWebHook`
Registra un nuevo webhook (clase Java) en BD. Usar despues de crear el archivo `.java`.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterNewWebHook&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Javaclass": "com.smf.tutorial.webhooks.MyWebhook",
    "SearchKey": "MyWebhook",
    "Params": "Param1;Param2;Param3",
    "ModuleJavaPackage": "com.smf.tutorial"
  }'
```

> Despues de registrar, dar acceso al token actual:
> ```bash
> NEW_WH_ID=$(docker exec etendo-db-1 psql -U tad -d etendo -t -c \
>   "SELECT smfwhe_definedwebhook_id FROM smfwhe_definedwebhook WHERE name='MyWebhook';" | tr -d ' ')
> docker exec etendo-db-1 psql -U tad -d etendo -c \
>   "INSERT INTO smfwhe_definedwebhook_acc (smfwhe_definedwebhook_acc_id,ad_client_id,ad_org_id,isactive,created,createdby,updated,updatedby,smfwhe_definedwebhook_id,smfwhe_definedwebhook_token_id) VALUES (get_uuid(),'0','0','Y',now(),'0',now(),'0','${NEW_WH_ID}','${TOKEN_ID}');"
> ```

---

### `RegisterColumns`
Sincroniza columnas fisicas de una tabla con AD_COLUMN (equivale al boton "Create Columns from DB" en el AD).

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterColumns&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"TableID": "'${TABLE_ID}'"}'
```

---

### `GetWindowTabOrTableInfo`
Consulta IDs de ventanas, tabs o tablas existentes sin SQL.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=GetWindowTabOrTableInfo&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"TableName": "SMFT_Asignatura"}'
```

---

## Flujo completo: modulo nuevo desde cero

```
0. CreateModule              -> module_id
1. AddModuleDependency       -> dep en core 3.0
2. CreateAndRegisterTable xN -> table_id por tabla
3. CreateColumn xN           -> columnas por tabla
4. CreateReference           -> listas dropdown (si hay)
5. SQL: UPDATE ad_column     -> asignar referenceValueID a cols de lista
6. SQL: ALTER TABLE ADD FK   -> FKs fisicas (el webhook no las crea)
7. RegisterWindow            -> window_id
8. RegisterTab xN            -> tab_id por tab (orden: TabLevel 0->1->2)
9. RegisterFields xN         -> fields por tab
10. SetTabFilter             -> filtro WHERE en tabs que lo necesiten
11. smartbuild               -> compilar y deployar
```

---

## Extraer IDs del response

```bash
# ID sin comillas (CreateModule, RegisterWindow):
ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")

# ID entre comillas simples (RegisterTab, CreateAndRegisterTable):
ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID: '([A-F0-9a-f]{32})'\",r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
```

---

## Bugs conocidos y workarounds

### Bug 1: RegisterFields NullPointerException en tablas estandar de core
**Sintoma:** `RegisterFields` falla con NPE al intentar registrar fields de un tab cuya tabla es del core (M_Product, C_BPartner, etc.).
**Causa:** Las columnas de extension (EM_SMFT_*) no tienen AD_ELEMENT asociado.
**Workaround:**
```sql
INSERT INTO ad_element (ad_element_id, ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby, columnname, name, printname)
SELECT get_uuid(), '0', '0', 'Y', now(), '0', now(), '0', c.columnname, c.name, c.name
FROM ad_column c
WHERE c.ad_table_id = '{TABLE_ID}'
  AND c.columnname ILIKE 'EM_%'
  AND NOT EXISTS (SELECT 1 FROM ad_element e WHERE LOWER(e.columnname) = LOWER(c.columnname));

UPDATE ad_column c SET ad_element_id = (
  SELECT ad_element_id FROM ad_element e WHERE LOWER(e.columnname) = LOWER(c.columnname) LIMIT 1
)
WHERE c.ad_table_id = '{TABLE_ID}' AND c.columnname ILIKE 'EM_%' AND c.ad_element_id IS NULL;
```

### Bug 2: CreateColumn canBeNull no acepta "Y"/"N"
**Sintoma:** Columna se crea como NOT NULL aunque se pase `canBeNull: "Y"`.
**Causa:** El webhook usa `StringUtils.equalsIgnoreCase(canBeNull, "true")` -- solo reconoce `"true"`/`"false"`.
**Workaround:** Pasar `"canBeNull": "true"` (no `"Y"`).

### Bug 3: CreateColumn en tablas core duplica el prefijo
**Sintoma:** Pasando `"columnNameDB": "SMFT_Is_Course"` en M_Product -> crea `EM_SMFT_SMFT_Is_Course`.
**Causa:** El webhook agrega automaticamente `EM_{PREFIX}_` al nombre cuando la tabla es del core.
**Workaround:** Pasar el nombre SIN el prefijo del modulo: `"columnNameDB": "Is_Course"` -> crea `EM_SMFT_Is_Course`.

### Bug 4: Templates no pueden tener DBPrefix
**Sintoma:** `CreateModule` con `Type=T` + `DBPrefix` falla con trigger `@DBPrefixNotAllowedInTemplate@`.
**Causa:** El trigger `ad_module_dbprefix_trg` bloquea la insercion de prefijos para Type=T.
**Workaround:** Crear template via SQL sin insertar en AD_MODULE_DBPREFIX.

### Bug 5: AddModuleDependency usa setter incorrecto
**Sintoma:** Compile error: `cannot find symbol: method setIsIncluded(boolean)`.
**Causa:** El metodo en la entidad generada es `setIncluded(Boolean)`, no `setIsIncluded`.
**Fix:** Cambiar `dep.setIsIncluded(isIncluded)` -> `dep.setIncluded(isIncluded)` en `AddModuleDependency.java`.
