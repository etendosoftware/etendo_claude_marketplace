/**
 * analyzer.js
 * Reads a session.json and extracts:
 *  - essential write calls (add/update with _new + FormInit EDIT with docaction)
 *  - minimal user inputs per call
 *  - derived fields, fixed fields
 *  - operation type (create | complete | search)
 */

import { URL } from 'url'
import { parse as parseQS } from 'querystring'

// ─── Field classification ────────────────────────────────────────────────────

const FIXED = new Set([
  'organization','client','warehouse','userContact','active','salesTransaction',
  'documentStatus','documentAction','posted','ORDERTYPE','DOCBASETYPE',
  'invoiceTerms','deliveryMethod','deliveryTerms','freightCostRule','priority',
  'formOfPayment','documentType','aPRMAddpayment','aPRMProcessinvoice',
  'etvfacInvType','equotDeliverytime','equotOumdeliverytime',
  'eTAWIMPickingGeneration','PromotionsDefined','IsReversalDocument',
  'etblkpAccountingstatus','AEATSII_AcogidaSII4','AEATSII_AcogidaSII',
  'AEATSII_InSIIAndPostedInvoices','AEATSII_PreSII_Invoice',
  'TBAI_isReturn','ETVFAC_VoidInvoice','etvfac_has_configuration',
  'isCashVAT','isCancelled','isDelivered','isPrinted','isInvoiced',
  'currency','accountingDate',
])

const DERIVED_FROM_BP = new Set([
  'partnerAddress','invoiceAddress','priceList','paymentTerms','paymentMethod',
])

const DERIVED_FROM_PRODUCT = new Set([
  'unitPrice','listPrice','standardPrice','tax','uOM','operativeUOM',
  'lineNetAmount','taxableAmount','operativeQuantity','grossUnitPrice','lineGrossAmount',
  'priceLimit','grossListPrice','baseGrossUnitPrice','grossAmount',
])

const COMPUTED = new Set([
  'lineNo','documentNo','grandTotal','totalLines','_new','lineGrossAmount',
  'discount','taxableAmount','lineNetAmount','grandTotalAmount','summedLineAmount',
  'totalPaid','outstandingAmount','dueAmount','daysTillDue','prepaymentamt',
  'paidAmountAtInvoicing',
])

// Fields that look like user input but are system/module metadata
const SYSTEM_FIELDS = new Set([
  'VoidAutomaticallyCreated','TBAI_ExistTBAIConfig','TBAI_VoidedInvoiceSended',
  'TBAI_ExistConfigAndIsAvailable','_selection_278','HASSECONDUOM','C_BPARTNER_ID',
  'UsesAlternate','Parent_AD_Org','isBOM','IsStocked','Processed','Posted',
  'GROSSPRICE','actionAfterFicReturn','PRODUCTTYPE','ATTRIBUTESETINSTANCIABLE',
  'ISLINKEDTOPRODUCT','LINKEDTOPRODUCT','isQuantityVariable','id',
])

const NOISE_BOOL_PREFIXES = [
  '$Element','AEATSII','EQUOT_','etsgDate','aeatsiiFecha','tbaiIssue',
]

function classifyField(key, value) {
  if (value === null || value === '' || value === false) return 'empty'
  if (FIXED.has(key)) return 'fixed'
  if (SYSTEM_FIELDS.has(key)) return 'noise'
  if (DERIVED_FROM_BP.has(key)) return 'derived_bp'
  if (DERIVED_FROM_PRODUCT.has(key)) return 'derived_product'
  if (COMPUTED.has(key)) return 'computed'
  if (NOISE_BOOL_PREFIXES.some(p => key.startsWith(p))) return 'noise'
  // Fields that reference parent entities are parent refs, not user input
  if (['salesOrder','purchaseOrder','invoice','order'].includes(key)) return 'parent_ref'
  return 'user_input'
}

// TRUE user inputs — what a human actually types or selects
const TRUE_USER_INPUTS = new Set([
  'businessPartner',  // customer or vendor — user searches and selects
  'invoiceDate',      // date picker, defaults to today
  'orderDate',        // date picker, defaults to today
  'scheduledDeliveryDate', // date picker
  'transactionDocument',   // doc type selector (dropdown from setup)
  'product',          // product search per line
  'invoicedQuantity', // quantity per line
  'orderedQuantity',  // quantity per line
  'description',      // optional free text
])

// ─── URL helpers ─────────────────────────────────────────────────────────────

function parseEtendoUrl(url) {
  const u = new URL(url, 'http://x')
  const qs = Object.fromEntries(u.searchParams)
  const pathParts = u.pathname.split('/')
  const entity = pathParts[pathParts.length - 1]
  return { qs, entity, path: u.pathname }
}

// ─── Essential call detection ─────────────────────────────────────────────────

function isEssential(call) {
  const { url, request_payload: rp } = call
  if (!rp || typeof rp !== 'object') return false

  // datasource write
  const op = rp.operationType
  if (op === 'add') return true
  if (op === 'update' && rp.data?._new === true) return true

  // FormInit EDIT with a real docaction
  if (url.includes('FormInitializationComponent')) {
    const { qs } = parseEtendoUrl(url)
    const docaction = rp.inpdocaction
    if (qs.MODE === 'EDIT' && docaction && docaction !== '--' && docaction !== '') {
      return true
    }
  }

  return false
}

