# Java Development in Etendo

Covers the four main Java extension patterns: DAL processes, Event Handlers, Background Processes, and Callouts.

---

## Data Access Layer (DAL)

The DAL is Etendo's ORM — it maps generated Java entity classes to database tables and handles security, transactions, and queries automatically.

### Getting an entity

```java
import org.openbravo.dal.service.OBDal;

// Get by primary key
HotelGuest guest = OBDal.getInstance().get(HotelGuest.class, guestId);

// Query with criteria
OBCriteria<HotelStay> criteria = OBDal.getInstance().createCriteria(HotelStay.class);
criteria.add(Restrictions.eq(HotelStay.PROPERTY_GUEST, guest));
criteria.add(Restrictions.isNull(HotelStay.PROPERTY_DATEOUT));
List<HotelStay> openStays = criteria.list();
```

### Saving / updating

```java
// Modify a field
stay.setDateOut(new Date());
OBDal.getInstance().save(stay);
// DAL auto-commits at end of transaction
```

### Logging

Always use log4j (never `System.out`):

```java
import org.apache.log4j.Logger;
private static final Logger log = Logger.getLogger(MyClass.class);

log.error("Unexpected error: " + e.getMessage(), e);
log.info("Processing guest: " + guestId);
```

Useful levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.
Default Etendo config writes `error` and above to `openbravo.log`.

### Displaying messages to the user (action buttons)

```java
import org.openbravo.service.db.DbUtility;
JSONObject result = new JSONObject();
result.put("message", OBMessageUtils.messageBD("YourMessageKey"));
// or plain text
result.put("message", "Rate recalculated successfully");
vars.setSessionValue(bundle.getProcessId() + "|message", result.toString());
```

---

## Action Button Java Process

Used when you need a button in a window tab that runs server-side logic.

### Application Dictionary setup

1. **Application Dictionary → Report and Process** — create new record:
   - UI Pattern: `Standard`
   - Background: unchecked
   - Procedure: leave empty
2. In **[Process Class]** tab, add a line:
   - Default: `Y`
   - Java Class Name: `com.yourcompany.module.ad_actionButton.YourProcess`
3. Add a column to the underlying table: `ALTER TABLE hotel_guest ADD COLUMN calculate_guest_rate character(1);`
4. Register the column in **Table and Column**, set Reference = `Button`, Process = the one above
5. Add the column as a Field in the window Tab
6. Run **Synchronize Terminology**

### Class skeleton

```java
package com.yourcompany.hotelmanagement.ad_actionButton;

import org.openbravo.scheduling.ProcessBundle;
import org.openbravo.base.secureApp.VariablesSecureApp;
import org.openbravo.dal.service.OBDal;
// ... other imports

public class CalculateGuestRate implements org.openbravo.scheduling.Process {
    @Override
    public void execute(ProcessBundle bundle) throws Exception {
        VariablesSecureApp vars = bundle.getContext().toVars();
        String guestId = (String) bundle.getParams().get("inphotelGuestId");

        // DAL operations here
        HotelGuest guest = OBDal.getInstance().get(HotelGuest.class, guestId);
        // ...
    }
}
```

### Recompile

```bash
./gradlew compile.complete.deploy
# Docker Tomcat: auto-reloads after ~30-60s, no action needed
# Local Tomcat: must restart Tomcat manually for changes to take effect
```

---

## Event Handlers

Event handlers fire when a DAL entity is saved/updated/deleted — no AD metadata needed, registered automatically by Weld (CDI) at startup.

### When to use

- Business rule enforcement on save (e.g., auto-checkout previous stay)
- Calculated field updates triggered by another record insert
- Validation that throws an error to prevent saving

### Class skeleton

