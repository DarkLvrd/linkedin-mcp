import { describe, expect, it } from 'vitest';
import { auditDraft } from '../src/voice/audit.js';

const MACHINE_TEXT =
  "In today's fast-paced world, let's dive in and unlock the secrets of success — it's no secret that we must elevate our game — the key to growth is harnessing transformative tools — when it comes to the future of work, absolutely! — let me be clear, I'm excited to share the game-changing results — delve into the data, unleash your potential, empower your team, supercharge your results — seamless, cutting-edge, revolutionary — I'd be happy to help — at the end of the day, we're the best. We must act now. We must act fast. We must act boldly.";

const HUMAN_TEXT =
  'Shipped the connector this morning. The rollout went smoother than expected. Two customers already noticed the speedup. Next up: docs, then the blog post.';

describe('auditDraft', () => {
  it('flags every AI-tell rule on machine-written text', () => {
    const result = auditDraft(MACHINE_TEXT);
    expect(result.score).toBe('machine');
    const rules = result.findings.map((f) => f.rule);
    expect(rules).toContain('inflated-claims');
    expect(rules).toContain('formulaic-structure');
    expect(rules).toContain('em-dash-overuse');
    expect(rules).toContain('chatbot-phrasing');
    expect(rules).toContain('robotic-rhythm');
  });

  it('returns suggested fixes, never rewrites', () => {
    const result = auditDraft(MACHINE_TEXT);
    for (const finding of result.findings) {
      expect(typeof finding.suggestion).toBe('string');
      expect(finding.suggestion.length).toBeGreaterThan(0);
    }
    // The audit only reports; it never produces replacement text.
    expect(Object.keys(result).sort()).toEqual(['findings', 'score']);
  });

  it('passes human-written text clean', () => {
    const result = auditDraft(HUMAN_TEXT);
    expect(result.score).toBe('human');
    expect(result.findings).toEqual([]);
  });

  it('flags em-dash overuse only beyond two dashes', () => {
    const twoDashes = auditDraft('a — b — c. done.');
    expect(twoDashes.findings.some((f) => f.rule === 'em-dash-overuse')).toBe(false);
    const threeDashes = auditDraft('a — b — c — d. done.');
    expect(threeDashes.findings.some((f) => f.rule === 'em-dash-overuse')).toBe(true);
  });

  it('flags robotic rhythm when the same sentence opener repeats three times', () => {
    const result = auditDraft('We must ship it. We must test it. We must tell people.');
    expect(result.findings.some((f) => f.rule === 'robotic-rhythm')).toBe(true);
  });
});
