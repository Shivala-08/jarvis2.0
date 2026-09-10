/**
 * Integration test: verify the Voicebox MCP server is reachable and tools
 * can be resolved. This test requires the Voicebox Docker container to be
 * running on port 17600.
 */
import { describe, it, expect } from 'vitest'
import { resolveVoiceboxSpeechTool } from '../src/voicebox-resolver'
import type { McpToolInfo } from '../src/voicebox-resolver'

/** Mirrors DSH's publicToolName normalization. */
function publicName(serverName: string, rawName: string): string {
  return `mcp__${serverName}__${rawName}`.replace(/[^A-Za-z0-9_-]/g, '_')
}

describe('Voicebox MCP connection (requires running container)', () => {
  const VOICEBOX_URL = 'http://127.0.0.1:17493'

  it('health endpoint returns healthy', async () => {
    const resp = await fetch(`${VOICEBOX_URL}/health`)
    expect(resp.ok).toBe(true)
    const body = await resp.json() as Record<string, unknown>
    expect(body.status).toBe('healthy')
  })

  it('MCP initialize handshake succeeds', async () => {
    const resp = await fetch(`${VOICEBOX_URL}/mcp/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-resolver', version: '1.0.0' },
        },
      }),
    })

    expect(resp.ok).toBe(true)
    const sessionId = resp.headers.get('mcp-session-id')
    expect(sessionId).toBeTruthy()
  })

  it('tools/list returns speech tools that the resolver can find', async () => {
    // Initialize
    const initResp = await fetch(`${VOICEBOX_URL}/mcp/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-resolver', version: '1.0.0' },
        },
      }),
    })

    const sessionId = initResp.headers.get('mcp-session-id')!
    expect(sessionId).toBeTruthy()

    // List tools
    const listResp = await fetch(`${VOICEBOX_URL}/mcp/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    })

    const text = await listResp.text()
    // Parse SSE data
    const dataLine = text.split('\n').find(l => l.startsWith('data:'))
    expect(dataLine).toBeTruthy()
    const data = JSON.parse(dataLine!.slice(5).trim()) as {
      result: { tools: Array<{ name: string; description?: string }> }
    }

    const tools: McpToolInfo[] = data.result.tools
    expect(tools.length).toBeGreaterThan(0)

    // Resolve the speech tool
    const resolved = resolveVoiceboxSpeechTool(tools, 'voicebox', publicName)
    expect(resolved).toHaveProperty('rawName')
    expect(resolved).toHaveProperty('publicName')
    expect((resolved as any).rawName).toContain('speak')
    expect((resolved as any).publicName).toBe('mcp__voicebox__voicebox_speak')
  })
})