```java
package com.yourcompany.hotelmanagement.events;

import javax.enterprise.event.Observes;
import org.openbravo.base.model.Entity;
import org.openbravo.base.model.ModelProvider;
import org.openbravo.client.kernel.event.EntityNewEvent;
import org.openbravo.client.kernel.event.EntityPersistenceEventObserver;
import org.openbravo.dal.service.OBDal;
import org.hibernate.criterion.Restrictions;
import com.yourcompany.hotelmanagement.data.HotelStay;

public class HotelStayAutoCheckOut extends EntityPersistenceEventObserver {

    // Define which entities this observer applies to
    private static Entity[] entities = {
        ModelProvider.getInstance().getEntity(HotelStay.ENTITY_NAME)
    };

    @Override
    protected Entity[] getObservedEntities() {
        return entities;
    }

    public void onNew(@Observes EntityNewEvent event) {
        if (!isValidEvent(event)) return;

        HotelStay newStay = (HotelStay) event.getTargetInstance();
        String guestId = newStay.getHotelGuest().getId();
        Date dateIn = newStay.getDateIn();

        // Find non-checked-out stays for same guest
        OBCriteria<HotelStay> criteria = OBDal.getInstance().createCriteria(HotelStay.class);
        criteria.add(Restrictions.eq(HotelStay.PROPERTY_HOTELGUEST, newStay.getHotelGuest()));
        criteria.add(Restrictions.isNull(HotelStay.PROPERTY_DATEOUT));

        for (HotelStay stay : criteria.list()) {
            stay.setDateOut(dateIn);
            long days = (stay.getDateOut().getTime() - stay.getDateIn().getTime()) / (24 * 60 * 60 * 1000);
            // set final sum...
            OBDal.getInstance().save(stay);
        }
    }
}
```

### Throwing a validation error

```java
// Prevents the save and shows a red message in the UI
throw new IllegalStateException("Cannot check in: guest already has an active stay");
```

### Recompile

