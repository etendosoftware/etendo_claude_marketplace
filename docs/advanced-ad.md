# Advanced Application Dictionary Concepts

Covers field-level display logic, validation, default values, references, sequences, and the export/deploy flow.

---

## Field-Level Logic

These properties are defined in **Application Dictionary → Windows, Tabs, and Fields → [Field]**.

### Display Logic

Controls whether a field is visible. Uses `@FIELD_NAME@` tokens with `&` (AND) and `|` (OR).

```
@Date_Out@!'' & @Date_Out@!null
```
→ Show this field only when `Date_Out` has a value.

```
@Role@='Manager'
```
→ Show only to managers.

### Read-Only Logic

Same syntax — when expression is true, field becomes read-only.

```
@isActive@='N'
```

### Default Value

SQL expression or literal evaluated when a new record is created.

```sql
-- Inherit from parent tab
@HotelGuest.roomRate@

-- Current user
@#AD_User_ID@

-- Fixed value
'A'
```

### Validation (Column-level)

SQL `WHERE` clause added to the dropdown query for a column. Defined in **Table and Column → [Column] → Validation**.

```sql
-- Show only available rooms
hotel_room_id NOT IN (
  SELECT hotel_room_id FROM hotel_stay WHERE date_out IS NULL
)
```

---

## References (List / Table / TableDir)

References define the data type and UI widget for a column.

### List Reference

A fixed set of values selectable from a dropdown.

1. **Application Dictionary → Reference** — create new with Base Reference = `List`
2. In **[List Reference]** tab, add rows: `Search Key` + `Name`
3. Assign to a column: Reference = the list reference you created

Example values for "Room Rate":
| Search Key | Name |
|---|---|
| A | Standard |
| B | Deluxe |
| C | Suite |

### Table / TableDir Reference

Points to another table's records for a foreign key dropdown. `TableDir` auto-resolves by column name convention (e.g., `hotel_room_id` → `hotel_room`). `Table` requires explicit configuration.

---

## Sequences

Sequences auto-generate document numbers for columns.

### Quick setup

1. In **Table and Column**, set the column Reference to a sequence reference
2. **Application → General Setup → Application → Create Sequences** — run to generate
3. Ensure the Document Type has "sequenced document" **unchecked** (for simple sequences)
4. `./gradlew smartbuild`

### Transactional sequences

Lock the table row to generate numbers without gaps. Use for invoices, orders, etc.

### Non-transactional sequences

Use a PostgreSQL sequence (`CREATE SEQUENCE`). Gaps are possible. Use for less critical document numbers.

### Custom sequence reference

1. **Application Dictionary → Reference** — new record, Parent Reference = `Transactional Sequence` or `Non-Transactional Sequence`
2. For non-transactional: set DB sequence name, initial value, increment
3. Add the column to the Dimension List

---

## Master Data Management (MDM)

### Linking custom entities to core

Custom entities (like `hotel_guest`) can be linked to core entities (like `c_bpartner`) via a foreign key column.

Pattern:
```sql
-- In your custom table
c_bpartner_id VARCHAR(32) REFERENCES c_bpartner(c_bpartner_id)
```

In AD: set the column Reference to `TableDir` or `Search` pointing to `c_bpartner`.

### Customizing the Business Partner window

To show additional tabs or fields in a core window for your module:
1. In **Windows, Tabs, and Fields** — find the window (you can add a tab pointing to your linked table)
2. Set a Display Logic or column filter to show only relevant records

---

## Exporting AD changes

After any change made via the AD UI (new window, new field, new reference), export to XML:

```bash
./gradlew export.database -Dmodule=com.yourcompany.module
```

This writes XML files under `modules/com.yourcompany.module/src-db/database/sourcedata/`.

**Always export** before committing — the DB is the source of truth at design time, the XML is the source of truth for distribution.

---

## Deploying to another environment

After exporting:

```bash
# On target environment:
./gradlew update.database smartbuild
```

This reads the XML files and applies them to the DB.

---

## Property Fields (read-only derived data)

A Property Field lets you show a field from a related record directly in a grid or form.

In the **Field** definition:
- Reference: `Search` pointing to the related table
- Check "Read Only"
- Check "Show in grid view"

Useful for showing data like "Guest's Room Rate" in the Stay tab without a separate join.

---

## Stored Procedures and Triggers (legacy — avoid)

**Do not** write new stored procedures or triggers. They bypass DAL security and are DB-vendor-specific.

### If you must modify existing stored procedure logic

- Copy the stored procedure into a new one prefixed with your module's DB prefix
- OR replace with a Java process using DAL

### Extension points

Some core stored procedures have explicit extension points. Prefer these over modifying core directly.

### Triggers

Triggers are legacy. For new logic on table changes, use **Event Handlers** instead (see `java-development.md`).

---

## Data Access Level

Set on the Table in the AD. Controls which records are accessible per client/org:

| Value | Meaning |
|---|---|
| System only | System-level config; no client isolation |
| System/Client | Shared across all orgs of a client |
| Client/Organization | Most common — per org |
| Organization | Company-specific operational data |

Use `Client/Organization` for master data (guests, rooms) and `Organization` for transactional data (stays).
