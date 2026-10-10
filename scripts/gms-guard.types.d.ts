export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type Domain =
  | 'authentication'
  | 'authorization'
  | 'identity-integrity'
  | 'privilege-boundaries'
  | 'state-transitions'
  | 'input-validation'
  | 'audit-trail'
  | 'failure-behavior'

export interface Finding {
  ruleId: string
  severity: Severity
  domain: Domain
  file: string
  line: number
  message: string
  evidence: string
  allowlisted: boolean
}

export interface Report {
  version: string
  generatedAt: string
  repo: string
  commit: string
  summary: {
    critical: number
    high: number
    medium: number
    low: number
    allowlisted: number
  }
  domainCoverage: Record<string, number>
  findings: Finding[]
  exitCode: number
  signature: string
  timings?: Record<string, number>
}
