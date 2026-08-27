import type { HealthProbe, SessionCookies } from './types.js';

const DEFAULT_BASE_URL = 'https://www.linkedin.com';

/**
 * Probes the session with a minimal Voyager call (GET /voyager/api/me) and
 * interprets the failure modes LinkedIn actually uses:
 * 401 = dead session, 403 = CSRF missing/rejected, redirect-to-self = the
 * session is being challenged. Never throws — an unreachable API is
 * "unhealthy", not a crash.
 */
export class VoyagerHealthProbe implements HealthProbe {
  constructor(private readonly baseUrl: string = DEFAULT_BASE_URL) {}

  async probe(cookies: SessionCookies): Promise<{ health: 'healthy' | 'unhealthy'; reason?: string }> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/voyager/api/me`, {
        headers: {
          cookie: `li_at=${cookies.li_at}${cookies.jsessionid ? `; JSESSIONID=${cookies.jsessionid}` : ''}`,
          ...(cookies.csrfToken !== undefined ? { 'csrf-token': cookies.csrfToken } : {}),
        },
        redirect: 'manual',
      });
    } catch {
      return { health: 'unhealthy', reason: 'unreachable' };
    }

    if (response.status === 200) {
      return { health: 'healthy' };
    }
    if (response.status === 401) {
      return { health: 'unhealthy', reason: '401' };
    }
    if (response.status === 403) {
      return { health: 'unhealthy', reason: '403-CSRF' };
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location !== null && location.includes('/voyager/api/')) {
      return { health: 'unhealthy', reason: 'redirect-to-self' };
    }
    return { health: 'unhealthy', reason: `http-${response.status}` };
  }
}
