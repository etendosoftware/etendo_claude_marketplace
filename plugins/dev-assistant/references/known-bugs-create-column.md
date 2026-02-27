# Known Bugs: CreateColumn Webhook

## Bug: canBeNull does not accept "Y"/"N"

**Symptom:** Column is created as NOT NULL even when passing `canBeNull: "Y"`.

**Cause:** The webhook uses `StringUtils.equalsIgnoreCase(canBeNull, "true")` — it only recognizes `"true"`/`"false"`.

**Workaround:** Pass `"canBeNull": "true"` (not `"Y"`).

---

## Bug: CreateColumn on core tables duplicates the prefix

**Symptom:** Passing `"columnNameDB": "SMFT_Is_Course"` on M_Product creates `EM_SMFT_SMFT_Is_Course`.

**Cause:** The webhook automatically adds `EM_{PREFIX}_` to the name when the table belongs to core.

**Workaround:** Pass the name WITHOUT the module prefix: `"columnNameDB": "Is_Course"` → creates `EM_SMFT_Is_Course`.
