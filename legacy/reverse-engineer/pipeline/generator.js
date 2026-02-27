/**
 * generator.js
 * Takes an analysis object and calls Claude to generate:
 *  1. React component (simplified form/wizard)
 *  2. Orchestration spec (JSON sequence of Etendo calls)
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildPrompt(analysis) {
  return `You are generating code for Etendo Lite, a simplified ERP interface.

## Context

Etendo Lite sits in front of Etendo ERP (Openbravo-based Java backend).
The Orchestration Layer calls Etendo's real API internally.
The UI only shows what the user actually needs to provide.

## Analysis of recorded Etendo session

\`\`\`json
${JSON.stringify(analysis, null, 2)}
\`\`\`

## What you must generate

Generate TWO artifacts:

---

### ARTIFACT 1: React component

A single React TypeScript component for this operation.

Rules:
- Use only React + TypeScript. No external UI libraries.
- Inline CSS via style objects (no CSS files, no Tailwind, no className strings).
- The component must be fully self-contained and functional.
- Show only fields the user must actually provide (from userInputFields + parent entity search).
- All other fields (derived, fixed, computed) are handled by the orchestration layer — do NOT show them.
- For entity references (businessPartner, vendor, customer): render a search-as-you-type input
  that calls GET /lite/masters/{entity}/search?q={text} and shows a dropdown.
- For product lines: render an inline table with search + quantity columns. Add/remove rows.
- For dates: default to today.
- Show a loading state while submitting.
- Show a success state with the document number after completion.
- The component calls the orchestration layer (not Etendo directly).
  Use a prop \`apiBase\` (default: '/lite') for the base URL.
- Use \`X-Tenant-ID\` header (from a prop \`tenantId\`) on all API calls.
- Use Basic Auth (props: \`username\`, \`password\`) on all API calls.

API endpoint to call on submit (derive from the analysis):
- sales + create_and_complete → POST /lite/sales/quick
- purchase + create_and_complete → POST /lite/purchases/quick
- sales + create → POST /lite/sales/orders or /lite/sales/invoices
- purchase + create → POST /lite/purchases/orders or /lite/purchases/invoices
- complete → POST /lite/{direction}/{entity}/:id/complete

Request body shape (minimal — orchestration layer handles everything else):
- For orders/invoices: { customerId/vendorId, date, lines: [{productId, quantity}] }
- For complete: { id }

---

### ARTIFACT 2: Orchestration spec

A JSON spec that the orchestration layer runner will execute step by step.

Rules:
- Include ONLY the essential calls (no UI noise, no reads except lookups).
- Use \`{{templateVar}}\` syntax for dynamic values.
- Use \`capture\` to extract values from responses for use in subsequent steps.
- Lookup steps (GET) come before write steps that depend on them.
- Include the complete (FormInit EDIT) step if present in the analysis.

Shape:
\`\`\`json
{
  "operation": "...",
  "direction": "sales|purchase",
  "version": "26Q1",
  "steps": [
    {
      "seq": 1,
      "description": "human readable",
      "type": "lookup|write|process",
      "method": "GET|POST",
      "endpoint": "/etendo/...",
      "queryParams": {},
      "payload": {},
      "capture": { "varName": "response.path.to.value" },
      "repeat": "per_line"
    }
  ]
}
\`\`\`

---

## Output format

Respond with EXACTLY this structure (no extra prose):

<COMPONENT>
[full React TypeScript component code]
</COMPONENT>

<SPEC>
[full JSON orchestration spec]
</SPEC>`
}

// ─── Parse Claude output ──────────────────────────────────────────────────────

function parseOutput(text) {
  const componentMatch = text.match(/<COMPONENT>([\s\S]*?)<\/COMPONENT>/)
  const specMatch      = text.match(/<SPEC>([\s\S]*?)<\/SPEC>/)

  const component = componentMatch?.[1]?.trim() || null

  let spec = null
  if (specMatch) {
    try {
      // strip markdown code fences if present
      const raw = specMatch[1].replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      spec = JSON.parse(raw)
    } catch (e) {
      spec = { error: 'Failed to parse spec JSON', raw: specMatch[1] }
    }
  }

  return { component, spec }
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generate(analysis) {
  const prompt = buildPrompt(analysis)

  console.log(`  → Calling Claude (${analysis.operation})…`)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return parseOutput(text)
}
