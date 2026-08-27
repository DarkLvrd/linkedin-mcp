import { describe, expect, it } from 'vitest';
import { LinkedInHttpClient } from '../src/voyager/client.js';
import { fixtureFetch } from './fixtures/fetch.js';
import type { SessionCookies } from '../src/session/types.js';

const cookies: SessionCookies = {
  li_at: 'AQED-x',
  jsessionid: 'ajax:1',
  csrfToken: 'ajax:1',
  obtainedAt: '2026-08-24T12:00:00.000Z',
};

const SAVE_SKILL = '?sduiid=com.linkedin.sdui.requests.profile.saveProfileSkillForm';
const DELETE_SKILL = '?sduiid=com.linkedin.sdui.requests.profile.deleteProfileSkillForm';
const SAVE_ABOUT = '?sduiid=com.linkedin.sdui.requests.profile.saveProfileAboutForm';
const DELETE_SECTION = '?sduiid=com.linkedin.sdui.requests.profile.deleteProfilePositionForm';
const FETCH_SKILLS = '?sduiid=com.linkedin.sdui.requests.profile.fetchSkillsCollection';

const RSC = '/flagship-web/rsc-action/actions/server-request';

function makeClient(fixtures: Record<string, unknown>, methodLog: string[]) {
  const loggedFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    methodLog.push(`${init?.method ?? 'GET'} ${new URL(url).pathname}`);
    return fixtureFetch(fixtures)(input, init);
  };
  return new LinkedInHttpClient({
    cookies,
    baseUrl: 'https://www.linkedin.com',
    fetchFn: loggedFetch,
  });
}

describe('LinkedInHttpClient writes (SDUI + read-back verification)', () => {
  it('updateProfile submits the About form and returns the verified profile', async () => {
    const fixtures = {
      [RSC + SAVE_ABOUT]: {},
      '/voyager/api/identity/dash/profiles': {
        profile: {
          id: 'urn:li:member:42',
          firstName: { localized: { en_US: 'Muizz' } },
          lastName: { localized: { en_US: 'Bankole' } },
          headline: 'New headline',
          location: { localized: { en_US: 'Toronto, Canada' } },
          summary: { text: 'New about' },
        },
      },
    };
    const methods: string[] = [];
    const client = makeClient(fixtures, methods);
    const profile = await client.updateProfile({ headline: 'New headline', about: 'New about' });
    expect(profile.headline).toBe('New headline');
    expect(profile.about).toBe('New about');
  });

  it('addSkill submits the add form and verifies by skills read-back', async () => {
    const fixtures = {
      [RSC + SAVE_SKILL]: {},
      [RSC + FETCH_SKILLS]: {
        data: { elements: [{ entityUrn: 'urn:li:fsd_profileSkill:9', skill: { name: 'TypeScript' } }] },
      },
    };
    const methods: string[] = [];
    const client = makeClient(fixtures, methods);
    const state = await client.addSkill('TypeScript');
    expect(state.skills).toEqual([{ name: 'TypeScript', urn: 'urn:li:fsd_profileSkill:9' }]);
  });

  it('removeSkill submits the delete form and verifies the skill is gone', async () => {
    const fixtures = {
      [RSC + DELETE_SKILL]: {},
      [RSC + FETCH_SKILLS]: { data: { elements: [] } },
    };
    const methods: string[] = [];
    const client = makeClient(fixtures, methods);
    const state = await client.removeSkill('urn:li:fsd_profileSkill:9');
    expect(state.skills).toEqual([]);
  });

  it('reorderSkills submits the About form top-skills and verifies the order', async () => {
    const fixtures = {
      [RSC + SAVE_ABOUT]: {},
      [RSC + FETCH_SKILLS]: {
        data: {
          elements: [
            { entityUrn: 'urn:li:fsd_profileSkill:2', skill: { name: 'TypeScript' } },
            { entityUrn: 'urn:li:fsd_profileSkill:1', skill: { name: 'PHP' } },
          ],
        },
      },
    };
    const methods: string[] = [];
    const client = makeClient(fixtures, methods);
    const state = await client.reorderSkills(['TypeScript', 'PHP']);
    expect(state.skills.map((s) => s.name)).toEqual(['TypeScript', 'PHP']);
  });

  it('deleteGhostEntry routes the delete through SDUI', async () => {
    const fixtures = { [RSC + DELETE_SECTION]: {} };
    const methods: string[] = [];
    const client = makeClient(fixtures, methods);
    const result = await client.deleteGhostEntry({ section: 'position', urn: 'urn:li:fsd_profilePosition:77' });
    expect(result).toEqual({ ok: true });
  });

  it('never uses Voyager DELETE anywhere in the write path', async () => {
    const fixtures = {
      [RSC + SAVE_SKILL]: {},
      [RSC + DELETE_SKILL]: {},
      [RSC + SAVE_ABOUT]: {},
      [RSC + DELETE_SECTION]: {},
      [RSC + FETCH_SKILLS]: { data: { elements: [] } },
      '/voyager/api/identity/dash/profiles': { profile: {} },
    };
    const methods: string[] = [];
    const client = makeClient(fixtures, methods);
    await client.updateProfile({ headline: 'H' });
    await client.addSkill('TypeScript');
    await client.removeSkill('urn:li:fsd_profileSkill:9');
    await client.reorderSkills(['TypeScript']);
    await client.deleteGhostEntry({ section: 'position', urn: 'urn:li:fsd_profilePosition:77' });
    expect(methods.every((m) => !m.startsWith('DELETE'))).toBe(true);
    expect(methods.some((m) => m.startsWith('POST'))).toBe(true);
  });
});
