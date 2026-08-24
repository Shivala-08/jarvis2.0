/**
 * Voicebox MCP tool resolver.
 *
 * Resolves the speech-generation tool from a runtime MCP tool listing by
 * purpose matching — never by hard-coded exact name. The resolver receives
 * the discovered tool list and identifies the tool whose name and description
 * indicate speech/TTS generation capability.
 *
 * @module
 */

/** Shape of a discovered MCP tool (subset of the full MCP tools/list result). */
export interface McpToolInfo {
  name: string
  description?: string
}

/** Resolution result when a unique speech tool is found. */
export interface ResolvedTool {
  /** The actual runtime tool name (e.g. `voicebox.speak` or `mcp__voicebox__voicebox_speak`). */
  rawName: string
  /** The DSH public name (e.g. `mcp__voicebox__voicebox_speak`). */
  publicName: string
  /** The tool description from the MCP server. */
  description: string
}

/** Error types for resolution failures. */
export type ResolverError =
  | { kind: 'no_match'; tried: string[] }
  | { kind: 'ambiguous'; candidates: McpToolInfo[] }

/**
 * Purpose-matching keywords for identifying the Voicebox speech/TTS tool.
 * Ordered by specificity — first unique match wins.
 */
const SPEECH_PURPOSE_KEYWORDS = [
  'speak',
  'speech',
  'tts',
  'text-to-speech',
  'text to speech',
  'generate speech',
  'voice output',
]

/**
 * Keywords that disqualify a tool from being the speech tool
 * (e.g. transcription, listing, admin tools).
 */
const EXCLUSION_KEYWORDS = [
  'transcri',
  'list_',
  'list ',
  'binding',
  'capture',
  'profile',
  'admin',
]

/**
 * Resolve the Voicebox speech-generation tool from a list of discovered MCP tools.
 *
 * Uses purpose-based matching on tool names and descriptions rather than
 * hard-coded exact names. This ensures the resolver works regardless of
 * how the MCP server sanitizes or renames tools.
 *
 * @param tools - The runtime tool listing from the MCP server
 * @param serverName - The MCP server namespace (e.g. "voicebox")
 * @param publicNameFn - Function to compute the DSH public name from (serverName, rawName)
 * @returns The resolved tool, or a ResolverError
 */
export function resolveVoiceboxSpeechTool(
  tools: McpToolInfo[],
  serverName: string,
  publicNameFn: (serverName: string, rawName: string) => string,
): ResolvedTool | ResolverError {
  // Phase 1: Score each tool by speech-purpose relevance
  const scored: Array<{ tool: McpToolInfo; score: number }> = []

  for (const tool of tools) {
    const nameLower = tool.name.toLowerCase()
    const descLower = (tool.description ?? '').toLowerCase()

    // Check for exclusion keywords on the tool NAME only — not the description,
    // because description text like "voice profile" or "Captures tab" is
    // incidental context, not a disqualifier.
    const isExcluded = EXCLUSION_KEYWORDS.some(kw => nameLower.includes(kw))
    if (isExcluded) continue

    // Score by speech-purpose keyword presence
    let score = 0
    for (let i = 0; i < SPEECH_PURPOSE_KEYWORDS.length; i++) {
      const kw = SPEECH_PURPOSE_KEYWORDS[i]
      if (nameLower.includes(kw)) {
        // Name match is weighted higher; earlier keywords are more specific
        score += (SPEECH_PURPOSE_KEYWORDS.length - i) * 10
      }
      if (descLower.includes(kw)) {
        score += (SPEECH_PURPOSE_KEYWORDS.length - i) * 5
      }
    }

    if (score > 0) {
      scored.push({ tool, score })
    }
  }

  // Phase 2: Evaluate results
  if (scored.length === 0) {
    return {
      kind: 'no_match',
      tried: SPEECH_PURPOSE_KEYWORDS,
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Check for ambiguity: if the top two have the same score, it's ambiguous
  if (scored.length >= 2 && scored[0].score === scored[1].score) {
    return {
      kind: 'ambiguous',
      candidates: scored.map(s => s.tool),
    }
  }

  const winner = scored[0]
  const publicName = publicNameFn(serverName, winner.tool.name)

  return {
    rawName: winner.tool.name,
    publicName,
    description: winner.tool.description ?? '',
  }
}
