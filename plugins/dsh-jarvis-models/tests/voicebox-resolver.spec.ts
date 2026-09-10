import { describe, it, expect } from 'vitest'
import { resolveVoiceboxSpeechTool } from '../src/voicebox-resolver'
import type { McpToolInfo } from '../src/voicebox-resolver'

/** Minimal public-name function mirroring DSH's normalization (dots → underscores). */
function publicName(serverName: string, rawName: string): string {
  return `mcp__${serverName}__${rawName}`.replace(/[^A-Za-z0-9_-]/g, '_')
}

describe('resolveVoiceboxSpeechTool', () => {
  const serverName = 'voicebox'

  describe('happy path — finds the speech tool', () => {
    it('finds voicebox.speak by name', () => {
      const tools: McpToolInfo[] = [
        { name: 'voicebox.speak', description: 'Speak text in a voice profile' },
        { name: 'voicebox.transcribe', description: 'Transcribe audio to text' },
        { name: 'voicebox.list_profiles', description: 'List available voice profiles' },
        { name: 'voicebox.list_captures', description: 'List recent captures' },
      ]

      const result = resolveVoiceboxSpeechTool(tools, serverName, publicName)
      expect(result).not.toHaveProperty('kind')
      expect(result).toHaveProperty('rawName', 'voicebox.speak')
      expect(result).toHaveProperty('publicName', 'mcp__voicebox__voicebox_speak')
    })

    it('finds tool with sanitized name (dots removed)', () => {
      const tools: McpToolInfo[] = [
        { name: 'voicebox_speak', description: 'Speak text in a voice profile' },
        { name: 'voicebox_transcribe', description: 'Transcribe audio to text' },
      ]

      const result = resolveVoiceboxSpeechTool(tools, serverName, publicName)
      expect(result).toHaveProperty('rawName', 'voicebox_speak')
      expect(result).toHaveProperty('publicName', 'mcp__voicebox__voicebox_speak')
    })

    it('finds tool by description when name is ambiguous', () => {
      const tools: McpToolInfo[] = [
        { name: 'voicebox_run', description: 'Run a text-to-speech generation' },
        { name: 'voicebox_process', description: 'Process audio input' },
      ]

      const result = resolveVoiceboxSpeechTool(tools, serverName, publicName)
      expect(result).toHaveProperty('rawName', 'voicebox_run')
    })
  })

  describe('edge cases', () => {
    it('returns no_match when no tools exist', () => {
      const result = resolveVoiceboxSpeechTool([], serverName, publicName)
      expect(result).toHaveProperty('kind', 'no_match')
    })

    it('returns no_match when only transcription tools exist', () => {
      const tools: McpToolInfo[] = [
        { name: 'voicebox.transcribe', description: 'Transcribe audio to text' },
        { name: 'voicebox.list_profiles', description: 'List available voice profiles' },
      ]

      const result = resolveVoiceboxSpeechTool(tools, serverName, publicName)
      expect(result).toHaveProperty('kind', 'no_match')
    })

    it('returns no_match when only list/admin tools exist', () => {
      const tools: McpToolInfo[] = [
        { name: 'voicebox.list_captures', description: 'List recent captures' },
        { name: 'voicebox.list_bindings', description: 'List MCP bindings' },
      ]

      const result = resolveVoiceboxSpeechTool(tools, serverName, publicName)
      expect(result).toHaveProperty('kind', 'no_match')
    })

    it('filters out transcription tool even if it mentions speak', () => {
      const tools: McpToolInfo[] = [
        { name: 'voicebox.transcribe', description: 'Transcribe and speak' },
        { name: 'voicebox.generate', description: 'Generate speech output' },
      ]

      const result = resolveVoiceboxSpeechTool(tools, serverName, publicName)
      expect(result).toHaveProperty('rawName', 'voicebox.generate')
    })

    it('handles tools with no description', () => {
      const tools: McpToolInfo[] = [
        { name: 'voicebox.speak' },
        { name: 'voicebox.transcribe' },
      ]

      const result = resolveVoiceboxSpeechTool(tools, serverName, publicName)
      expect(result).toHaveProperty('rawName', 'voicebox.speak')
    })

    it('handles unrelated tools alongside speech tool', () => {
      const tools: McpToolInfo[] = [
        { name: 'unrelated_tool', description: 'Does something else' },
        { name: 'voicebox.speak', description: 'Speak text' },
        { name: 'another_tool', description: 'Another unrelated tool' },
      ]

      const result = resolveVoiceboxSpeechTool(tools, serverName, publicName)
      expect(result).toHaveProperty('rawName', 'voicebox.speak')
    })

    it('returns no_match for completely unrelated tools', () => {
      const tools: McpToolInfo[] = [
        { name: 'github_create_issue', description: 'Create a GitHub issue' },
        { name: 'github_list_repos', description: 'List repositories' },
      ]

      const result = resolveVoiceboxSpeechTool(tools, serverName, publicName)
      expect(result).toHaveProperty('kind', 'no_match')
    })

    it('prefers speak keyword over generic speech keyword', () => {
      const tools: McpToolInfo[] = [
        { name: 'voicebox_speak_text', description: 'Speak text in a voice' },
        { name: 'voicebox_speech_gen', description: 'Generate speech output' },
      ]

      // Both match, but speak is higher priority
      const result = resolveVoiceboxSpeechTool(tools, serverName, publicName)
      expect(result).toHaveProperty('rawName', 'voicebox_speak_text')
    })
  })
})
