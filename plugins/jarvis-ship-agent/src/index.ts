/**
 * jarvis-ship-agent — Prepares a release only after every hard gate passes.
 *
 * The verification gate is STRUCTURAL, not advisory: ship cannot execute
 * unless verification.status === 'ready' AND review has passed. It also
 * scans the prepared diff for secrets before anything ships, and requires
 * explicit user confirmation before any irreversible action.
 *
 * Phase 7 of the Jarvis rebuild.
 *
 * @module
 */

/** Ship readiness as reported by the workflow controller. */
export interface ShipReadiness {
  verification_status: string
  review_passed: boolean
  can_ship: boolean
  blocked_reason?: string
}

/** Input describing what is about to ship. */
export interface ShipContext {
  /** Verification status — the structural hard gate. */
  verification_status: 'pending' | 'failed' | 'ready'
  /** Whether the independent review passed. */
  review_passed: boolean
  /** The diff to prepare (string of staged/unstaged changes). */
  diff?: string
  /** Files staged for shipping. */
  files?: string[]
  /** Working directory. */
  cwd?: string
  /** Skip the dry-run diff scan (for tests). */
  skipSecretScan?: boolean
}

/** Result of preparing a ship. */
export interface ShipPlan {
  can_ship: boolean
  blocked_reason?: string
  diff_preview: string
  secret_warnings: string[]
  awaiting_confirmation: boolean
}

/** Patterns used to detect likely secrets in a diff. */
const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z_-]{35}/, // Google API key
  /sk-[A-Za-z0-9]{20,}/, // OpenAI-style key
  /ghp_[A-Za-z0-9]{36,}/, // GitHub PAT
  /AKIA[0-9A-Z]{16}/, // AWS access key
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, // private key blocks
  /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
]

/**
 * Evaluate the structural ship gate.
 */
export function evaluateGate(verification_status: string, review_passed: boolean): ShipReadiness {
  const canShip = verification_status === 'ready' && review_passed
  return {
    verification_status,
    review_passed,
    can_ship: canShip,
    blocked_reason: canShip
      ? undefined
      : verification_status !== 'ready'
        ? `verification not ready (${verification_status})`
        : 'independent review not passed',
  }
}

/**
 * Scan a diff for likely secrets.
 */
export function scanForSecrets(diff: string): string[] {
  const found: string[] = []
  for (const pattern of SECRET_PATTERNS) {
    const lines = diff.split('\n').filter((l) => /^\+/.test(l))
    for (const line of lines) {
      if (pattern.test(line)) {
        found.push(`possible secret in added line: ${line.slice(0, 120)}`)
      }
    }
  }
  return found
}

/**
 * Prepare the ship plan. Enforces the structural gate and secret scan.
 * Returns a plan that still requires user confirmation; it performs no
 * irreversible action itself.
 */
export function prepareShip(context: ShipContext): ShipPlan {
  const gate = evaluateGate(context.verification_status, context.review_passed)

  if (!gate.can_ship) {
    return {
      can_ship: false,
      blocked_reason: gate.blocked_reason,
      diff_preview: '',
      secret_warnings: [],
      awaiting_confirmation: false,
    }
  }

  const diff = context.diff ?? ''
  const secret_warnings = context.skipSecretScan ? [] : scanForSecrets(diff)

  const diff_preview = diff
    ? diff.split('\n').slice(0, 50).join('\n')
    : `[${(context.files ?? []).length} file(s) staged]`

  return {
    can_ship: true,
    diff_preview,
    secret_warnings,
    awaiting_confirmation: true,
  }
}

export const name = 'jarvis-ship-agent'
export const version = '0.1.0'
