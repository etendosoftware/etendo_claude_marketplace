# /etendo:java — Crear código Java en un módulo Etendo

**Arguments:** `$ARGUMENTS` (ej: "eventhandler para SMFT_Inscripcion", "background process expire", "action process asignar puntaje")

---

Primero, leer `.claude/commands/etendo/_context.md` y `.claude/commands/etendo/_webhooks.md`.

## Step 1: Contexto

Resolver módulo activo y detectar el tipo de componente a crear:

| Tipo | Cuándo |
|---|---|
| **EventHandler** | "cuando se guarda/crea/modifica X, hacer Y" |
| **Background Process** | "proceso que corre todos los días / periódicamente" |
| **Action Process** | "proceso lanzable desde menú o botón con parámetros" |
| **Webhook** | "exponer una operación como endpoint HTTP llamable por Copilot" |
| **Computed Column** | "campo calculado en una ventana existente" |
| **Callout** | "lógica al cambiar un campo en la UI" |

## Step 2: Entender qué se necesita

Preguntar sólo lo necesario:
- ¿Qué entidad/tabla es el sujeto?
- ¿Qué debe hacer exactamente?
- ¿Qué validaciones hay?
- ¿Qué parámetros recibe (para Action Process)?

## Step 3: Descubrir el package de las entidades generadas

**CRÍTICO**: Antes de escribir código Java, verificar el package real de las entidades generadas:

```bash
find {etendo_base}/build/etendo/src-gen -name "{NombreEntidad}.java" 2>/dev/null
# Ejemplo:
find /path/etendo_base/build/etendo/src-gen -name "SMFT_Inscripcion.java" 2>/dev/null
```

El package generado por Etendo sigue el patrón: `{javapackage}.{javapackage}.ad`
- Ej: `com.smf.tutorial` → `com.smf.tutorial.com.smf.tutorial.ad`

Verificar las propiedades y getters disponibles:
```bash
grep "PROPERTY_\|public.*get" build/etendo/src-gen/.../SMFT_Inscripcion.java | grep -v "@see\|return\|/\*"
```

**Si las entidades no existen todavía** (tabla recién creada), ejecutar primero:
```bash
./gradlew resources.up && sleep 15
JAVA_HOME=... ./gradlew generate.entities
```

## Step 4: Escribir el código Java

### EventHandler

```java
package {javapackage}.events;

import javax.enterprise.event.Observes;
import org.openbravo.base.model.Entity;
import org.openbravo.base.model.ModelProvider;
import org.openbravo.client.kernel.event.*;
import org.openbravo.dal.service.OBDal;
import {generatedPackage}.{Entity};

public class {Entity}EventHandler extends EntityPersistenceEventObserver {

  private static Entity[] ENTITIES = {
    ModelProvider.getInstance().getEntity({Entity}.ENTITY_NAME)
  };

  @Override
  protected Entity[] getObservedEntities() { return ENTITIES; }

  public void onNew(@Observes EntityNewEvent event) {
    if (!isValidEvent(event)) return;
    handle(({Entity}) event.getTargetInstance());
  }

  public void onUpdate(@Observes EntityUpdateEvent event) {
    if (!isValidEvent(event)) return;
    handle(({Entity}) event.getTargetInstance());
  }

  private void handle({Entity} record) {
    // lógica aquí — usar record.getXxx() / record.setXxx()
    // lanzar OBException para validaciones
  }
}
```

### Background Process

```java
package {javapackage}.process;

import org.openbravo.scheduling.Process;
import org.openbravo.scheduling.ProcessBundle;
import org.openbravo.dal.service.*;
import org.hibernate.criterion.Restrictions;
import {generatedPackage}.{Entity};
import java.util.List;

public class {Name}Process implements Process {

  @Override
  public void execute(ProcessBundle bundle) throws Exception {
    OBCriteria<{Entity}> crit = OBDal.getInstance().createCriteria({Entity}.class);
    crit.add(Restrictions.eq({Entity}.PROPERTY_ACTIVE, true));
    // más filtros...

    List<{Entity}> records = crit.list();
    int count = 0;
    for ({Entity} r : records) {
      // procesar
      OBDal.getInstance().save(r);
      count++;
    }
    OBDal.getInstance().flush();
    bundle.getLogger().log("Processed " + count + " records.");
  }
}
```

**Registrar en AD** vía webhook (Tomcat debe estar UP):
```bash
curl -s -G "${ETENDO_URL}/webhooks/RegisterBGProcessWebHook" \
  --data-urlencode "name=RegisterBGProcessWebHook" \
  --data-urlencode "apikey=${API_KEY}" \
  --data-urlencode "Javapackage={javapackage}" \
  --data-urlencode "Name={NombreVisible}" \
  --data-urlencode "SearchKey={PREFIX_SearchKey}" \
  --data-urlencode "Description={descripcion}" \
  --data-urlencode "PreventConcurrent=true"
```

### Action Process (lanzable desde menú)

