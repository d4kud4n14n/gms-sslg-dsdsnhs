import fs from 'node:fs'
import path from 'node:path'

export const VALID_DOMAINS = [
  'authentication',
  'authorization',
  'identity-integrity',
  'privilege-boundaries',
  'state-transitions',
  'input-validation',
  'audit-trail',
  'failure-behavior',
]

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']

const readText = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

const toPosix = (value) => String(value ?? '').replace(/\\/g, '/')

const redact = (input) => String(input ?? '')
  .replace(/(sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}/gi, (match) => `${match.slice(0, 4)}…${match.slice(-2)}`)
  .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gi, (match) => `${match.slice(0, 4)}…${match.slice(-2)}`)
  .replace(/(SUPABASE_SERVICE_ROLE_KEY\s*=\s*)[A-Za-z0-9._-]{20,}/gi, '$1[REDACTED]')

const lineOf = (text, predicate) => {
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    if (predicate(lines[i])) return i + 1
  }
  return 1
}

const makeFinding = (ruleId, severity, domain, file, line, message, evidence) => ({
  ruleId,
  severity,
  domain,
  file: toPosix(file),
  line: Number(line) || 1,
  message,
  evidence: redact(String(evidence ?? '').trim()),
  allowlisted: false,
})

export const rules = [
  {
    id: 'C1',
    severity: 'critical',
    domain: 'privilege-boundaries',
    description: 'Service-role usage in client code.',
    check: (ctx) => {
      const findings = []
      for (const file of ctx.files.srcFiles || []) {
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text || !/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(text)) continue
        findings.push(
          makeFinding(
            'C1',
            'critical',
            'privilege-boundaries',
            file,
            lineOf(text, (row) => /SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(row)),
            'Service-role key material is referenced from client code.',
            text,
          ),
        )
      }
      return findings
    },
  },
  {
    id: 'C2',
    severity: 'critical',
    domain: 'privilege-boundaries',
    description: 'Admin API calls in client code.',
    check: (ctx) => {
      const findings = []
      for (const file of ctx.files.srcFiles || []) {
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text || !/auth\.admin\./i.test(text)) continue
        findings.push(
          makeFinding(
            'C2',
            'critical',
            'privilege-boundaries',
            file,
            lineOf(text, (row) => /auth\.admin\./i.test(row)),
            'Client code calls privileged admin APIs.',
            text,
          ),
        )
      }
      return findings
    },
  },
  {
    id: 'C3',
    severity: 'critical',
    domain: 'authorization',
    description: 'Database tables created without row-level security.',
    check: (ctx) => {
      const findings = []
      for (const file of ctx.files.sqlFiles || []) {
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text) continue
        const identifier = '(?:"[^"]+"|`[^`]+`|[_A-Za-z0-9]+)'
        const relation = `${identifier}(?:\\s*\\.\\s*${identifier})?`
        const normalize = (value) => value.split('.').map((part) => part.trim().replace(/^["`]|["`]$/g, '').toLowerCase()).join('.')
        const tables = [...text.matchAll(new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${relation})`, 'gi'))].map((match) => normalize(match[1]))
        const policies = new Set([...text.matchAll(new RegExp(`CREATE\\s+POLICY\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${identifier}\\s+ON\\s+(${relation})`, 'gi'))].map((match) => normalize(match[1])))
        const rlsProtected = new Set([...text.matchAll(new RegExp(`ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(${relation})\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'gi'))].map((match) => normalize(match[1])))

        for (const table of tables) {
          if (!rlsProtected.has(table) || !policies.has(table)) {
            findings.push(
              makeFinding(
                'C3',
                'critical',
                'authorization',
                file,
                1,
                `Table \`${table}\` is not fully covered by row-level security controls.`,
                `CREATE TABLE ${table}`,
              ),
            )
          }
        }
      }
      return findings
    },
  },
  {
    id: 'C4',
    severity: 'critical',
    domain: 'input-validation',
    description: 'Request body is parsed without validation.',
    check: (ctx) => {
      const findings = []
      for (const file of ctx.files.functionFiles || []) {
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text) continue
        if (!/\.json\s*\(|await\s+.*\.json\s*\(/i.test(text)) continue
        const safePattern = /zod|safeParse|parse\s*\(|schema\./i
        if (safePattern.test(text)) continue
        findings.push(
          makeFinding(
            'C4',
            'critical',
            'input-validation',
            file,
            lineOf(text, (row) => /\.json\s*\(|await\s+.*\.json\s*\(/i.test(row)),
            'Request payloads are parsed with no schema validation before use.',
            'Unvalidated JSON body parse',
          ),
        )
      }
      return findings
    },
  },
  {
    id: 'C5',
    severity: 'critical',
    domain: 'authentication',
    description: 'Route guard is missing.',
    check: (ctx) => {
      const appFiles = (ctx.files.srcFiles || []).filter((file) => /(^|\/)src\/App\.[jt]sx?$/.test(file))
      const findings = []
      for (const appFile of appFiles) {
        const text = readText(path.join(ctx.repoRoot, appFile))
        if (!text) continue
        const routeMatches = [...text.matchAll(/<Route\s+([^>]+)>/gi)]
        const allow = new Set(['/login', '/forgot-password', '/reset-password', '/sysver', '/'])

        for (const match of routeMatches) {
          const attrs = match[1] || ''
          const routeMatch = attrs.match(/path\s*=\s*["']([^"']+)["']/i)
          if (!routeMatch) continue
          const route = routeMatch[1]
          if (allow.has(route)) continue

          const protectedBySession = /requireActive|RequireAuth|ProtectedRoute|SessionCheck|RequireSession|renderSetup/i.test(attrs) || /requireActive|RequireAuth|ProtectedRoute|SessionCheck|RequireSession|renderSetup/i.test(text)
          if (!protectedBySession) {
            findings.push(
              makeFinding('C5', 'critical', 'authentication', appFile, lineOf(text, (row) => row.includes(route)), `Route \`${route}\` is not protected by auth/session gating.`, `path="${route}"`),
            )
          }
        }
      }
      return findings
    },
  },
  {
    id: 'C6',
    severity: 'critical',
    domain: 'failure-behavior',
    description: 'Catch blocks fail open.',
    check: (ctx) => {
      const findings = []
      for (const file of [...(ctx.files.srcFiles || []), ...(ctx.files.functionFiles || [])]) {
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text) continue
        const matches = text.matchAll(/catch\s*\([^)]*\)\s*\{([\s\S]*?)\}/gi)
        for (const match of matches) {
          const block = match[1] || ''
          const returnMatch = block.match(/return\s+([^;]+);?/i) || block.match(/return\s+([^\n]+)$/i)
          if (!returnMatch) continue
          const candidate = returnMatch[1].trim()
          if (/^true\b|^allow\b|\{\s*allowed\s*:\s*true\s*\}|\{\s*authorized\s*:\s*true\s*\}/i.test(candidate) || /session|auth|user/i.test(candidate)) {
            findings.push(
              makeFinding('C6', 'critical', 'failure-behavior', file, 1, 'Catch block contains an access-granting fallback instead of rejecting the request.', candidate),
            )
          }
        }
      }
      return findings
    },
  },
  {
    id: 'H1',
    severity: 'high',
    domain: 'identity-integrity',
    description: 'Unsafe foreign keys on identity tables.',
    check: (ctx) => {
      const findings = []
      for (const file of ctx.files.sqlFiles || []) {
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text) continue
        const createBlocks = [...text.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["`]?[_A-Za-z0-9]+["`]?)[\s\S]*?\(([^]*?)\)/gi)]
        for (const block of createBlocks) {
          const table = block[1].replace(/^['"`]|['"`]$/g, '')
          if (!/(user|member|officer|profile|actor|author|owner)/i.test(table)) continue
          const body = block[2] || ''
          const refs = [...body.matchAll(/REFERENCES\s+(["`]?[_A-Za-z0-9.]+["`]?)(?:\s*\(([^)]*)\))?/gi)]
          for (const ref of refs) {
            const refTable = ref[1].replace(/^['"`]|['"`]$/g, '').replace(/^public\./, '')
            if (!/^(profiles|auth\.users)$/i.test(refTable)) {
              findings.push(makeFinding('H1', 'high', 'identity-integrity', file, 1, `Table \`${table}\` references non-user foreign key \`${refTable}\``, ref[0]))
            }
          }
        }
      }
      return findings
    },
  },
  {
    id: 'H2',
    severity: 'high',
    domain: 'authorization',
    description: 'Row-level security was disabled or removed.',
    check: (ctx) => {
      const findings = []
      for (const file of ctx.files.sqlFiles || []) {
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text) continue
        const tables = new Set([
          ...[...text.matchAll(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(?:["`]?[_A-Za-z0-9]+["`]?\s+ON\s+)?(["`]?[_A-Za-z0-9]+["`]?)/gi)].map((match) => match[1].replace(/^['"`]|['"`]$/g, '')),
          ...[...text.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(["`]?[_A-Za-z0-9]+["`]?)[\s\S]*?DISABLE\s+ROW\s+LEVEL\s+SECURITY/gi)].map((match) => match[1].replace(/^['"`]|['"`]$/g, '')),
        ])

        for (const table of tables) {
          const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const replacement = new RegExp("CREATE\\s+POLICY.*(?:ON\\s+)?[\"'`]?" + escapedTable + "[\"'`]?", 'i').test(text)
          const enabled = new RegExp("ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?[\"'`]?" + escapedTable + "[\"'`]?\\s+ENABLE\\s+ROW\\s+SECURITY", 'i').test(text)
          if (!replacement && !enabled) {
            findings.push(makeFinding('H2', 'high', 'authorization', file, 1, `RLS was disabled or removed for \`${table}\` without replacement.`, `DROP or disable policy on ${table}`))
          }
        }
      }
      return findings
    },
  },
  {
    id: 'H3',
    severity: 'high',
    domain: 'privilege-boundaries',
    description: 'Committed secret or privileged key material.',
    check: (ctx) => {
      const findings = []
      for (const file of ctx.files.allFiles || []) {
        if (file.includes('/.gms-guard/') || file.includes('/node_modules/') || file.includes('/dist/') || file.includes('/.git/')) continue
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text || file.endsWith('.env.example')) continue
        const secretPattern = /(sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=\s*[A-Za-z0-9._-]{20,}/i
        if (!secretPattern.test(text)) continue
        findings.push(
          makeFinding(
            'H3',
            'high',
            'privilege-boundaries',
            file,
            lineOf(text, (row) => secretPattern.test(row)),
            'Secret material or token-like credentials are stored in a tracked file.',
            text.slice(0, 220),
          ),
        )
      }
      return findings
    },
  },
  {
    id: 'H4',
    severity: 'high',
    domain: 'audit-trail',
    description: 'Database mutations are not paired with audit records.',
    check: (ctx) => {
      const findings = []
      for (const file of ctx.files.sqlFiles || []) {
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text) continue
        if (!/(INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM)/i.test(text)) continue
        if (/INSERT\s+INTO\s+.*audit/i.test(text)) continue
        findings.push(makeFinding('H4', 'high', 'audit-trail', file, 1, 'The migration includes database mutation without corresponding audit logging.', 'database mutation without audit trail'))
      }
      return findings
    },
  },
  {
    id: 'M1',
    severity: 'medium',
    domain: 'authorization',
    description: 'Route metadata and source have drifted.',
    check: (ctx) => {
      const indexFile = path.join(ctx.repoRoot, '.gms-index', 'index.json')
      if (!fs.existsSync(indexFile)) return []
      const appFiles = (ctx.files.srcFiles || []).filter((file) => /(^|\/)src\/App\.[jt]sx?$/.test(file))
      const findings = []
      for (const appFile of appFiles) {
        const text = readText(path.join(ctx.repoRoot, appFile))
        if (!text) continue
        try {
          const index = JSON.parse(readText(indexFile))
          const appPaths = [...text.matchAll(/path\s*=\s*["']([^"']+)["']/g)].map((match) => match[1])
          const indexPaths = Array.isArray(index?.routes) ? index.routes.filter((value) => value && typeof value.path === 'string').map((value) => value.path) : []
          const drift = [...new Set([...indexPaths, ...appPaths])].filter((route) => !(indexPaths.includes(route) && appPaths.includes(route)))
          if (drift.length) {
            findings.push(makeFinding('M1', 'medium', 'authorization', appFile, 1, 'Source route declarations and index metadata are out of sync.', drift.join(', ')))
          }
        } catch {
          // ignore malformed index metadata
        }
      }
      return findings
    },
  },
  {
    id: 'M2',
    severity: 'medium',
    domain: 'failure-behavior',
    description: 'Relative import does not resolve.',
    check: (ctx) => {
      const findings = []
      for (const file of [...(ctx.files.tsFiles || []), ...(ctx.files.jsFiles || [])]) {
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text) continue
        const importMatches = [...text.matchAll(/(?:import|export)\s+[^;]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g)]
        for (const match of importMatches) {
          const specifier = match[1] || match[2]
          if (!specifier || !specifier.startsWith('.')) continue
          const base = path.resolve(path.dirname(path.join(ctx.repoRoot, file)), specifier)
          const candidates = [
            base,
            `${base}.ts`,
            `${base}.tsx`,
            `${base}.js`,
            `${base}.jsx`,
            path.join(base, 'index.ts'),
            path.join(base, 'index.tsx'),
            path.join(base, 'index.js'),
            path.join(base, 'index.jsx'),
          ]
          if (!candidates.some((candidate) => fs.existsSync(candidate))) {
            findings.push(makeFinding('M2', 'medium', 'failure-behavior', file, lineOf(text, (row) => row.includes(specifier)), `Relative import \`${specifier}\` does not resolve.`, specifier))
          }
        }
      }
      return findings
    },
  },
  {
    id: 'M3',
    severity: 'medium',
    domain: 'privilege-boundaries',
    description: 'Sensitive values are logged to the console.',
    check: (ctx) => {
      const findings = []
      for (const file of [...(ctx.files.srcFiles || []), ...(ctx.files.functionFiles || [])]) {
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text) continue
        const lines = text.split(/\r?\n/)
        for (let i = 0; i < lines.length; i += 1) {
          const row = lines[i]
          if (/console\.(log|warn|error)\s*\(/i.test(row) && /(password|token|secret|key|uKey|imail|umail)/i.test(row)) {
            findings.push(makeFinding('M3', 'medium', 'privilege-boundaries', file, i + 1, 'Sensitive value appears in console output.', row.trim()))
          }
        }
      }
      return findings
    },
  },
  {
    id: 'M4',
    severity: 'medium',
    domain: 'privilege-boundaries',
    description: 'Unsafe localStorage key detected.',
    check: (ctx) => {
      const allow = new Set(['sb-session', 'gms-theme'])
      const findings = []
      for (const file of [...(ctx.files.srcFiles || []), ...(ctx.files.functionFiles || [])]) {
        const text = readText(path.join(ctx.repoRoot, file))
        if (!text) continue
        for (const match of text.matchAll(/localStorage\.setItem\s*\(\s*(["'`])([^"'`]+)\1\s*,/g)) {
          const key = match[2]
          if (!allow.has(key)) {
            findings.push(makeFinding('M4', 'medium', 'privilege-boundaries', file, lineOf(text, (row) => row.includes('localStorage.setItem') && row.includes(key)), `localStorage key \`${key}\` is not on the allowlist.`, `localStorage.setItem(${key})`))
          }
        }
      }
      return findings
    },
  },
  {
    id: 'M5',
    severity: 'medium',
    domain: 'authorization',
    description: 'Expired allowlist entry is ignored.',
    check: (ctx) => {
      const findings = []
      for (const entry of ctx.allowlist.entries || []) {
        if (!entry.expires) continue
        const expiresAt = new Date(entry.expires)
        if (!Number.isNaN(expiresAt.getTime()) && expiresAt < new Date()) {
          findings.push(makeFinding('M5', 'medium', 'authorization', entry.file || '.gms-guard/ALLOWLIST.md', entry.line || 1, 'Allowlist entry has expired and is being ignored.', `expires=${entry.expires}`))
        }
      }
      return findings
    },
  },
]

export default rules
