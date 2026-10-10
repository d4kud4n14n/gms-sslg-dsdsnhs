#!/usr/bin/env node

import fs from 'node:fs/promises'
import fsWatch from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const ts = await import(pathToFileURL(path.join(repoRoot, 'node_modules', 'typescript', 'lib', 'typescript.js')).href)
const args = new Set(process.argv.slice(2))

const secretPatterns = [
  /(sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}/g,
  /eyJ[A-Za-z0-9_-]{20,}\./g,
]

function redactSecrets(value) {
  let text = String(value ?? '')
  for (const pattern of secretPatterns) {
    text = text.replace(pattern, '[REDACTED]')
  }
  return text
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/')
}

function isRepoPathUnder(filePath, rootDir) {
  const relative = path.relative(rootDir, filePath)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function getRelativeRepoPath(filePath) {
  return toPosix(path.relative(repoRoot, filePath))
}

function stableSort(items) {
  return [...items].sort((a, b) => String(a).localeCompare(String(b)))
}

async function writeFileAtomically(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempPath, content, 'utf8')
  await fs.rename(tempPath, filePath)
}

async function installGitHooks() {
  const hookDir = path.join(repoRoot, '.git', 'hooks')
  const hookFiles = ['post-merge', 'post-checkout']

  for (const name of hookFiles) {
    const hookPath = path.join(hookDir, name)
    const body = `#!/usr/bin/env sh\nset -u\nROOT=$(git -C "${repoRoot}" rev-parse --show-toplevel 2>/dev/null || printf '%s' "${repoRoot}")\nif [ -n "$ROOT" ] && [ -f "$ROOT/package.json" ]; then\n  (cd "$ROOT" && npm run index >/dev/null 2>&1 || true) &\nfi\nexit 0\n`
    await fs.mkdir(hookDir, { recursive: true })
    await fs.writeFile(hookPath, body, 'utf8')
    await fs.chmod(hookPath, 0o755)
  }
}

async function walkRepo(rootDir, skipFunctionsFlag) {
  const files = []

  async function visit(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.gms-index' || entry.name === '.gms-guard' || entry.name === 'dist' || entry.name === 'dist-ssr') {
        continue
      }
      if (entry.name === 'functions' && skipFunctionsFlag) {
        continue
      }
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await visit(fullPath)
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.log')) {
          continue
        }
        if (entry.name === '.DS_Store') {
          continue
        }
        files.push(fullPath)
      }
    }
  }

  await visit(rootDir)
  return stableSort(files.map((file) => toPosix(path.relative(rootDir, file))))
}

function buildAliasMapFromConfig(config) {
  const aliasMap = {}
  if (!config?.compilerOptions?.paths) {
    return aliasMap
  }

  for (const [aliasKey, targets] of Object.entries(config.compilerOptions.paths)) {
    const normalizedKey = aliasKey.replace(/\/\*$/, '')
    const targetList = Array.isArray(targets) ? targets : [targets]
    const normalizedTargets = targetList.map((value) => value.replace(/\/\*$/, ''))
    aliasMap[normalizedKey] = normalizedTargets
  }
  return aliasMap
}

async function getTsconfigAliases(rootDir) {
  const candidates = ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json']
  for (const candidate of candidates) {
    const filePath = path.join(rootDir, candidate)
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const config = JSON.parse(content)
      const aliases = buildAliasMapFromConfig(config)
      if (Object.keys(aliases).length > 0) {
        return aliases
      }
    } catch {
      // ignore missing/invalid tsconfig files
    }
  }
  return {}
}

function resolveReplacementTargets(filePath, specifier, aliasMap) {
  if (!specifier || specifier.startsWith('node:') || specifier.startsWith('http:') || specifier.startsWith('https:') || specifier.startsWith('data:')) {
    return []
  }

  const normalized = specifier.replace(/\\/g, '/')

  if (normalized.startsWith('.')) {
    const baseDir = path.dirname(filePath)
    const baseResolve = path.resolve(baseDir, normalized)
    return [baseResolve]
  }

  for (const [aliasKey, targets] of Object.entries(aliasMap)) {
    if (aliasKey && normalized === aliasKey) {
      return targets.map((target) => path.resolve(repoRoot, target))
    }
    if (aliasKey && normalized.startsWith(`${aliasKey}/`)) {
      const suffix = normalized.slice(aliasKey.length + 1)
      return targets.map((target) => path.resolve(repoRoot, target, suffix))
    }
  }

  return []
}

