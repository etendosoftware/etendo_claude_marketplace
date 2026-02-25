#!/usr/bin/env node
/**
 * Etendo Lite Pipeline — CLI + Watcher
 *
 * Usage:
 *   # Process a single session file
 *   node index.js path/to/session.json
 *
 *   # Watch a directory for new session files (auto-process on drop)
 *   node index.js --watch ../
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import chokidar from 'chokidar'
import { analyze } from './analyzer.js'
import { generate } from './generator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.resolve(__dirname, '../generated')

// ─── Output ───────────────────────────────────────────────────────────────────

function saveOutputs(operationName, { component, spec }) {
  const dir = path.join(OUTPUT_DIR, operationName)
  fs.mkdirSync(dir, { recursive: true })

  // React component
  if (component) {
    const componentName = operationName
      .split('_')
      .map(w => w[0].toUpperCase() + w.slice(1))
      .join('')
    const file = path.join(dir, `${componentName}.tsx`)
    fs.writeFileSync(file, component, 'utf8')
    console.log(`  ✓ Component  → ${path.relative(process.cwd(), file)}`)
  }

  // Orchestration spec
  if (spec && !spec.error) {
    const file = path.join(dir, `${operationName}.spec.json`)
    fs.writeFileSync(file, JSON.stringify(spec, null, 2), 'utf8')
    console.log(`  ✓ Spec       → ${path.relative(process.cwd(), file)}`)
  }

  // Analysis dump (for debugging)
  const analysisFile = path.join(dir, `${operationName}.analysis.json`)
  console.log(`  ✓ Analysis   → ${path.relative(process.cwd(), analysisFile)}`)

  return dir
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

async function processSession(filePath) {
  const absPath = path.resolve(filePath)
  const filename = path.basename(absPath)

  console.log(`\n${'─'.repeat(55)}`)
  console.log(`Processing: ${filename}`)
  console.log('─'.repeat(55))

  // Load session
  let session
  try {
    const raw = fs.readFileSync(absPath, 'utf8')
    session = JSON.parse(raw)
  } catch (e) {
    console.error(`  ✗ Failed to read/parse: ${e.message}`)
    return
  }

  // Analyze
  console.log('  → Analyzing session…')
  const analysis = analyze(session)

  console.log(`  ✓ operation:  ${analysis.operation}`)
  console.log(`  ✓ kind:       ${analysis.kind}`)
  console.log(`  ✓ direction:  ${analysis.direction}`)
  console.log(`  ✓ essential:  ${analysis.essential_count} / ${analysis.total_calls} calls`)
  console.log(`  ✓ user input: [${analysis.userInputFields.join(', ')}]`)

  // Save analysis
  const dir = path.join(OUTPUT_DIR, analysis.operation)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, `${analysis.operation}.analysis.json`),
    JSON.stringify(analysis, null, 2)
  )

  if (analysis.kind === 'unknown' || analysis.essential_count === 0) {
    console.log('  ⚠ No essential calls found — skipping generation.')
    console.log('    Tip: check if the recording captured any write operations.')
    return
  }

  // Generate
  console.log('  → Generating component + spec…')
  let outputs
  try {
    outputs = await generate(analysis)
  } catch (e) {
    console.error(`  ✗ Generation failed: ${e.message}`)
    return
  }

  saveOutputs(analysis.operation, outputs)
  console.log(`\n  ✅ Done → generated/${analysis.operation}/\n`)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

if (args.includes('--watch')) {
  const watchDir = path.resolve(args[args.indexOf('--watch') + 1] || '../')
  console.log(`\n👁  Watching ${watchDir} for *.session.json files…`)
  console.log('    Drop a session file to generate the UI automatically.\n')

  const watcher = chokidar.watch(path.join(watchDir, '**/*.session.json'), {
    ignoreInitial: true,
    persistent: true,
  })

  watcher.on('add', async (filePath) => {
    console.log(`\n📥  New session detected: ${path.basename(filePath)}`)
    await processSession(filePath)
  })

  watcher.on('change', async (filePath) => {
    console.log(`\n🔄  Session updated: ${path.basename(filePath)}`)
    await processSession(filePath)
  })

} else if (args[0]) {
  // Single file mode
  processSession(args[0]).catch(e => {
    console.error('Fatal:', e)
    process.exit(1)
  })

} else {
  console.log(`
Etendo Lite Pipeline

Usage:
  node index.js <session.json>        Process a single session file
  node index.js --watch <dir>         Watch dir for new session files

Examples:
  node index.js ../create_sales_invoice.session.json
  node index.js --watch ..
  `)
  process.exit(0)
}
