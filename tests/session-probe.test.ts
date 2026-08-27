import { createServer, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { VoyagerHealthProbe } from '../src/session/probe.js';
import type { SessionCookies } from '../src/session/types.js';

const cookies: SessionCookies = { li_at: 'AQED-x', obtainedAt: '2026-08-24T12:00:00.000Z' };

const servers: Server[] = [];

type Handler = (
  url: string | undefined,
  res: ServerResponse,
  headers: Record<string, string | undefined>,
) => void;

function startServer(handler: Handler): string {
  const server = createServer((req, res) => {
    handler(req.url, res, req.headers as Record<string, string | undefined>);
    res.end();
  });
  servers.push(server);
  server.listen(0);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('test server did not bind');
  }
  return `http://127.0.0.1:${address.port}`;
}

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.close();
  }
});

describe('VoyagerHealthProbe', () => {
  it('reports healthy on HTTP 200 and sends the CSRF token', async () => {
    const baseUrl = startServer((url, _res, headers) => {
      expect(url).toBe('/voyager/api/me');
      expect(headers['csrf-token']).toBe('csrf:token');
    });
    const probe = new VoyagerHealthProbe(baseUrl);
    const result = await probe.probe({ ...cookies, csrfToken: 'csrf:token' });
    expect(result).toEqual({ health: 'healthy' });
  });

  it('reports unhealthy with 401', async () => {
    const baseUrl = startServer((_url, res) => {
      res.statusCode = 401;
    });
    const probe = new VoyagerHealthProbe(baseUrl);
    expect(await probe.probe(cookies)).toEqual({ health: 'unhealthy', reason: '401' });
  });

  it('reports unhealthy with 403 (CSRF missing or rejected)', async () => {
    const baseUrl = startServer((_url, res) => {
      res.statusCode = 403;
    });
    const probe = new VoyagerHealthProbe(baseUrl);
    expect(await probe.probe(cookies)).toEqual({ health: 'unhealthy', reason: '403-CSRF' });
  });

  it('reports unhealthy when the API redirects to itself (session challenged)', async () => {
    const baseUrl = startServer((_url, res) => {
      res.statusCode = 302;
      res.setHeader('location', `${baseUrl}/voyager/api/me`);
    });
    const probe = new VoyagerHealthProbe(baseUrl);
    expect(await probe.probe(cookies)).toEqual({ health: 'unhealthy', reason: 'redirect-to-self' });
  });

  it('reports unhealthy when the probe cannot reach the API (never throws)', async () => {
    const probe = new VoyagerHealthProbe('http://127.0.0.1:1');
    const result = await probe.probe(cookies);
    expect(result.health).toBe('unhealthy');
  });
});