function resolveLocalTsImport(filePath, specifier, aliasMap) {
  const candidateRoots = resolveReplacementTargets(filePath, specifier, aliasMap)
  if (candidateRoots.length === 0) {
    return null
  }

  const candidates = []
  for (const candidate of candidateRoots) {
    candidates.push(candidate)
    candidates.push(`${candidate}.ts`)
    candidates.push(`${candidate}.tsx`)
    candidates.push(`${candidate}.js`)
    candidates.push(`${candidate}.jsx`)
    candidates.push(`${candidate}/index.ts`)
    candidates.push(`${candidate}/index.tsx`)
    candidates.push(`${candidate}/index.js`)
    candidates.push(`${candidate}/index.jsx`)
    candidates.push(`${candidate}.d.ts`)
  }

  for (const candidate of candidates) {
    const maybeFile = path.resolve(candidate)
    if (maybeFile.startsWith(repoRoot) && (ts.sys.fileExists(maybeFile) || ts.sys.fileExists(`${maybeFile}.ts`) || ts.sys.fileExists(`${maybeFile}.tsx`) || ts.sys.fileExists(`${maybeFile}.js`) || ts.sys.fileExists(`${maybeFile}.jsx`))) {
      const directExists = [maybeFile, `${maybeFile}.ts`, `${maybeFile}.tsx`, `${maybeFile}.js`, `${maybeFile}.jsx`, `${maybeFile}/index.ts`, `${maybeFile}/index.tsx`, `${maybeFile}/index.js`, `${maybeFile}/index.jsx`, `${maybeFile}.d.ts`].find((entry) => ts.sys.fileExists(entry))
      if (directExists) {
        return toPosix(path.relative(repoRoot, directExists))
      }
    }
  }

  if (specifier.startsWith('.')) {
    const abs = path.resolve(path.dirname(filePath), specifier)
    const direct = [abs, `${abs}.ts`, `${abs}.tsx`, `${abs}.js`, `${abs}.jsx`, `${abs}/index.ts`, `${abs}/index.tsx`, `${abs}/index.js`, `${abs}/index.jsx`, `${abs}.d.ts`].find((entry) => ts.sys.fileExists(entry))
    if (direct) {
      return toPosix(path.relative(repoRoot, direct))
    }
  }

  return null
}

function getNodeNameFromExpression(expr) {
  if (!expr) return ''
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr)) return `${getNodeNameFromExpression(expr.expression)}.${expr.name.text}`
  if (ts.isCallExpression(expr)) return getNodeNameFromExpression(expr.expression)
  if (ts.isJsxSelfClosingElement(expr) || ts.isJsxElement(expr)) {
    return ts.isJsxSelfClosingElement(expr) ? getJsxTagName(expr.tagName) : getJsxTagName(expr.openingElement.tagName)
  }
  if (ts.isParenthesizedExpression(expr)) return getNodeNameFromExpression(expr.expression)
  return ''
}

function getJsxTagName(tagName) {
  if (!tagName) return ''
  if (ts.isIdentifier(tagName)) return tagName.text
  if (ts.isPropertyAccessExpression(tagName)) return `${getJsxTagName(tagName.expression)}.${tagName.name.text}`
  return ''
}

function extractJsxAttribute(node, name) {
  if (!node || !ts.isJsxSelfClosingElement(node) && !ts.isJsxElement(node)) return undefined
  const attributes = ts.isJsxSelfClosingElement(node) ? node.attributes : node.openingElement.attributes
  return attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name && attribute.name.text === name)
}

