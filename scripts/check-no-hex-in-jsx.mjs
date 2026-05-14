import { readFile } from 'node:fs/promises'
import { globby } from 'globby'
import { fileURLToPath } from 'node:url'

/**
 * Find hex literals in JSX className arbitrary values OR inline style objects.
 * Returns array of { file, line, literal, context }.
 * Honours `// no-hex-disable-next-line` directive on the preceding line.
 *
 * Skips non-.ts/.tsx files (e.g., .css, .scss, .config.*).
 */
export function findHexInJsxSource(src, file) {
  if (!/\.tsx?$/.test(file)) return []
  const hits = []
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const prev = i > 0 ? lines[i - 1] : ''
    if (/no-hex-disable-next-line/.test(prev)) continue
    // Tailwind arbitrary value: bg-[#xxx], text-[#xxx], border-[#xxx], etc.
    const tailwindArb = line.match(/[\w-]+-\[#[0-9a-fA-F]{3,8}\]/g)
    if (tailwindArb) {
      for (const m of tailwindArb) {
        const literal = m.match(/#[0-9a-fA-F]{3,8}/)?.[0]
        if (literal) hits.push({ file, line: i + 1, literal, context: line.trim() })
      }
    }
    // Inline style object hex string
    const styleHex = line.match(/['"]#[0-9a-fA-F]{3,8}['"]/g)
    if (styleHex) {
      for (const m of styleHex) {
        const literal = m.replace(/['"]/g, '')
        hits.push({ file, line: i + 1, literal, context: line.trim() })
      }
    }
  }
  return hits
}

async function main() {
  // Walk production source only; test files are token-definition surfaces
  // (they assert palette hex values verbatim) and are out of scope, matching
  // the pre-flight enumeration grep (which excluded __tests__).
  const files = await globby(['src/**/*.{ts,tsx}', '!src/**/__tests__/**'])
  const allHits = []
  for (const f of files) {
    const src = await readFile(f, 'utf-8')
    allHits.push(...findHexInJsxSource(src, f))
  }
  if (allHits.length > 0) {
    console.error('Hex-literal guardrail: violations found.')
    for (const h of allHits) console.error(`  ${h.file}:${h.line}  ${h.literal}  ${h.context}`)
    console.error(`\nUse palette tokens (var(--token-name)) or whitelist with`)
    console.error(`// no-hex-disable-next-line on the preceding line.`)
    process.exit(1)
  }
  console.log('Hex-literal guardrail: clean.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(2) })
}
