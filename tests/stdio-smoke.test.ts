import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DIST_INDEX = fileURLToPath(new URL('../dist/index.js', import.meta.url));

interface RpcResponse {
  id: number;
  result?: { tools?: unknown; content?: { type: string; text: string }[] };
  error?: { message: string };
}

describe('package: npx agentic-linkedin over stdio', () => {
  let child: ReturnType<typeof spawn>;
  let stdout: string;
  let nextId = 1;
  const pending = new Map<number, (r: RpcResponse) => void>();

  beforeAll(async () => {
    child = spawn(process.execPath, [DIST_INDEX], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      const text = Buffer.concat(chunks).toString('utf8');
      const lines = text.split('\n');
      chunks.length = 0;
      chunks.push(Buffer.from(lines.pop() ?? ''));
      for (const line of lines) {
        if (line.trim().length === 0) {
          continue;
        }
        const message = JSON.parse(line) as RpcResponse;
        pending.get(message.id)?.(message);
        pending.delete(message.id);
      }
    });
    const send = (message: unknown) => child.stdin.write(`${JSON.stringify(message)}\n`);
    const request = (method: string, params: unknown): Promise<RpcResponse> =>
      new Promise((resolve) => {
        const id = nextId++;
        pending.set(id, resolve);
        send({ jsonrpc: '2.0', id, method, params });
      });

    await request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke', version: '0.0.0' },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });

    const tools = await request('tools/list', {});
    const session = await request('tools/call', { name: 'session_status', arguments: {} });
    stdout = JSON.stringify(tools) + '\n' + JSON.stringify(session);
  });

  afterAll(async () => {
    child.kill();
  });

  it('serves the binary over stdio with every tool registered', () => {
    const toolsMessage = JSON.parse(stdout.split('\n')[0]) as RpcResponse;
    const tools = toolsMessage.result?.tools;
    const names = Array.isArray(tools) ? tools.map((t) => (t as { name: string }).name) : [];
    // 39 tools: session/login + 9 reads + 18 writes + 4 planning + 2 self-healing + 4 voice.
    expect(names).toHaveLength(39);
    for (const expected of ['session_status', 'login', 'get_me', 'create_post', 'plan', 'approve', 'show_artifact', 'audit_draft']) {
      expect(names).toContain(expected);
    }
  });

  it('reports no-session honestly before a sign-in', () => {
    const sessionMessage = JSON.parse(stdout.split('\n')[1]) as RpcResponse;
    const text = sessionMessage.result?.content?.[0]?.text ?? '';
    expect(JSON.parse(text)).toEqual({ state: 'no-session', readOnly: false });
  });
});

describe('package: shipped assets', () => {
  it('ships the selector registry JSON inside dist (the published package needs it)', () => {
    const shipped = fileURLToPath(new URL('../dist/registry/selectors.json', import.meta.url));
    expect(existsSync(shipped)).toBe(true);
  });
});
