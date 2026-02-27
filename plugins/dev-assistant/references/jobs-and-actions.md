# Jobs and Actions

Jobs and Actions are a higher-level abstraction over standard processes, introduced in recent Etendo versions.

---

## Concepts

**Action** — a standard process with UI Pattern = `Action`. Actions can be chained.

**Job** — a named sequence of one or more Actions executed in order. Users can create and store Jobs for later reuse.

Think of it like: iOS Shortcuts or Jira Automations — composable automation steps.

---

## Creating an Action

### 1. Application Dictionary setup

**Application Dictionary → Report and Process** — new record:
- UI Pattern: `Action`
- Java Class Name: `com.yourcompany.module.ad_process.MyAction`

Optionally add:
- A column + field (button) to trigger from a window tab
- A menu entry to run from the navigation bar

### 2. Java class

The class must extend the `Action` type and implement two primary methods:

```java
package com.yourcompany.module.ad_process;

import org.openbravo.client.application.process.BaseProcessActionHandler;
import org.codehaus.jettison.json.JSONObject;
import org.apache.commons.lang.mutable.MutableBoolean;

public class MyAction extends BaseProcessActionHandler {

    @Override
    protected JSONObject doExecute(Map<String, Object> parameters, String content) {
        JSONObject result = new JSONObject();
        try {
            // Your business logic here (DAL operations, etc.)

            // Return success message
            result.put("message", new JSONObject()
                .put("severity", "success")
                .put("text", "Action completed"));
        } catch (Exception e) {
            log.error("Error in MyAction", e);
            // Return error
        }
        return result;
    }
}
```

### Key method: `getInputContents()`

Used to get input data passed to the action (e.g., selected record IDs):

```java
// Get the selected record ID from the parameters
String recordId = (String) parameters.get("inpRecordId");
```

### Stopping a Job chain

When an action in a chain fails, set `isStopped = true` to halt subsequent actions:

```java
// In older action API:
isStopped.setValue(true);
```

---

## Scheduling an Action as a background Job

1. Navigate to **General Setup → Process Scheduling → Process Request**
2. Select the Action process
3. Configure timing (scheduled, frequency, interval)
4. Click **Schedule Process**

---

## Cloning Processes and Hooks

### Adding a Clone button to a window

Etendo provides `Dal.copy()` as the default clone method. To add a Clone button:

1. Enable the clone button in the tab configuration

### Custom clone logic via CloneRecordHook

For custom cloning behavior (e.g., reset certain fields, deep-copy children):

```java
package com.yourcompany.module.hooks;

import javax.enterprise.context.ApplicationScoped;
import javax.inject.Qualifier;
import org.openbravo.client.kernel.CloneRecordHook;
import org.openbravo.model.financialmgmt.payment.FIN_Payment; // example entity

@ApplicationScoped
@Qualifier(Invoice.ENTITY_NAME)   // entity this hook applies to
public class InvoiceCloneHook extends CloneRecordHook<Invoice> {

    @Override
    public boolean shouldCopyChildren() {
        return true; // copy child records?
    }

    @Override
    public void preCopy(Invoice original) {
        // called before copy — validate, prepare
    }

    @Override
    public void postCopy(Invoice original, Invoice copy) {
        // called after copy — adjust fields, reset status
        copy.setDocumentStatus("DR"); // reset to draft
        copy.setDocumentNo(null);     // clear doc number for re-generation
    }

    @Override
    public boolean shouldResetId() {
        return true; // new UUID for the copy
    }

    @Override
    public int getPriority() {
        return 100; // lower = higher priority when multiple hooks match
    }
}
```

### CloneRecordHook API summary

| Method | Purpose |
|---|---|
| `shouldCopyChildren()` | Whether to recursively copy child records |
| `preCopy(original)` | Runs before the copy — validation |
| `postCopy(original, copy)` | Runs after copy — field adjustments |
| `copy(original)` | Override to fully control the copy logic |
| `shouldResetId()` | Whether the copy gets a new UUID (default: true) |
| `getPriority()` | Determines which hook runs first when multiple match |
