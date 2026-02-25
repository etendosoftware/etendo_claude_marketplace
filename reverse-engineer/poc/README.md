# POC — Validation

Two tools to validate the reverse engineering approach before building the full stack.

## What we're validating

1. Can we intercept Etendo's `fetch` calls from the browser console?
2. Do the captured payloads contain enough information to reconstruct the operation?
3. Are the call sequences consistent across repeated runs of the same operation?
4. Does the DB diff confirm what the HTTP calls suggest?

---

## Tool 1: recorder.js

Paste the script in DevTools console while on the Etendo UI.

### Steps

```
1. Open Etendo in Chrome/Firefox
2. Open DevTools → Console
3. Paste the contents of recorder.js and hit Enter
4. Run: recorder.start("create_sales_invoice")
5. Perform the operation in the Etendo UI (create an invoice end-to-end)
6. Run: recorder.stop()
7. Run: recorder.export()   ← JSON copied to clipboard
8. Save the output as: sessions/create_sales_invoice_01.session.json
```

### Phase A operations to record

```
recorder.start("configure_organization",  "setup")
recorder.start("configure_price_list",    "setup")
recorder.start("configure_taxes",         "setup")
recorder.start("configure_payment_terms", "setup")
```

### Phase B operations to record

```
recorder.start("create_customer",         "execution")
recorder.start("create_sales_order",      "execution")
recorder.start("create_sales_invoice",    "execution")
recorder.start("complete_sales_invoice",  "execution")
recorder.start("create_vendor",           "execution")
recorder.start("create_purchase_order",   "execution")
recorder.start("create_purchase_invoice", "execution")
```

### Repeat each operation 3 times

Save each run with an incrementing suffix:
```
sessions/create_sales_invoice_01.session.json
sessions/create_sales_invoice_02.session.json
sessions/create_sales_invoice_03.session.json
```

---

## Tool 2: db-snapshot.sql

Run before and after each operation to see exactly what changed in the DB.

### Requirements

- Direct access to the Etendo PostgreSQL instance
- `psql` CLI

### Steps

```bash
# Before the operation
psql -U etendo -d etendo -f db-snapshot.sql -v SNAPSHOT=before

# ... perform the operation in the UI ...

# After the operation
psql -U etendo -d etendo -f db-snapshot.sql -v SNAPSHOT=after

# Diff the two snapshots
diff snapshot_before.json snapshot_after.json
```

### What to look for in the diff

- Which tables have new rows → those are the entities created by the operation
- Which tables have updated rows → those are the entities modified
- The order of `updated` timestamps reveals the sequence in which Etendo writes to DB
- Any table not in the snapshot that changes → add it to the `db-snapshot.sql` table list

---

## Validation checklist

After recording 3 runs of `create_sales_invoice` and running the DB diff:

- [ ] The recorder captures calls (not empty sessions)
- [ ] Payloads are readable JSON (not encrypted or obfuscated)
- [ ] The same logical sequence appears across all 3 runs
- [ ] The DB diff shows changes in the expected tables (`c_invoice`, `c_invoiceline`, etc.)
- [ ] The IDs captured in HTTP responses match the IDs appearing in the DB diff
- [ ] Noise filtering is working (no static asset calls in the session)

If all boxes are checked → the approach is valid. Proceed to the Analyzer.
If some fail → document the blocker and adjust the approach.

---

## Session file location

```
poc/
├── README.md
├── recorder.js
├── db-snapshot.sql
└── sessions/              ← create this directory, gitignored (may contain real data)
    ├── create_sales_invoice_01.session.json
    ├── create_sales_invoice_02.session.json
    └── ...
```

Add `poc/sessions/` to `.gitignore` if sessions contain real client data.
