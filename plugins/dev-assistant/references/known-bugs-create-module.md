# Known Bugs: CreateModule Webhook

## Bug: Templates cannot have DBPrefix

**Symptom:** `CreateModule` with `Type=T` + `DBPrefix` fails with trigger `@DBPrefixNotAllowedInTemplate@`.

**Cause:** The trigger `ad_module_dbprefix_trg` blocks the insertion of prefixes for Type=T.

**Workaround:** Create the template via direct SQL without inserting into AD_MODULE_DBPREFIX. See the template creation SQL block in the webhooks skill.
