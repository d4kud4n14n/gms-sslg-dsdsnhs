#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import rules, { VALID_DOMAINS, SEVERITY_ORDER } from './gms-guard.rules.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const guardDir = path.join(repoRoot, '.gms-guard')
const args = new Set(process.argv.slice(2))
const isCi = args.has('--ci')
const ignoredDirectories = new Set(['.git', '.gms-guard', '.gms-index', 'node_modules', 'dist', 'dist-ssr'])

const readText = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

const writeText = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, String(content), 'utf8')
}

const walk = (dir, acc = []) => {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) {
      continue
    }

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, acc)
    } else {
      acc.push(fullPath)
    }
  }
  return acc
}

const toPosix = (value) => String(value ?? '').replace(/\\/g, '/')

const listFiles = () =>
  {
    try {
      return [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: repoRoot, encoding: 'utf8' })
        .split('\0')
        .filter(Boolean))]
        .filter((file) => !file.split(/[\\/]/).some((part) => ignoredDirectories.has(part)))
        .map(toPosix)
        .sort()
    } catch {
      return walk(repoRoot)
        .filter((file) => !/^\.env(?:\.|$)/.test(path.basename(file)) || path.basename(file) === '.env.example')
        .map((file) => toPosix(path.relative(repoRoot, file)))
        .sort()
    }
  }

