import type { SessionCookies } from './types.js';

/**
 * The cookie + CSRF header set every LinkedIn API request carries. Shared by
 * the Voyager and SDUI transports so the redaction boundary is one place.
 */
export function linkedinHeaders(cookies: SessionCookies): Record<string, string> {
  return {
    cookie: `li_at=${cookies.li_at}${cookies.jsessionid !== undefined ? `; JSESSIONID=${cookies.jsessionid}` : ''}`,
    ...(cookies.csrfToken !== undefined ? { 'csrf-token': cookies.csrfToken } : {}),
  };
}
