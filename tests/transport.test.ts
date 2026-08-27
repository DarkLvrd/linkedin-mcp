import { describe, expect, it } from 'vitest';
import { FakeTransport } from '../src/transport/fake.js';
import type { LinkedInTransport, SessionStatus } from '../src/transport/types.js';

describe('LinkedInTransport contract (FakeTransport)', () => {
  it('reports a healthy session when configured healthy', async () => {
    const transport: LinkedInTransport = new FakeTransport({ state: 'healthy' });
    const status = await transport.getSessionStatus();
    expect(status).toEqual({ state: 'healthy', readOnly: false });
  });

  it('reports an unhealthy session with the reason from the transport', async () => {
    const transport = new FakeTransport({ state: 'unhealthy', reason: 'authwall' });
    const status = await transport.getSessionStatus();
    expect(status).toEqual({ state: 'unhealthy', reason: 'authwall', readOnly: false });
  });

  it('reports no-session before a sign-in exists', async () => {
    const transport = new FakeTransport({ state: 'no-session' });
    const status = await transport.getSessionStatus();
    expect(status).toEqual({ state: 'no-session', readOnly: false });
  });

  it('exposes the read-only flag set at construction', async () => {
    const transport = new FakeTransport({ state: 'healthy', readOnly: true });
    const status: SessionStatus = await transport.getSessionStatus();
    expect(status.readOnly).toBe(true);
  });
});