const parseAllowlist = () => {
  const allowlistPath = path.join(guardDir, 'ALLOWLIST.md')
  if (!fs.existsSync(allowlistPath)) return []

  const entries = []
  for (const [index, line] of readText(allowlistPath).split(/\r?\n/).entries()) {
    const text = line.trim()
    if (!text || text.startsWith('#')) continue
    const match = text.match(/^(C\d+|H\d+|M\d+)\s*(?:\|\s*)?([^\s|]+)?(?:\s*:\s*(\d+))?(?:\s+expires\s*[:=]\s*(\S+))?/i)
    if (!match) continue
    entries.push({
      ruleId: match[1].toUpperCase(),
      file: match[2] ? match[2].replace(/^\.?\//, '') : '.gms-guard/ALLOWLIST.md',
      line: Number(match[3]) || 1,
      expires: match[4] || '',
      sourceLine: index + 1,
    })
  }
  return entries
}

const normalizeFile = (file) => file.replace(/^\.\//, '')

const isExpired = (value) => {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date < new Date()
}

const lowerSeverity = (severity) => {
  const idx = SEVERITY_ORDER.indexOf(severity)
  if (idx === -1 || idx === SEVERITY_ORDER.length - 1) return severity
  return SEVERITY_ORDER[idx + 1]
}

const applyAllowlist = (findings, entries) =>
  findings.map((finding) => {
    const entry = entries.find((candidate) => {
      const sameRule = candidate.ruleId.toUpperCase() === finding.ruleId.toUpperCase()
      const sameFile = !candidate.file || candidate.file === finding.file || candidate.file === `./${finding.file}` || candidate.file === `/${finding.file}`
      const sameLine = !candidate.line || Number(candidate.line) === Number(finding.line)
      return sameRule && sameFile && sameLine
    })

    if (!entry || isExpired(entry.expires)) return finding

    const next = { ...finding, allowlisted: true }
    if (next.severity !== 'low') {
      next.severity = lowerSeverity(next.severity)
    }
    return next
  })

const sortFindings = (findings) =>
  [...findings].sort((a, b) => {
    const severityDiff = (SEVERITY_ORDER.indexOf(a.severity) ?? 99) - (SEVERITY_ORDER.indexOf(b.severity) ?? 99)
    if (severityDiff !== 0) return severityDiff
    const fileDiff = (a.file || '').localeCompare(b.file || '')
    if (fileDiff !== 0) return fileDiff
    return (a.line || 0) - (b.line || 0) || (a.ruleId || '').localeCompare(b.ruleId || '')
  })

const summarize = (findings) => {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, allowlisted: 0 }
  for (const finding of findings) {
    summary[finding.severity] += 1
    if (finding.allowlisted) summary.allowlisted += 1
  }
  return summary
}

const domainCoverage = (findings) => {
  const counts = Object.fromEntries(VALID_DOMAINS.map((domain) => [domain, 0]))
  for (const finding of findings) {
    counts[finding.domain] = (counts[finding.domain] || 0) + 1
  }
  return counts
}

const computeExitCode = (findings) => {
  const hasCritical = findings.some((finding) => !finding.allowlisted && finding.severity === 'critical')
  const hasHigh = findings.some((finding) => !finding.allowlisted && finding.severity === 'high')
  if (hasCritical) return 2
  if (hasHigh) return 1
  return 0
}

const redactEvidence = (value) =>
  String(value ?? '')
    .replace(/(sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}/gi, (match) => `${match.slice(0, 4)}…${match.slice(-2)}`)
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gi, (match) => `${match.slice(0, 4)}…${match.slice(-2)}`)
    .replace(/(SUPABASE_SERVICE_ROLE_KEY\s*=\s*)[A-Za-z0-9._-]{20,}/gi, '$1[REDACTED]')

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderMarkdown = (report) => {
  const lines = []
  lines.push('# GMS GUARD — SECOLA Report')
  lines.push(`${new Date(report.generatedAt).toISOString()} · commit ${report.commit}`)
  lines.push('')
  lines.push('## What SECOLA Is')
  lines.push('SECOLA = Secure Core Logic Audit. It is a repeatable, evidence-based audit of the security-critical logic paths in GMS — the code and policies that decide who can do what to which data. SECOLA audits logic, not surface. It is narrow by design and is not a dependency scan, a code-style review, or a UX review.')
  lines.push('')
  lines.push('## Summary')
  lines.push(`- Critical: ${report.summary.critical}`)
  lines.push(`- High: ${report.summary.high}`)
  lines.push(`- Medium: ${report.summary.medium}`)
  lines.push(`- Low: ${report.summary.low}`)
  lines.push(`- Allowlisted: ${report.summary.allowlisted}`)
  lines.push('')
  lines.push('## Domain Coverage')
  lines.push('| Domain | Findings |')
  lines.push('| --- | ---: |')
  for (const domain of VALID_DOMAINS) {
    lines.push(`| ${domain} | ${report.domainCoverage[domain] ?? 0} |`)
  }
  lines.push('')
  lines.push('## Findings')
  if (report.findings.length === 0) {
    lines.push('No findings detected.')
  } else {
    for (const finding of report.findings) {
      lines.push(`### [${finding.ruleId}] ${finding.domain} — ${finding.message}`)
      lines.push(`- File: ${finding.file}:${finding.line}`)
      lines.push(`- Severity: ${finding.severity}`)
      lines.push(`- Allowlisted: ${finding.allowlisted ? 'yes' : 'no'}`)
      lines.push(`- Evidence: \`${redactEvidence(finding.evidence)}\``)
      lines.push('')
    }
  }
  return `${lines.join('\n')}\n`
}