```java
package {javapackage}.process;

import java.util.Map;
import org.codehaus.jettison.json.*;
import org.openbravo.base.exception.OBException;
import org.openbravo.client.application.process.BaseProcessActionHandler;
import org.openbravo.dal.service.OBDal;

public class {Name}Process extends BaseProcessActionHandler {

  @Override
  protected JSONObject doExecute(Map<String, Object> parameters, String content) {
    JSONObject result = new JSONObject();
    try {
      JSONObject params = new JSONObject(content).getJSONObject("_params");
      // leer params: params.getString("paramName")
      // lógica...
      result.put("responseActions", new JSONArray()
        .put(new JSONObject().put("showMsgInProcessView", new JSONObject()
          .put("msgType", "success")
          .put("msgTitle", "OK")
          .put("msgText", "Proceso completado"))));
    } catch (OBException e) {
      try {
        result.put("responseActions", new JSONArray()
          .put(new JSONObject().put("showMsgInProcessView", new JSONObject()
            .put("msgType", "error")
            .put("msgTitle", "Error")
            .put("msgText", e.getMessage()))));
      } catch (Exception ignore) {}
    } catch (Exception e) {
      // log error
    }
    return result;
  }
}
```

### Webhook

Un webhook es una clase Java que extiende `BaseWebhookService` y expone una operación HTTP
llamable por Copilot u otros clientes. Requiere registro en BD después de crear el archivo.

**Patrón del archivo:** `modules/{module}/src/{javapackage}/webhooks/{Name}.java`

```java
package {javapackage}.webhooks;

import static com.etendoerp.copilot.devassistant.Utils.logExecutionInit;
import java.util.Map;
import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.openbravo.base.exception.OBException;
import org.openbravo.dal.core.OBContext;
import org.openbravo.dal.service.OBDal;
import com.etendoerp.webhookevents.services.BaseWebhookService;

/**
 * Webhook to {descripción de qué hace}.
 *
 * <p>Required parameters:
 * <ul>
 *   <li>{@code Param1} — descripción</li>
 * </ul>
 * <p>Optional parameters:
 * <ul>
 *   <li>{@code Param2} — descripción (default: valor)</li>
 * </ul>
 * <p>Response: {@code {"message": "..."}}
 */
public class {Name} extends BaseWebhookService {

  private static final Logger LOG = LogManager.getLogger();

  @Override
  public void get(Map<String, String> parameter, Map<String, String> responseVars) {
    logExecutionInit(parameter, LOG);

    String param1 = parameter.get("Param1");

    try {
      if (StringUtils.isBlank(param1)) {
        throw new OBException("Param1 parameter is required");
      }

      OBContext.setAdminMode(true);
      try {
        // lógica principal
        OBDal.getInstance().flush();
        responseVars.put("message", "Done: " + param1);
      } finally {
        OBContext.restorePreviousMode();
      }

    } catch (Exception e) {
      LOG.error("Error in {Name}: {}", e.getMessage(), e);
      responseVars.put("error", e.getMessage());
      OBDal.getInstance().getSession().clear();
    }
  }
}
```

**Después de crear el archivo**, registrar en BD vía webhook (Tomcat debe estar UP):

```bash
curl -s -G "${ETENDO_URL}/webhooks/RegisterNewWebHook" \
  --data-urlencode "name=RegisterNewWebHook" \
  --data-urlencode "apikey=${API_KEY}" \
  --data-urlencode "Javaclass={javapackage}.webhooks.{Name}" \
  --data-urlencode "SearchKey={Name}" \
  --data-urlencode "Params=Param1;Param2" \
  --data-urlencode "ModuleJavaPackage={javapackage}"
```

> **Nota:** `Params` es lista separada por `;` — todos quedan como `ISREQUIRED=Y` en BD.
> Si necesitás params opcionales, ajustarlos manualmente en la ventana de Webhooks del AD.
>
> **Para que persista entre deploys**, agregar la entrada manualmente a
> `src-db/database/sourcedata/SMFWHE_DEFINEDWEBHOOK.xml` y `SMFWHE_DEFINEDWEBHOOK_PARAM.xml`
> siguiendo el patrón de los webhooks existentes del módulo.

## Step 5: Registrar en AD (si no se usó webhook)

Para Action Process y Jasper, usar SQL directo solo si no existe webhook equivalente.
Preferir siempre los webhooks `RegisterBGProcessWebHook` y `ProcessDefinitionJasper`.

## Step 6: Compilar

```bash
JAVA_HOME=... ./gradlew smartbuild > /tmp/smartbuild.log 2>&1
tail -20 /tmp/smartbuild.log
grep "\[ant:javac\]" /tmp/smartbuild.log | head -20
```

Si hay errores de compilación:
1. Verificar el package import de las entidades generadas (Step 3)
2. Verificar nombres de PROPERTY_ y getters (copiar del .java generado)
3. Verificar que las entidades existen (generate.entities corrió exitosamente)

## Step 7: Resultado

```
✓ {Tipo} {Nombre} creado y compilado

  Archivo: modules/{module}/src/{path}/{Nombre}.java

  Próximos pasos:
    /etendo:smartbuild → si aún no corrió
    Verificar logs de Tomcat para confirmar que el handler/process se registra
```
