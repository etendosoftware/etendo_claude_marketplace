-- ============================================================
-- Etendo Lite — Headless endpoint verification + SWS setup
--
-- Run: docker exec -i etendo-db-1 psql -U tad -d etendo < docs/headless-setup.sql
-- ============================================================

-- ── MANUAL SETUP REQUIRED (one-time, per instance) ───────────────────────────
--
-- The /sws/ endpoints require JWT Bearer auth (not Basic Auth).
-- JWT is obtained via POST /etendo/sws/login with {username, password, role}.
--
-- For login to work, the user needs a record in etrx_rx_services_access
-- linking them to the 'auth' service in etrx_rx_services.
--
-- This CANNOT be automated via this SQL because the exact IDs depend on
-- the instance. The configuration must be done:
--   OPTION A) Via Etendo ERP UI:
--     EtendoRX > Services > (select 'auth' service) > Access tab > New
--     Fill in: User, Default Org, Default Role
--
--   OPTION B) Via SQL (adapt IDs to your instance):
--     1. Find the auth service ID:
--        SELECT etrx_rx_services_id, searchkey FROM etrx_rx_services WHERE searchkey='auth';
--
--     2. Find the user, org, and role IDs you want to grant access to:
--        SELECT ad_user_id, name FROM ad_user WHERE name='Admin';
--        SELECT ad_role_id, name FROM ad_role WHERE name='F&B International Group Admin';
--        SELECT ad_org_id, name FROM ad_org WHERE name='F&B España - Región Norte';
--
--     3. Insert access record (example — adapt IDs):
--        INSERT INTO etrx_rx_services_access
--          (etrx_rx_services_access_id, ad_client_id, ad_org_id, isactive,
--           created, createdby, updated, updatedby,
--           etrx_rx_services_id, defaultorg, defaultrole, ad_user_id)
--        VALUES (
--          replace(gen_random_uuid()::text, '-', ''),
--          '0',                                        -- System client (matches admin user)
--          '0', 'Y', now(), '0', now(), '0',
--          '<auth_service_id>',
--          '<default_org_id>',
--          '<default_role_id>',
--          '<ad_user_id>'
--        );
--
-- Notes:
--   - ad_client_id in etrx_rx_services_access MUST match the user's ad_client_id
--     (admin user is client '0', F&B users are client '23C59575...')
--   - Role '0' (System Administrator) returns AccessTableNoView for business data.
--     Use a business role like 'F&B International Group Admin' instead.
--   - After insert, test with:
--     curl -X POST http://localhost:8080/etendo/sws/login \
--       -H 'Content-Type: application/json' \
--       -d '{"username":"admin","password":"admin","role":"<role_id>"}'
--
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify SWS access is configured for a user:
SELECT
  u.name          AS user_name,
  r.name          AS default_role,
  o.name          AS default_org,
  s.searchkey     AS service
FROM etrx_rx_services_access a
JOIN ad_user    u ON u.ad_user_id          = a.ad_user_id
JOIN ad_role    r ON r.ad_role_id          = a.defaultrole
JOIN ad_org     o ON o.ad_org_id           = a.defaultorg
JOIN etrx_rx_services s ON s.etrx_rx_services_id = a.etrx_rx_services_id
WHERE a.isactive = 'Y';

-- ── FIX: SalesInvoice broken ADField reference ────────────────────────────────
--
-- SalesInvoice headless endpoint fails with:
--   "No row with the given identifier exists: [ADField#BE8425D17C914A7AB31E2A3DCEEA75B6]"
--
-- Cause: etrx_openapi_field has a reference to a deleted ADField.
-- Fix:   Delete the dangling row (low risk — just removes an invalid mapping).
--
-- Verify first:
--   SELECT etrx_openapi_field_id, ad_field_id FROM etrx_openapi_field
--   WHERE ad_field_id = 'BE8425D17C914A7AB31E2A3DCEEA75B6';
--
-- Apply fix:
DELETE FROM etrx_openapi_field
WHERE etrx_openapi_field_id = '5E9122BF7E4F477C8C7B1459F2B3F685';
-- After this fix, SalesInvoice POST/GET/PUT all work correctly.
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify headless endpoints exist and are configured correctly:
SELECT
  f.name  AS flow,
  r.name  AS endpoint,
  r.type,
  fp.get, fp.post, fp.put, fp.getbyid,
  ot.ad_tab_id,
  tb.tablename
FROM etapi_openapi_req r
JOIN etapi_openapi_flowpoint fp ON fp.etapi_openapi_req_id = r.etapi_openapi_req_id
JOIN etapi_openapi_flow f       ON f.etapi_openapi_flow_id  = fp.etapi_openapi_flow_id
LEFT JOIN etrx_openapi_tab ot   ON ot.etapi_openapi_req_id  = r.etapi_openapi_req_id
LEFT JOIN ad_tab tab            ON tab.ad_tab_id = ot.ad_tab_id
LEFT JOIN ad_table tb           ON tb.ad_table_id = tab.ad_table_id
WHERE r.name IN (
  'BusinessPartner', 'BPCustomer', 'BPVendor', 'BPAddress',
  'SalesOrder', 'SalesOrderLines',
  'PurchaseOrder', 'PurchaseOrderLines',
  'PurchaseInvoice', 'PurchaseInvoiceLine'
)
ORDER BY f.name, r.name;