const renderHtml = (report) => {
  const findingsHtml = report.findings.length
    ? report.findings.map((finding) => `
      <div class="card severity-${finding.severity}">
        <div class="meta-row">
          <span class="badge ${finding.severity}">${finding.severity}</span>
          <strong>[${finding.ruleId}]</strong>
          <span>${escapeHtml(finding.domain)}</span>
        </div>
        <div class="location">${escapeHtml(finding.file)}:${finding.line}</div>
        <div class="message">${escapeHtml(finding.message)}</div>
        <pre>${escapeHtml(redactEvidence(finding.evidence))}</pre>
        <div class="allowlisted">Allowlisted: ${finding.allowlisted ? 'yes' : 'no'}</div>
      </div>
    `).join('')
    : '<div class="empty">No findings detected.</div>'

  const domainBoxes = VALID_DOMAINS.map((domain) => `
    <div class="domain-box">
      <span>${escapeHtml(domain)}</span>
      <strong>${report.domainCoverage[domain] ?? 0}</strong>
    </div>
  `).join('')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>GMS GUARD — SECOLA Report</title>
    <style>
      body { font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 24px; }
      h1 { margin-bottom: 10px; }
      .summary { display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0; }
      .pill { background: #111827; border: 1px solid #334155; border-radius: 999px; padding: 8px 12px; }
      .domain-box { display: flex; justify-content: space-between; background: #111827; border: 1px solid #334155; border-radius: 10px; padding: 10px 12px; margin: 6px 0; }
      .card { background: #111827; border: 1px solid #334155; border-radius: 12px; padding: 14px; margin: 14px 0; }
      .severity-critical { border-color: #f87171; }
      .severity-high { border-color: #fbbf24; }
      .severity-medium { border-color: #a78bfa; }
      .severity-low { border-color: #38bdf8; }
      .meta-row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
      .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
      .badge.critical { background: #7f1d1d; }
      .badge.high { background: #78350f; }
      .badge.medium { background: #3b0764; }
      .badge.low { background: #0f766e; }
      .location { color: #93c5fd; margin-bottom: 8px; }
      .message { margin-bottom: 8px; }
      pre { white-space: pre-wrap; background: #020617; border-radius: 8px; padding: 10px; overflow-wrap: anywhere; }
      .empty { border: 1px dashed #475569; border-radius: 8px; padding: 12px; margin: 12px 0; }
    </style>
  </head>
  <body>
    <h1>GMS GUARD — SECOLA Report</h1>
    <div class="summary">
      <span class="pill">Critical: ${report.summary.critical}</span>
      <span class="pill">High: ${report.summary.high}</span>
      <span class="pill">Medium: ${report.summary.medium}</span>
      <span class="pill">Low: ${report.summary.low}</span>
      <span class="pill">Allowlisted: ${report.summary.allowlisted}</span>
    </div>
    <h2>What SECOLA Is</h2>
    <p>SECOLA = Secure Core Logic Audit. It is a repeatable, evidence-based audit of the security-critical logic paths in GMS — the code and policies that decide who can do what to which data. SECOLA audits logic, not surface. It is narrow by design and is not a dependency scan, a code-style review, or a UX review.</p>
    <h2>Domain Coverage</h2>
    <div>${domainBoxes}</div>
    <h2>Findings</h2>
    ${findingsHtml}
  </body>
</html>`
}

const getRepoCommit = () => {
  try {
    const output = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
    return output || 'unknown'
  } catch {
    return 'unknown'
  }
}

const main = () => {
  fs.mkdirSync(guardDir, { recursive: true })

  const scanFindings = () => {
    const fileList = listFiles()
    const context = {
      repoRoot,
      files: {
        allFiles: fileList,
        srcFiles: fileList.filter((file) => file.startsWith('src/')),
        functionFiles: fileList.filter((file) => file.startsWith('functions/')),
        tsFiles: fileList.filter((file) => /\.(ts|tsx)$/.test(file)),
        jsFiles: fileList.filter((file) => /\.(js|jsx)$/.test(file)),
        sqlFiles: fileList.filter((file) => file.includes('/supabase/migrations/') && file.endsWith('.sql')),
      },
      allowlist: { entries: parseAllowlist() },
    }

    const rawFindings = []
    for (const rule of rules) {
      const result = rule.check(context)
      if (Array.isArray(result)) rawFindings.push(...result)
    }
    return sortFindings(applyAllowlist(rawFindings, context.allowlist.entries))
  }

  let findings = scanFindings()
  const resolutions = []
  if (args.has('--resolve')) {
    const countsByRule = new Map()
    for (const finding of findings) countsByRule.set(finding.ruleId, (countsByRule.get(finding.ruleId) || 0) + 1)
    let resolverApplied = false
    for (const [ruleId, count] of countsByRule) {
      if (ruleId !== 'M1') {
        resolutions.push({ ruleId, findings: count, resolved: 0, remaining: count, status: 'manual-review', message: 'No safe automatic resolver is configured for this rule.' })
        continue
      }
      try {
        execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'gms-index.mjs')], { cwd: repoRoot, stdio: 'ignore' })
        resolutions.push({ ruleId, findings: count, resolved: 0, remaining: count, status: 'checking', message: 'Regenerated the repository index and re-ran the guard.' })
        resolverApplied = true
      } catch (error) {
        resolutions.push({ ruleId, findings: count, resolved: 0, remaining: count, status: 'failed', message: error instanceof Error ? error.message : String(error) })
      }
    }
    if (resolverApplied) findings = scanFindings()
    for (const resolution of resolutions) {
      if (resolution.status !== 'checking') continue
      resolution.remaining = findings.filter((finding) => finding.ruleId === resolution.ruleId).length
      resolution.resolved = Math.max(0, resolution.findings - resolution.remaining)
      resolution.status = resolution.remaining === 0 ? 'resolved' : resolution.resolved > 0 ? 'partial' : 'unresolved'
    }
  }

  const summary = summarize(findings)
  const coverage = domainCoverage(findings)
  const exitCode = computeExitCode(findings)
  const generatedAt = new Date().toISOString()
  const commit = getRepoCommit()

  const report = {
    version: '1.0.0',
    generatedAt,
    repo: path.basename(repoRoot),
    commit,
    summary,
    domainCoverage: coverage,
    findings,
    exitCode,
  }

  const payload = JSON.stringify(report, null, 2)
  const signature = `sha256:${crypto.createHash('sha256').update(payload).digest('hex')}`
  const signedReport = { ...report, signature }

  writeText(path.join(guardDir, 'report.json'), `${JSON.stringify(signedReport, null, 2)}\n`)
  writeText(path.join(guardDir, 'report.md'), renderMarkdown(signedReport))
  const html = renderHtml(signedReport).replace('<head>', '<head><meta http-equiv="refresh" content="3">')
  writeText(path.join(guardDir, 'report.html'), html)

  if (isCi) {
    for (const finding of findings) {
      console.log(`${finding.ruleId}\t${finding.severity}\t${finding.domain}\t${finding.file}:${finding.line}\t${finding.message}`)
    }
  }

  if (args.has('--resolve')) {
    for (const resolution of resolutions) {
      console.log(`Resolver ${resolution.ruleId}: ${resolution.status} (${resolution.resolved}/${resolution.findings} resolved)`)
    }
  }

  console.log(`Guard report updated: ${findings.length} finding(s) → .gms-guard/report.html`)

  process.exitCode = exitCode
}

main()

if (args.has('--open') || (args.has('--watch') && !args.has('--no-open'))) {
  const reportUrl = pathToFileURL(path.join(guardDir, 'report.html')).href
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const commandArgs = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', reportUrl] : [reportUrl]
  const browser = spawn(command, commandArgs, { detached: true, stdio: 'ignore' })
  browser.once('error', (error) => console.error(`Could not open guard report: ${error.message}`))
  browser.unref()
}

if (args.has('--watch')) {
  const inputSignature = () => {
    const hash = crypto.createHash('sha256')
    for (const file of listFiles()) {
      hash.update(file)
      hash.update(fs.readFileSync(path.join(repoRoot, file)))
    }
    return hash.digest('hex')
  }

  let previousSignature = inputSignature()
  let timer
  const watcher = fs.watch(repoRoot, { recursive: true })
  watcher.on('error', (error) => {
    console.error(`Guard watch failed: ${error.message}`)
    watcher.close()
    process.exitCode = 1
  })
  watcher.on('change', (_eventType, filename) => {
    const changedPath = filename?.toString()
    if (changedPath && changedPath.split(/[\\/]/).some((part) =>
      ['.git', '.gms-guard', '.gms-index', 'dist', 'dist-ssr', 'node_modules'].includes(part))) return

    clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        const nextSignature = inputSignature()
        if (nextSignature === previousSignature) return
        previousSignature = nextSignature
        main()
        process.exitCode = 0
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
      }
    }, 200)
  })
  console.log('Watching project files for guard changes. Press Ctrl+C to stop.')
}
