import type { SessionCookies } from '../session/types.js';
import { linkedinHeaders } from '../session/cookies.js';

const DEFAULT_BASE_URL = 'https://www.linkedin.com';
const RSC_ACTION_PATH = '/flagship-web/rsc-action/actions/server-request';
const FETCH_SKILLS = 'com.linkedin.sdui.requests.profile.fetchSkillsCollection';

export interface SkillsState {
  skills: { name: string; urn: string }[];
}

export interface SduiClientOptions {
  cookies: SessionCookies | (() => SessionCookies | null);
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

/**
 * The SDUI write transport: profile edits, skills, and deletes all POST to the
 * rsc-action endpoint with the CSRF header (research ticket 01). No Voyager
 * DELETE is ever used — it returns constant 400; deletes go through SDUI.
 */
export class SduiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly cookiesProvider: SessionCookies | (() => SessionCookies | null);

  constructor(options: SduiClientOptions) {
    this.cookiesProvider = options.cookies;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private currentCookies(): SessionCookies | null {
    return typeof this.cookiesProvider === 'function' ? this.cookiesProvider() : this.cookiesProvider;
  }

  async submit(sduiid: string, body: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
    const cookies = this.currentCookies();
    if (cookies === null) {
      return { ok: false, error: 'no LinkedIn session — run login first' };
    }
    const headers: Record<string, string> = {
      'content-type': 'application/json; charset=UTF-8',
      ...linkedinHeaders(cookies),
    };
    let response: Response;
    try {
      response = await this.fetchFn(
        `${this.baseUrl}${RSC_ACTION_PATH}?sduiid=${encodeURIComponent(sduiid)}`,
        { method: 'POST', headers, body: JSON.stringify(body), redirect: 'manual' },
      );
    } catch {
      return { ok: false, error: 'SDUI request failed — network unreachable' };
    }
    if (response.status === 200 || response.status === 201) {
      return { ok: true };
    }
    if (response.status === 401) {
      return { ok: false, error: 'session expired (401) — run login again' };
    }
    if (response.status === 403) {
      return { ok: false, error: 'session expired (403-CSRF) — run login again' };
    }
    return { ok: false, error: `SDUI request failed: HTTP ${response.status}` };
  }

  async readSkills(): Promise<SkillsState> {
    const cookies = this.currentCookies();
    if (cookies === null) {
      return { skills: [] };
    }
    const response = await this.fetchFn(
      `${this.baseUrl}${RSC_ACTION_PATH}?sduiid=${encodeURIComponent(FETCH_SKILLS)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          ...linkedinHeaders(cookies),
        },
        body: '{}',
        redirect: 'manual',
      },
    );
    if (!response.ok) {
      return { skills: [] };
    }
    const raw = (await response.json()) as { data?: { elements?: unknown[] } };
    return {
      skills: (raw.data?.elements ?? []).map((element) => {
        const record = element as Record<string, unknown>;
        const skill = (record['skill'] ?? record) as Record<string, unknown>;
        return {
          name: typeof skill['name'] === 'string' ? (skill['name'] as string) : '',
          urn: typeof record['entityUrn'] === 'string' ? (record['entityUrn'] as string) : '',
        };
      }),
    };
  }
}
