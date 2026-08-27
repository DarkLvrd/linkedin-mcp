import { describe, expect, it } from 'vitest';
import { aboutForm, skillAddForm, skillDeleteForm } from '../src/sdui/forms.js';
import { SduiClient } from '../src/sdui/client.js';
import { fixtureFetch } from './fixtures/fetch.js';
import type { SessionCookies } from '../src/session/types.js';

const cookies: SessionCookies = {
  li_at: 'AQED-x',
  jsessionid: 'ajax:1',
  csrfToken: 'ajax:1',
  obtainedAt: '2026-08-24T12:00:00.000Z',
};

describe('SDUI form bodies', () => {
  it('skillAddForm: saveProfileSkillForm with MemoryNamespace refs and real values in states[]', () => {
    const body = skillAddForm('TypeScript', 'urn:li:fsd_skill:123');
    const sduiid = 'com.linkedin.sdui.requests.profile.saveProfileSkillForm';
    expect(body.requestId).toBe(sduiid);
    const payload = body.serverRequest.requestedArguments.payload as Record<string, unknown>;
    const skillName = payload['skillName'] as { key: string; namespace: string };
    const skillId = payload['skillId'] as { key: string; namespace: string };
    expect(skillName.namespace).toBe('MemoryNamespace');
    expect(skillId.namespace).toBe('MemoryNamespace');
    // The refs must point at states[] entries carrying the real values.
    const states = (body as unknown as { states: { key: string; value: string }[] }).states;
    expect(states.find((s) => s.key === skillName.key)?.value).toBe('TypeScript');
    expect(states.find((s) => s.key === skillId.key)?.value).toBe('urn:li:fsd_skill:123');
  });

  it('skillDeleteForm: deleteProfileSkillForm carrying the skill ref', () => {
    const body = skillDeleteForm('urn:li:fsd_profileSkill:9');
    expect(body.requestId).toBe('com.linkedin.sdui.requests.profile.deleteProfileSkillForm');
    const payload = body.serverRequest.requestedArguments.payload as Record<string, unknown>;
    const states = (body as unknown as { states: { key: string; value: string }[] }).states;
    const ref = payload['skill'] as { key: string; namespace: string };
    expect(states.find((s) => s.key === ref.key)?.value).toBe('urn:li:fsd_profileSkill:9');
  });

  it('aboutForm: saveProfileAboutForm carrying headline, about, and top-skills', () => {
    const body = aboutForm({ headline: 'New headline', about: 'New about', topSkills: ['TypeScript'] });
    expect(body.requestId).toBe('com.linkedin.sdui.requests.profile.saveProfileAboutForm');
    const states = (body as unknown as { states: { key: string; value: string }[] }).states;
    expect(states.some((s) => s.value === 'New headline')).toBe(true);
    expect(states.some((s) => s.value === 'New about')).toBe(true);
    expect(states.some((s) => s.value === 'TypeScript')).toBe(true);
  });
});

describe('SduiClient', () => {
  const fixtures = {
    '/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.requests.profile.saveProfileSkillForm': {},
    '/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.requests.profile.fetchSkillsCollection': {
      data: {
        elements: [
          {
            entityUrn: 'urn:li:fsd_profileSkill:9',
            skill: { name: 'TypeScript', entityUrn: 'urn:li:fsd_skill:123' },
          },
        ],
      },
    },
  };

  function makeClient() {
    return new SduiClient({
      cookies: () => cookies,
      baseUrl: 'https://www.linkedin.com',
      fetchFn: fixtureFetch(fixtures),
    });
  }

  it('submits to the rsc-action endpoint with the CSRF header and returns ok', async () => {
    const client = makeClient();
    const result = await client.submit('com.linkedin.sdui.requests.profile.saveProfileSkillForm', {});
    expect(result).toEqual({ ok: true });
  });

  it('reads the skills collection back into clean shapes', async () => {
    const client = makeClient();
    const state = await client.readSkills();
    expect(state.skills).toEqual([{ name: 'TypeScript', urn: 'urn:li:fsd_profileSkill:9' }]);
  });
});