function expressionToString(expr) {
  if (!expr) return ''
  if (ts.isStringLiteralLike(expr)) return expr.text
  if (ts.isJsxExpression(expr)) {
    if (expr.expression) {
      return expr.expression.getText().replace(/\s+/g, ' ').trim()
    }
    return ''
  }
  if (ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text
  if (ts.isParenthesizedExpression(expr)) return expressionToString(expr.expression)
  return expr.getText().replace(/\s+/g, ' ').trim()
}

function parseRouteData(filePath, importsByLocalName, sourceFile) {
  const routes = []
  const visit = (node) => {
    if (!ts.isJsxSelfClosingElement(node) && !ts.isJsxElement(node)) {
      ts.forEachChild(node, visit)
      return
    }

    const tagName = ts.isJsxSelfClosingElement(node) ? getJsxTagName(node.tagName) : getJsxTagName(node.openingElement.tagName)
    if (tagName !== 'Route') {
      ts.forEachChild(node, visit)
      return
    }

    const attributes = ts.isJsxSelfClosingElement(node) ? node.attributes.properties : node.openingElement.attributes.properties
    const pathAttr = attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name && attribute.name.text === 'path')
    const elementAttr = attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name && attribute.name.text === 'element')

    if (!pathAttr || !elementAttr) {
      ts.forEachChild(node, visit)
      return
    }

    const pathValue = expressionToString(pathAttr.initializer)
    const elementText = expressionToString(elementAttr.initializer)
    const guarded = /requireActive|renderSetup|session|Navigate/.test(elementText)

    routes.push({
      path: pathValue,
      element: redactedText(elementText),
      guarded,
    })

    const targetName = getNodeNameFromExpression(elementAttr.initializer)
    if (targetName) {
      const imported = importsByLocalName.get(targetName)
      if (imported) {
        const routeTargetId = imported
        const routeEdge = { from: toPosix(path.relative(repoRoot, filePath)), to: routeTargetId, kind: 'route' }
        routes.push({ __routeEdge: routeEdge })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return routes.filter((route) => !('__routeEdge' in route))
}

function redactedText(value) {
  return redactSecrets(value).replace(/\s+/g, ' ').trim()
}

async function parseTypeScriptFile(filePath, aliasMap) {
  const content = redactSecrets(await fs.readFile(filePath, 'utf8'))
  const fileKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, fileKind)
  const exports = new Set()
  const imports = new Set()
  const importsByLocalName = new Map()

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text
      const resolved = resolveLocalTsImport(filePath, spec, aliasMap)
      if (resolved) {
        imports.add(resolved)
      }
      for (const element of node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) ? node.importClause.namedBindings.elements : []) {
        importsByLocalName.set(element.name.text, resolved ? resolved : null)
      }
      if (node.importClause?.name) {
        importsByLocalName.set(node.importClause.name.text, resolved ? resolved : null)
      }
      if (node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) {
        importsByLocalName.set(node.importClause.namedBindings.name.text, resolved ? resolved : null)
      }
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const resolved = resolveLocalTsImport(filePath, node.moduleSpecifier.text, aliasMap)
      if (resolved) {
        imports.add(resolved)
      }
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0]
      if (arg && ts.isStringLiteralLike(arg)) {
        const resolved = resolveLocalTsImport(filePath, arg.text, aliasMap)
        if (resolved) {
          imports.add(resolved)
        }
      }
    }

    if (ts.isExportAssignment(node) || ts.isExportDeclaration(node)) {
      exports.add('default')
    }

    if (ts.isFunctionDeclaration(node) && node.name) exports.add(node.name.text)
    if (ts.isClassDeclaration(node) && node.name) exports.add(node.name.text)
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) exports.add(declaration.name.text)
      }
    }
    if (ts.isInterfaceDeclaration(node)) exports.add(node.name.text)
    if (ts.isTypeAliasDeclaration(node)) exports.add(node.name.text)

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  const id = toPosix(path.relative(repoRoot, filePath))
  const node = {
    id,
    kind: filePath.endsWith('.tsx') ? 'tsx' : 'ts',
    exports: [...exports].sort(),
    imports: [...imports].sort(),
  }

  const routeMatches = []
  const routeVisit = (subNode) => {
    if (!ts.isJsxSelfClosingElement(subNode) && !ts.isJsxElement(subNode)) {
      ts.forEachChild(subNode, routeVisit)
      return
    }

    const tagName = ts.isJsxSelfClosingElement(subNode) ? getJsxTagName(subNode.tagName) : getJsxTagName(subNode.openingElement.tagName)
    if (tagName !== 'Route') {
      ts.forEachChild(subNode, routeVisit)
      return
    }

    const attributes = ts.isJsxSelfClosingElement(subNode) ? subNode.attributes.properties : subNode.openingElement.attributes.properties
    const pathAttr = attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name && attribute.name.text === 'path')
    const elementAttr = attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name && attribute.name.text === 'element')
    if (!pathAttr || !elementAttr) {
      ts.forEachChild(subNode, routeVisit)
      return
    }

    const pathValue = expressionToString(pathAttr.initializer)
    const elementText = expressionToString(elementAttr.initializer)
    const guarded = /requireActive|renderSetup|session|Navigate/.test(elementText)
    routeMatches.push({ path: pathValue, element: redactedText(elementText), guarded })
    ts.forEachChild(subNode, routeVisit)
  }

  routeVisit(sourceFile)
  if (routeMatches.length > 0) {
    node.routes = routeMatches
  }

  return { node, importsByLocalName }
}