// ─── Extract essential call metadata ─────────────────────────────────────────

function extractCall(call) {
  const { url, request_payload: rp, response_body: rb, seq } = call
  const { qs, entity } = parseEtendoUrl(url)
  const op = rp.operationType

  // ── FormInit EDIT (complete/process action)
  if (url.includes('FormInitializationComponent')) {
    const docaction = rp.inpdocaction
    const tabId = qs.TAB_ID
    const rowId = qs.ROW_ID

    // Collect all inp* fields that are needed for the complete call
    const inpFields = {}
    for (const [k, v] of Object.entries(rp)) {
      if (k.startsWith('inp') && v !== null && v !== '' && v !== false) {
        inpFields[k] = v
      }
    }

    return {
      seq,
      type: 'process',
      action: `docaction_${docaction}`,
      tabId,
      rowIdParam: rowId,  // contains actual ID or template placeholder
      docaction,
      inpFields,
      entityRef: rp.inpcOrderId ? 'order' : rp.inpcInvoiceId ? 'invoice' : 'unknown',
    }
  }

  // ── Datasource write
  const data = rp.data || {}
  const respData = rb?.response?.data
  const respItem = Array.isArray(respData) ? respData[0] : respData
  const responseId = respItem?.id || null
  const responseDocStatus = respItem?.documentStatus || null

  const userInput = {}
  const derivedBP = {}
  const derivedProduct = {}
  const fixed = {}
  const computed = {}

  for (const [k, v] of Object.entries(data)) {
    const cls = classifyField(k, v)
    switch (cls) {
      case 'user_input': userInput[k] = v; break
      case 'derived_bp': derivedBP[k] = v; break
      case 'derived_product': derivedProduct[k] = v; break
      case 'fixed': fixed[k] = v; break
      case 'computed': computed[k] = v; break
    }
  }

  // Identify parent reference
  const parentRef =
    data.salesOrder ? { field: 'salesOrder', value: data.salesOrder } :
    data.purchaseOrder ? { field: 'purchaseOrder', value: data.purchaseOrder } :
    data.invoice ? { field: 'invoice', value: data.invoice } :
    null

  return {
    seq,
    type: 'write',
    entity,
    operationType: op,
    isNewLine: data._new === true,
    parentRef,
    userInput,
    derivedBP: Object.keys(derivedBP),
    derivedProduct: Object.keys(derivedProduct),
    fixed: Object.keys(fixed),
    computed: Object.keys(computed),
    responseId,
    responseDocStatus,
    rawData: data,
  }
}

// ─── Main analyzer ────────────────────────────────────────────────────────────

export function analyze(session) {
  const essential = session.calls
    .filter(isEssential)
    .map(extractCall)

  // Detect search calls (read-only, no writes)
  const searchCalls = session.calls.filter(c => {
    const { path } = parseEtendoUrl(c.url)
    return (
      path.includes('BusinessPartner') ||
      path.includes('ProductByPriceAndWarehouse') ||
      path.includes('BPForOrder')
    ) && !isEssential(c)
  })

  // Classify overall operation
  const hasHeader = essential.some(c => c.type === 'write' && ['Order','Invoice'].includes(c.entity))
  const hasLines  = essential.some(c => c.type === 'write' && ['OrderLine','InvoiceLine'].includes(c.entity))
  const hasComplete = essential.some(c => c.type === 'process')
  const isSearch = essential.length === 0 && searchCalls.length > 0

  // Extract window constants from process calls
  const processCall = essential.find(c => c.type === 'process')
  const headerCall  = essential.find(c => c.type === 'write' && ['Order','Invoice'].includes(c.entity))
  const lineCall    = essential.find(c => c.type === 'write' && ['OrderLine','InvoiceLine'].includes(c.entity))

  const isSales    = headerCall?.rawData?.salesTransaction === true ||
                     processCall?.inpFields?.inpissotrx === 'Y'
  const isPurchase = !isSales && (headerCall || processCall)
  const docbaseType= headerCall?.rawData?.DOCBASETYPE || processCall?.inpFields?.DOCBASETYPE

  return {
    operation: session.operation,
    phase: session.phase,
    etendo_version: session.etendo_version,
    total_calls: session.calls.length,
    essential_count: essential.length,

    kind: isSearch ? 'search'
        : hasHeader && hasLines && hasComplete ? 'create_and_complete'
        : hasHeader && hasLines ? 'create'
        : hasComplete ? 'complete'
        : 'unknown',

    direction: isSales ? 'sales' : isPurchase ? 'purchase' : 'unknown',
    docbaseType,

    // Minimal user inputs (union across all write calls)
    userInputFields: [
      ...new Set(essential.flatMap(c => c.type === 'write' ? Object.keys(c.userInput) : []))
    ],

    // Per-step detail
    steps: essential,

    // Search patterns captured
    searchCalls: searchCalls.map(c => {
      const rb = c.response_body
      const sample = rb?.response?.data?.[0] || {}
      return {
        datasource: parseEtendoUrl(c.url).entity,
        sampleFields: Object.keys(sample).slice(0, 12),
        sampleItem: sample,
      }
    }),

    // Window/tab constants (from process call)
    windowConstants: processCall ? {
      tabId:    processCall.tabId,
      windowId: processCall.inpFields?.inpwindowId,
      tableId:  processCall.inpFields?.inpTableId,
      docbasetype: docbaseType,
    } : null,
  }
}
