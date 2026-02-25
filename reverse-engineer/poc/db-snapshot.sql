-- Etendo Lite — DB Snapshot (POC)
--
-- Run BEFORE the operation:
--   psql -U etendo -d etendo -f db-snapshot.sql -v SNAPSHOT=before
--
-- Run AFTER the operation:
--   psql -U etendo -d etendo -f db-snapshot.sql -v SNAPSHOT=after
--
-- Then diff the two output files:
--   diff snapshot_before.json snapshot_after.json

-- Tables to capture (sales + purchase flow + core config)
-- Extend this list as you discover relevant tables from the recorder output.

\set output_file 'snapshot_' :SNAPSHOT '.json'
\t on
\o :output_file

SELECT json_build_object(
  'snapshot',    :'SNAPSHOT',
  'captured_at', now(),
  'tables',      json_build_object(

    -- Core business entities
    'c_order',          (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, documentno, docstatus, c_bpartner_id,
                                 m_warehouse_id, dateordered, grandtotal,
                                 issotrx, updated
                          FROM c_order ORDER BY updated DESC LIMIT 100
                        ) t),

    'c_invoice',        (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, documentno, docstatus, c_bpartner_id,
                                 dateinvoiced, grandtotal, issotrx, updated
                          FROM c_invoice ORDER BY updated DESC LIMIT 100
                        ) t),

    'c_invoiceline',    (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, c_invoice_id, m_product_id,
                                 qtyinvoiced, priceactual, linenetamt, updated
                          FROM c_invoiceline ORDER BY updated DESC LIMIT 200
                        ) t),

    'c_orderline',      (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, c_order_id, m_product_id,
                                 qtyordered, priceactual, linenetamt, updated
                          FROM c_orderline ORDER BY updated DESC LIMIT 200
                        ) t),

    -- Business partners
    'c_bpartner',       (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, name, taxid, iscustomer, isvendor,
                                 c_bp_group_id, m_pricelist_id, updated
                          FROM c_bpartner ORDER BY updated DESC LIMIT 100
                        ) t),

    'c_bpartner_location', (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, c_bpartner_id, name, updated
                          FROM c_bpartner_location ORDER BY updated DESC LIMIT 100
                        ) t),

    -- Products
    'm_product',        (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, name, value, m_product_category_id,
                                 c_taxcategory_id, c_uom_id, updated
                          FROM m_product ORDER BY updated DESC LIMIT 100
                        ) t),

    'm_productprice',   (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, m_pricelist_version_id, m_product_id,
                                 pricestd, pricelist, pricelimit, updated
                          FROM m_productprice ORDER BY updated DESC LIMIT 200
                        ) t),

    -- Config: price lists
    'm_pricelist',      (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, name, c_currency_id, issopricelist, updated
                          FROM m_pricelist ORDER BY updated DESC LIMIT 50
                        ) t),

    'm_pricelist_version', (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, m_pricelist_id, name, validfrom, updated
                          FROM m_pricelist_version ORDER BY updated DESC LIMIT 50
                        ) t),

    -- Config: taxes
    'c_taxcategory',    (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, name, updated FROM c_taxcategory
                          ORDER BY updated DESC LIMIT 50
                        ) t),

    'c_tax',            (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, name, rate, c_taxcategory_id,
                                 istaxexempt, updated
                          FROM c_tax ORDER BY updated DESC LIMIT 50
                        ) t),

    -- Config: payment
    'c_paymentterm',    (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, name, netdays, updated
                          FROM c_paymentterm ORDER BY updated DESC LIMIT 50
                        ) t),

    -- Config: document types
    'c_doctype',        (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, name, docbasetype, gl_doctype_id, updated
                          FROM c_doctype ORDER BY updated DESC LIMIT 50
                        ) t),

    -- Organization + warehouse
    'ad_org',           (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, name, value, isready, updated
                          FROM ad_org ORDER BY updated DESC LIMIT 20
                        ) t),

    'm_warehouse',      (SELECT json_agg(row_to_json(t)) FROM (
                          SELECT id, name, value, ad_org_id, updated
                          FROM m_warehouse ORDER BY updated DESC LIMIT 20
                        ) t)
  )
);

\o
\t off

\echo 'Snapshot written to' :output_file