async function parseSqlTableDefinitions(filePath) {
  const content = redactSecrets(await fs.readFile(filePath, 'utf8'))
  const tablePattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"|`)?([A-Za-z0-9_\.]+)(?:"|`)?\s*\(([^]*?)\)\s*;/gi
  const tables = []

  let match
  while ((match = tablePattern.exec(content)) !== null) {
    const tableName = match[1].replace(/"|`/g, '')
    const columnsText = match[2]
    const columns = []
    const columnPattern = /(?:^|,)\s*(?:"|`)?([A-Za-z0-9_]+)(?:"|`)?\s+([^,]+?)(?=\s*(?:,|$))/gi
    let columnMatch
    while ((columnMatch = columnPattern.exec(columnsText)) !== null) {
      const columnName = columnMatch[1].replace(/"|`/g, '')
      let columnType = columnMatch[2].trim()
      let nullable = true
      const lowered = columnType.toLowerCase()
      if (lowered.includes('not null')) {
        nullable = false
      }
      if (lowered.includes('primary key')) {
        nullable = false
      }
      if (lowered.includes('references')) {
        nullable = true
      }
      columnType = columnType.replace(/\s+(not null|null|primary key|references\s+.*)$/gi, '').trim()
      columns.push({ name: columnName, type: columnType || 'unknown', nullable })
    }

    const fks = []
    const fkPattern = /references\s+(?:"|`)?([A-Za-z0-9_\.]+)(?:"|`)?\s*\(\s*(?:"|`)?([A-Za-z0-9_]+)(?:"|`)?\s*\)/gi
    let fkMatch
    while ((fkMatch = fkPattern.exec(columnsText)) !== null) {
      fks.push({ to: fkMatch[1].replace(/"|`/g, ''), column: fkMatch[2].replace(/"|`/g, '') })
    }

    const escapedTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const hasRls = new RegExp("create\\s+policy\\s+.*?\\s+on\\s+(?:\"|`)?(?:public\\.)?" + escapedTableName + "(?:\"|`)?", 'i').test(content)
    tables.push({
      name: tableName,
      columns,
      fks,
      hasRls,
    })
  }

  return tables
}

function tableNodeId(tableName) {
  return `sql:table:${tableName.replace(/\./g, '_')}`
}

async function buildIndex() {
  const files = await walkRepo(repoRoot, args.has('--no-functions'))
  const aliasMap = await getTsconfigAliases(repoRoot)
  const nodes = []
  const edges = []
  const nodeMap = new Map()
  const reverseImports = new Map()
  const sqlTablesByName = new Map()
  const routeItems = []
  const packageEntries = []

  for (const relativePath of files) {
    const absPath = path.join(repoRoot, relativePath)
    const ext = path.extname(relativePath)
    const fileName = path.basename(relativePath)

    if (fileName === 'package.json' || fileName === 'package-lock.json') {
      const pkgNode = { id: relativePath, kind: 'pkg' }
      nodes.push(pkgNode)
      nodeMap.set(relativePath, pkgNode)
      try {
        const packageJson = JSON.parse(await fs.readFile(absPath, 'utf8'))
        const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) }
        packageEntries.push({ id: relativePath, deps: Object.keys(deps) })
        for (const depName of Object.keys(deps)) {
          edges.push({ from: relativePath, to: depName, kind: 'dep' })
        }
      } catch {
        // ignore invalid package manifests
      }
      continue
    }

    if (relativePath.includes('/supabase/migrations/') && ext === '.sql') {
      const sqlTables = await parseSqlTableDefinitions(absPath)
      for (const sqlTable of sqlTables) {
        const sqlId = tableNodeId(sqlTable.name)
        const nodeEntry = { id: sqlId, kind: 'sql', sqlTable }
        nodes.push(nodeEntry)
        nodeMap.set(sqlId, nodeEntry)
        sqlTablesByName.set(sqlTable.name, sqlTable)
      }
      continue
    }

    if (ext === '.ts' || ext === '.tsx') {
      const { node, importsByLocalName } = await parseTypeScriptFile(absPath, aliasMap)
      nodes.push(node)
      nodeMap.set(node.id, node)
      for (const importedId of node.imports ?? []) {
        const target = importedId
        edges.push({ from: node.id, to: target, kind: 'import' })
        if (!reverseImports.has(target)) {
          reverseImports.set(target, [])
        }
        reverseImports.get(target).push(node.id)
      }
      if (node.routes) {
        for (const route of node.routes) {
          routeItems.push({ file: node.id, path: route.path, element: route.element, guarded: route.guarded })
          edges.push({ from: node.id, to: route.path, kind: 'route' })
        }
      }
      continue
    }

    nodes.push({ id: relativePath, kind: 'asset' })
    nodeMap.set(relativePath, { id: relativePath, kind: 'asset' })
  }

  for (const edge of edges) {
    if (edge.kind === 'route') {
      continue
    }
    if (edge.to && typeof edge.to === 'string' && edge.to.startsWith('sql:table:')) {
      continue
    }
  }

  const allRouteTargets = new Set()
  for (const item of routeItems) {
    if (item.path) {
      allRouteTargets.add(item.path)
    }
  }

  const sqlEdges = []
  for (const [tableName, table] of sqlTablesByName.entries()) {
    const fromId = tableNodeId(tableName)
    for (const fk of table.fks ?? []) {
      const toName = fk.to.replace(/\./g, '_')
      const targetId = tableNodeId(toName)
      sqlEdges.push({ from: fromId, to: targetId, kind: 'fk' })
      edges.push({ from: fromId, to: targetId, kind: 'fk' })
    }
  }

  const deadFiles = []
  const usedFiles = new Set()
  for (const edge of edges) {
    const target = edge.to
    if (typeof target === 'string' && !target.startsWith('sql:table:') && !target.includes(':')) {
      usedFiles.add(target)
    }
  }
  const entrypoints = new Set(['src/main.tsx', 'src/App.tsx'])
  for (const node of nodes) {
    if ((node.kind === 'ts' || node.kind === 'tsx') && !usedFiles.has(node.id) && !entrypoints.has(node.id)) {
      deadFiles.push(node.id)
    }
  }

  const unguardedRoutes = routeItems.filter((route) => !route.guarded).map((route) => route.path)

  const missingRls = []
  for (const table of sqlTablesByName.values()) {
    if (!table.hasRls) {
      missingRls.push(table.name)
    }
  }

  const todoEntries = []
  for (const relativePath of files) {
    const absPath = path.join(repoRoot, relativePath)
    const ext = path.extname(relativePath)
    if (['.ts', '.tsx', '.js', '.jsx', '.sql', '.md', '.json'].includes(ext) || relativePath.endsWith('package.json')) {
      try {
        const source = redactSecrets(await fs.readFile(absPath, 'utf8'))
        const lines = source.split(/\r?\n/)
        for (let i = 0; i < lines.length; i += 1) {
          if (/TODO|FIXME|HACK/i.test(lines[i])) {
            todoEntries.push({ file: relativePath, line: i + 1, text: lines[i].trim() })
          }
        }
      } catch {
        // ignore unreadable files
      }
    }
  }

  const index = {
    generatedAt: new Date().toISOString(),
    repoRoot: '.',
    stats: {
      files: files.length,
      tsModules: nodes.filter((node) => node.kind === 'ts' || node.kind === 'tsx').length,
      sqlTables: sqlTablesByName.size,
      routes: routeItems.length,
    },
    routes: routeItems,
    nodes: nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      ...(Array.isArray(node.exports) && node.exports.length ? { exports: node.exports } : {}),
      ...(Array.isArray(node.imports) && node.imports.length ? { imports: node.imports } : {}),
      ...(Array.isArray(node.routes) && node.routes.length ? { routes: node.routes.map((route) => ({ path: route.path, element: route.element, guarded: route.guarded })) } : {}),
      ...(node.sqlTable ? { sqlTable: node.sqlTable } : {}),
    })),
    edges: edges.map((edge) => ({ from: edge.from, to: edge.to, kind: edge.kind })),
    anomalies: {
      deadFiles: stableSort(deadFiles),
      unguardedRoutes: stableSort(unguardedRoutes),
      todos: todoEntries.map((entry) => ({ file: entry.file, line: entry.line, text: entry.text })),
      missingRls: stableSort(missingRls),
    },
  }

  index.edges.sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`))
  index.nodes.sort((a, b) => a.id.localeCompare(b.id))

  return index
}

function buildTreeGraph(index) {
  const graph = new Map()
  for (const node of index.nodes) {
    graph.set(node.id, [])
  }
  for (const edge of index.edges) {
    if (edge.kind === 'import' || edge.kind === 'route' || edge.kind === 'dep') {
      if (!graph.has(edge.from)) {
        graph.set(edge.from, [])
      }
      if (!graph.has(edge.to)) {
        graph.set(edge.to, [])
      }
      graph.get(edge.from).push(edge.to)
    }
  }
  for (const [key, value] of graph.entries()) {
    graph.set(key, [...new Set(value)].sort())
  }
  return graph
}

function renderTree(graph, startId) {
  const lines = []
  const visited = new Set()

  function walk(nodeId, depth, prefix) {
    if (visited.has(nodeId) && nodeId !== startId) return
    visited.add(nodeId)
    const label = nodeId.split('/').pop() || nodeId
    lines.push(`${prefix}${label}`)
    const children = graph.get(nodeId) || []
    const localChildren = children.filter((child) => child && child !== nodeId)
    for (let i = 0; i < localChildren.length; i += 1) {
      const child = localChildren[i]
      const isLast = i === localChildren.length - 1
      walk(child, depth + 1, `${prefix}${isLast ? '└─ ' : '├─ '}`)
    }
  }

  walk(startId, 0, '')
  return lines.join('\n')
}

function buildReverseMap(index) {
  const reverse = new Map()
  for (const node of index.nodes) {
    reverse.set(node.id, [])
  }
  for (const edge of index.edges) {
    if (edge.kind === 'import' || edge.kind === 'route' || edge.kind === 'dep') {
      if (!reverse.has(edge.to)) reverse.set(edge.to, [])
      reverse.get(edge.to).push(edge.from)
    }
  }
  for (const [key, value] of reverse.entries()) {
    reverse.set(key, [...new Set(value)].sort())
  }
  return reverse
}

function renderMarkdown(index) {
  const graph = buildTreeGraph(index)
  const reverse = buildReverseMap(index)
  const routeRows = (index.nodes.find((node) => node.id === 'src/App.tsx')?.routes ?? []).map((route) => `| ${route.path} | ${route.element || 'n/a'} | ${route.guarded ? 'yes' : 'no'} |`).join('\n')
  const startId = index.nodes.some((node) => node.id === 'src/main.tsx') ? 'src/main.tsx' : 'src/App.tsx'
  const tree = renderTree(graph, startId)
  const reverseList = [...reverse.entries()]
    .filter(([key]) => key !== 'src/main.tsx')
    .map(([key, value]) => `${key} ← ${value.join(', ') || 'n/a'}`)
    .sort()
    .join('\n')

  const sqlRelations = []
  for (const edge of index.edges.filter((item) => item.kind === 'fk')) {
    const fromName = edge.from.replace(/^sql:table:/, '')
    const toName = edge.to.replace(/^sql:table:/, '')
    sqlRelations.push(`${fromName} → ${toName}`)
  }

  const authFiles = [...new Set(index.nodes.filter((node) => /auth|supabase\.auth/i.test(node.id)).map((node) => node.id))]
  const authFlow = authFiles.length === 0 ? ['- none'] : authFiles.map((file) => `- ${file}`)

  const markdown = `# GMS Index — ${index.generatedAt}\n\n## Stats\n- Files: ${index.stats.files} | TS modules: ${index.stats.tsModules} | SQL tables: ${index.stats.sqlTables} | Routes: ${index.stats.routes}\n\n## Route Table\n| Path | Component | Guarded |\n|---|---|---|\n${routeRows || '| - | - | - |'}\n\n## Top-Down Tree (from src/main.tsx)\n\n\`\`\`text\n${tree}\n\`\`\`\n\n## Bottom-Up Map\n${reverseList || 'n/a'}\n\n## SQL Relations\n${sqlRelations.length ? sqlRelations.join('\n') : '(no outgoing FKs yet)'}\n\n## Auth Flow (heuristic: files containing "auth" or "supabase.auth")\n${authFlow.join('\n')}\n\n## Anomalies\n- Dead files: ${index.anomalies.deadFiles.length ? index.anomalies.deadFiles.join(', ') : 'none'}\n- Unguarded routes: ${index.anomalies.unguardedRoutes.length ? index.anomalies.unguardedRoutes.join(', ') : 'none'}\n- Tables without RLS: ${index.anomalies.missingRls.length ? index.anomalies.missingRls.join(', ') : 'none'}\n- TODOs: ${index.anomalies.todos.length ? index.anomalies.todos.map((todo) => `${todo.file}:${todo.line} ${todo.text}`).join(', ') : 'none'}\n`

  return markdown
}