Only needs an Eclipse refresh + Tomcat reload (no full recompile needed — it's manual code, not generated). Docker Tomcat auto-reloads; local Tomcat requires a manual restart.

### Known limitation

Event handlers do **not** refresh the frontend. The user must manually reload the record/grid to see changes triggered by an event handler.

---

## Background Processes

Run automatically on a schedule without user interaction. Use `DalBaseProcess` as the base class.

### Application Dictionary setup

**Application Dictionary → Report and Process**, create new record:
- UI Pattern: `Manual`
- Background: ✓ checked
- Java Class Name: `com.yourcompany.module.ad_process.MyBackgroundProcess`

### Class skeleton

```java
package com.yourcompany.module.ad_process;

import org.openbravo.scheduling.ProcessBundle;
import org.openbravo.dal.process.DalBaseProcess;
import org.openbravo.dal.service.OBDal;

public class MyBackgroundProcess extends DalBaseProcess {

    @Override
    public void doExecute(ProcessBundle bundle) throws Exception {
        // All DB access via DAL
        OBCriteria<SomeEntity> criteria = OBDal.getInstance().createCriteria(SomeEntity.class);
        // ...
        for (SomeEntity record : criteria.list()) {
            // process each record
        }
    }
}
```

### Date helpers

```java
Calendar calendar = Calendar.getInstance();
calendar.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY);
calendar.add(Calendar.WEEK_OF_YEAR, -1);
Date weekStart = calendar.getTime();
```

### Scheduling a process

1. Log in as Admin → **General Setup → Process Scheduling → Process Request**
2. Create new record:
   - Process: select your background process
   - Timing: `Scheduled`
   - Frequency: `01 - Every n seconds` (or weekly, etc.)
   - Interval in Seconds: e.g., `60`
3. Click **Schedule Process** button
4. Monitor runs in **Process Monitor** window

### Recompile

Eclipse refresh + Tomcat reload only. Docker Tomcat auto-reloads; local Tomcat requires a manual restart.

---

## Callouts (Server-side)

Callouts are Java servlets that fire when a field value changes in a form. They return JavaScript that modifies other fields in the same form.

### When to use

Use callouts when you need **server-side logic** triggered by a field change (e.g., fetching a rate from DB to populate another field). For pure client-side logic (no DB needed), use `onChange` instead.

### Application Dictionary setup

1. **Application Dictionary → Setup → Callout** — create new record:
   - Name: `SCC_MyCallout` (no spaces; by convention prefix with `SCC_`)
2. In **[Callout Class]** tab — verify the generated class name matches your module's package
3. In **[Callout Mapping]** tab — verify the URL mapping
4. Link the callout to a column: **Table and Column → [Column]**, set Callout = your callout

### Class skeleton using SimpleCallout

```java
package com.yourcompany.hotelmanagement.ad_callouts;

import org.openbravo.erpCommon.ad_callouts.SimpleCallout;
import javax.servlet.ServletException;

public class StayFinalSumCalculation extends SimpleCallout {

    @Override
    protected void execute(CalloutInfo info) throws ServletException {
        // Read incoming field value
        String dateOut = info.getStringParameter("inpDateOut", IsIDFilter.instance);
        String dateIn = info.getStringParameter("inpDateIn", IsIDFilter.instance);
        String roomId = info.getStringParameter("inpHotelRoomId", IsIDFilter.instance);

        // Fetch room rate from DB via DAL
        HotelRoom room = OBDal.getInstance().get(HotelRoom.class, roomId);

        // Calculate
        // ...

        // Set field in UI
        info.addResult("inpFinalSum", calculatedSum.toString());
    }
}
```

### Recompile

```bash
./gradlew smartbuild
# Docker Tomcat: auto-reloads after ~30-60s
# Local Tomcat: must restart Tomcat manually
```

---

## Client-side onChange Functions

Preferred over server-side callouts when no DB call is needed. Implemented in JavaScript.

### Benefits
- Better performance (no round-trip to server)
- Direct access to UI components (fields, form, grid)
- Can still call the server if needed

### Reference
[How to create client side callout onChange function](http://wiki.openbravo.com/wiki/How_to_create_client_side_callout_onchange_function)

---

## Custom Web Services

To expose a custom REST endpoint in Etendo:

1. Create a Java class extending `BaseWebServiceServlet` (or implementing `WebService`)
2. Register it in a `web.xml` file within your module
3. Access via `/etendo/ws/your-endpoint-path`

For token-authenticated web services (the **Secure Web Services** module), configure:
- **Client window → Secure web services configuration tab**:
  - Expiration Time (0 = never expires)
  - Private Key (generate via "Generate key" button)

Token endpoints:
```
POST /etendo/sws/com.smf.securewebservices/token   # get token
POST /etendo/sws/com.smf.securewebservices/refresh  # refresh token
GET  /etendo/sws/com.smf.securewebservices/jsonDal  # DAL via JSON
```

---

## Module File Structure for Java Code

```
modules/com.yourcompany.hotelmanagement/
├── src/
│   └── com/yourcompany/hotelmanagement/
│       ├── ad_actionButton/     # Action button processes
│       ├── ad_callouts/         # Server-side callouts
│       ├── ad_process/          # Background processes
│       ├── events/              # Event handlers
│       └── data/                # (generated) Entity classes
├── src-db/
│   └── database/
│       ├── model/tables/        # XML table definitions
│       └── sourcedata/          # AD metadata XML
├── build.gradle                 # For JAR modules
└── META-INF/beans.xml           # CDI config (needed for event handlers + DI)
```

### beans.xml (required for event handlers and dependency injection)

```xml
<beans xmlns="http://xmlns.jcp.org/xml/ns/javaee"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee
           http://xmlns.jcp.org/xml/ns/javaee/beans_2_0.xsd"
       bean-discovery-mode="all" version="2.0">
</beans>
```

Place at: `etendo-resources/META-INF/beans.xml` and register in `build.gradle`:

```groovy
sourceSets {
    main {
        resources {
            srcDirs("etendo-resources")
        }
    }
}
```
