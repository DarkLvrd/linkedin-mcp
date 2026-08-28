import type { LinkedInTransport } from '../transport/types.js';
import { auditDraft } from '../voice/audit.js';
import type { ActionPreview, ProfileDiff, RenderedPreview } from './types.js';

function profileDiff(args: Record<string, unknown>, profile: { headline: string; about: string }): ProfileDiff {
  const fields: ProfileDiff['fields'] = [];
  if (typeof args['headline'] === 'string') {
    fields.push({ field: 'headline', old: profile.headline, new: args['headline'] });
  }
  if (typeof args['about'] === 'string') {
    fields.push({ field: 'about', old: profile.about, new: args['about'] });
  }
  if (Array.isArray(args['topSkills'])) {
    // The current top-skills order is not readable through the profile read,
    // so the diff shows the new value only.
    fields.push({ field: 'topSkills', new: (args['topSkills'] as string[]).join(', ') });
  }
  return { fields };
}

function renderedPreview(rendered: RenderedPreview, args: Record<string, unknown>): ActionPreview {
  return {
    kind: 'rendered',
    summary: `${rendered.type === 'post' ? 'Post' : 'Message'}: ${rendered.text.slice(0, 80)}`,
    rendered,
    // The AI-tell audit rides along on every outbound text preview (ticket 18).
    audit: auditDraft(rendered.text),
    raw: args,
  };
}

/**
 * Builds the per-action preview: field-level diffs for profile changes,
 * feed-style rendered previews for posts and messages, a generic summary with
 * the raw args for everything else. The raw args are always present — that is
 * the raw toggle.
 */
export async function buildPreview(
  transport: LinkedInTransport,
  tool: string,
  args: Record<string, unknown>,
): Promise<ActionPreview> {
  if (tool === 'update_profile') {
    const profile = await transport.getProfile('me');
    const diff = profileDiff(args, profile);
    return {
      kind: 'profile-diff',
      summary: diff.fields.map((f) => `${f.field}: ${f.old ?? ''} → ${f.new}`).join('; '),
      diff,
      raw: args,
    };
  }
  if (tool === 'create_post') {
    const me = await transport.getMe();
    const text = typeof args['text'] === 'string' ? args['text'] : '';
    return renderedPreview({ type: 'post', author: `${me.firstName} ${me.lastName}`, text }, args);
  }
  if (tool === 'edit_post') {
    const me = await transport.getMe();
    const text = typeof args['text'] === 'string' ? args['text'] : '';
    return renderedPreview(
      { type: 'post', author: `${me.firstName} ${me.lastName}`, text, target: String(args['postId'] ?? '') },
      args,
    );
  }
  if (tool === 'send_message') {
    const text = typeof args['text'] === 'string' ? args['text'] : '';
    return renderedPreview(
      { type: 'message', text, target: String(args['conversationUrn'] ?? '') },
      args,
    );
  }
  return {
    kind: 'generic',
    summary: `${tool} with ${JSON.stringify(args)}`,
    raw: args,
  };
}
