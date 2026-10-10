export type RouteEntry = {
  path: string
  element: string
  guarded: boolean
}

export type SqlColumn = {
  name: string
  type: string
  nullable: boolean
}

export type SqlFk = {
  to: string
  column: string
}

export type SqlTable = {
  name: string
  columns: SqlColumn[]
  fks: SqlFk[]
  hasRls: boolean
}

export type IndexNode = {
  id: string
  kind: 'ts' | 'tsx' | 'sql' | 'pkg' | 'asset'
  exports?: string[]
  imports?: string[]
  routes?: RouteEntry[]
  sqlTable?: SqlTable
}

export type IndexEdge = {
  from: string
  to: string
  kind: 'import' | 'fk' | 'route' | 'dep'
}

export type TodoEntry = {
  file: string
  line: number
  text: string
}

export type Index = {
  generatedAt: string
  repoRoot: string
  stats: {
    files: number
    tsModules: number
    sqlTables: number
    routes: number
  }
  nodes: IndexNode[]
  edges: IndexEdge[]
  anomalies: {
    deadFiles: string[]
    unguardedRoutes: string[]
    todos: TodoEntry[]
    missingRls: string[]
  }
}