function renderHtml(index) {
  const tree = buildTreeGraph(index)
  const reverse = buildReverseMap(index)
  const startId = index.nodes.some((node) => node.id === 'src/main.tsx') ? 'src/main.tsx' : 'src/App.tsx'
  const routeTable = (index.nodes.find((node) => node.id === 'src/App.tsx')?.routes ?? []).map((route) => `<tr><td>${escapeHtml(route.path)}</td><td>${escapeHtml(route.element || 'n/a')}</td><td>${route.guarded ? 'yes' : 'no'}</td></tr>`).join('')
  const treeLines = renderTree(tree, startId).split('\n').map((line) => `<li>${escapeHtml(line)}</li>`).join('')
  const reverseLines = [...reverse.entries()].map(([key, value]) => `<li><strong>${escapeHtml(key)}</strong> ← ${escapeHtml(value.join(', ') || 'n/a')}</li>`).join('')
  const sqlList = (index.edges.filter((edge) => edge.kind === 'fk')).map((edge) => `<li>${escapeHtml(edge.from.replace(/^sql:table:/, ''))} → ${escapeHtml(edge.to.replace(/^sql:table:/, ''))}</li>`).join('') || '<li>(no outgoing FKs yet)</li>'

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>GMS Index</title>
    <style>
      :root { color-scheme: light dark; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #0f172a; color: #e2e8f0; }
      .wrap { max-width: 1100px; margin: 0 auto; }
      .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
      .tab { padding: 10px 16px; background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; cursor: pointer; }
      .tab.active { background: #2563eb; border-color: #2563eb; }
      .panel { display: none; background: #111827; border: 1px solid #334155; border-radius: 12px; padding: 16px; }
      .panel.active { display: block; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #334155; vertical-align: top; }
      ul { padding-left: 18px; }
      code { font-family: Consolas, monospace; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 16px 0 18px; }
      .stat { background: #111827; border: 1px solid #334155; border-radius: 10px; padding: 12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>GMS Index</h1>
      <div class="stats">
        <div class="stat"><strong>Files</strong><div>${index.stats.files}</div></div>
        <div class="stat"><strong>TS</strong><div>${index.stats.tsModules}</div></div>
        <div class="stat"><strong>SQL Tables</strong><div>${index.stats.sqlTables}</div></div>
        <div class="stat"><strong>Routes</strong><div>${index.stats.routes}</div></div>
      </div>
      <div class="tabs">
        <button class="tab active" data-tab="tree">Tree</button>
        <button class="tab" data-tab="reverse">Reverse</button>
        <button class="tab" data-tab="sql">SQL</button>
      </div>
      <section class="panel active" id="tree-panel">
        <h2>Top-Down</h2>
        <ul>${treeLines}</ul>
      </section>
      <section class="panel" id="reverse-panel">
        <h2>Bottom-Up</h2>
        <ul>${reverseLines}</ul>
      </section>
      <section class="panel" id="sql-panel">
        <h2>FK Graph</h2>
        <ul>${sqlList}</ul>
      </section>
      <section class="panel" id="route-panel">
        <h2>Routes</h2>
        <table>
          <thead><tr><th>Path</th><th>Component</th><th>Guarded</th></tr></thead>
          <tbody>${routeTable || '<tr><td colspan="3">No routes</td></tr>'}</tbody>
        </table>
      </section>
    </div>
    <script>
      for (const tab of document.querySelectorAll('.tab')) {
        tab.addEventListener('click', () => {
          const target = tab.dataset.tab
          document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === tab))
          document.querySelectorAll('.panel').forEach((panel) => {
            panel.classList.toggle('active', panel.id === target + '-panel')
          })
        })
      }
    </script>
  </body>
</html>`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function main() {
  if (args.has('--help') || args.has('-h')) {
    console.log('Usage: node scripts/gms-index.mjs [--watch] [--open] [--no-functions] [--install-hooks]')
    console.log('  --watch        Rebuild the index when files change.')
    console.log('  --open         Open the generated HTML after the index rebuilds.')
    console.log('  --no-functions Skip Cloudflare Functions while scanning the repo for a faster local pass.')
    console.log('  --install-hooks Install merge/checkout hooks that refresh the index in the background.')
    return
  }

  if (args.has('--install-hooks')) {
    await installGitHooks()
    return
  }

  const indexDir = path.join(repoRoot, '.gms-index')
  const htmlPath = path.join(indexDir, 'index.html')
  let buildPending = false
  let buildRunning = false
  let debounceTimer

  async function generateIndex() {
    if (buildRunning) {
      buildPending = true
      return
    }

    buildRunning = true
    try {
      do {
        buildPending = false
        const startMs = Date.now()
        const index = await buildIndex()
        await fs.mkdir(indexDir, { recursive: true })
        await writeFileAtomically(path.join(indexDir, 'index.json'), JSON.stringify(index, null, 2))
        await writeFileAtomically(path.join(indexDir, 'index.md'), renderMarkdown(index))
        await writeFileAtomically(htmlPath, renderHtml(index))

        console.log(`Indexed ${index.stats.files} files in ${Date.now() - startMs}ms → .gms-index/`)
      } while (buildPending)
    } finally {
      buildRunning = false
    }
  }

  function openInBrowser() {
    const url = pathToFileURL(htmlPath).href
    const command = process.platform === 'win32'
      ? 'rundll32.exe'
      : process.platform === 'darwin'
        ? 'open'
        : 'xdg-open'
    const commandArgs = process.platform === 'win32'
      ? ['url.dll,FileProtocolHandler', url]
      : [url]
    const browser = spawn(command, commandArgs, { detached: true, stdio: 'ignore' })
    browser.once('error', (error) => {
      console.error(`Could not open the index in a browser: ${error.message}`)
    })
    browser.unref()
  }

  await generateIndex()
  if (args.has('--open') || (args.has('--watch') && !args.has('--no-open'))) {
    openInBrowser()
  }

  if (!args.has('--watch')) return

  const ignoredDirectories = new Set(['.git', 'node_modules', '.gms-index', '.gms-guard', 'dist', 'dist-ssr'])
  async function getInputSignature() {
    const files = await walkRepo(repoRoot, false)
    const hash = createHash('sha256')
    for (const file of files) {
      hash.update(file)
      hash.update(await fs.readFile(path.join(repoRoot, file)))
    }
    return hash.digest('hex')
  }

  let inputSignature = await getInputSignature()
  const watcher = fsWatch.watch(repoRoot, { recursive: true })
  watcher.on('error', (error) => {
    console.error(`Index watch failed: ${error.message}`)
    watcher.close()
    process.exitCode = 1
  })
  watcher.on('change', (_eventType, filename) => {
    const changedPath = filename?.toString()
    if (changedPath && changedPath.split(/[\\/]/).some((part) => ignoredDirectories.has(part))) return

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      getInputSignature().then((nextSignature) => {
        if (nextSignature === inputSignature) return
        inputSignature = nextSignature
        return generateIndex()
      }).catch((error) => {
        console.error(error instanceof Error ? error.message : String(error))
      })
    }, 200)
  })

  console.log('Watching project files. Press Ctrl+C to stop.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
