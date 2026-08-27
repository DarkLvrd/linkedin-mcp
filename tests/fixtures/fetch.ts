/**
 * A fetch that replays recorded Voyager fixtures offline, keyed by path.
 * The real VoyagerClient receives this instead of the network, so every read
 * tool is exercised without any live LinkedIn access (spec: Testing Decisions).
 */
export function fixtureFetch(fixtures: Record<string, unknown>): typeof fetch {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const pathname = new URL(url).pathname;
    // Exact pathname match, or a pathname that starts at a segment boundary —
    // so '/voyager/api/me' never matches '/voyager/api/messaging/...'.
    const key = Object.keys(fixtures).find((k) => {
      const keyPath = new URL(k, 'https://fixtures.local').pathname;
      return pathname === keyPath || pathname.startsWith(keyPath + '/');
    });
    if (key === undefined) {
      return new Response(JSON.stringify({ error: 'no fixture for ' + pathname }), {
        status: 404,
        statusText: 'Not Found',
      });
    }
    return new Response(JSON.stringify(fixtures[key]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}
