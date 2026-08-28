/**
 * The AI-tell audit (ticket 18): scans a draft for the phrasing patterns that
 * reveal machine-written text and returns suggested fixes — guidance, never
 * rewrites. The agent applies the suggestions; the server only reports.
 */

export interface AuditFinding {
  rule: string;
  message: string;
  suggestion: string;
}

export interface AuditResult {
  score: 'human' | 'suspect' | 'machine';
  findings: AuditFinding[];
}

const INFLATED = [
  'unleash',
  'unlock',
  'elevate',
  'game-changing',
  'game changer',
  'revolutionize',
  'revolutionise',
  'seamless',
  'transformative',
  'cutting-edge',
  'delve',
  'supercharge',
  'empower',
  'harness',
];

const FORMULAIC = [
  "in today's fast-paced",
  "it's no secret that",
  "i'm excited to share",
  'let me be clear',
  'as we all know',
  'in conclusion',
  "whether you're a",
  'the future of',
  'the key to',
  'at its core',
];

const CHATBOT = [
  "i'd be happy to help",
  'absolutely!',
  'great question',
  "let's dive in",
  'at the end of the day',
  'in the world of',
  'when it comes to',
  'as an ai',
  'delve into',
  'elevate your',
  "here's the thing",
  "let's unpack",
];

function finding(rule: string, message: string, suggestion: string): AuditFinding {
  return { rule, message, suggestion };
}

function matchAny(text: string, phrases: string[]): string[] {
  return phrases.filter((phrase) => text.includes(phrase));
}

/** Counts sentence openers; three repeats of the same word is robotic rhythm. */
function repeatedOpeners(text: string): string | null {
  const openers = text
    .toLowerCase()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().split(/\s+/)[0])
    .filter((word): word is string => word !== undefined && /[\p{L}]/u.test(word));
  const counts = new Map<string, number>();
  for (const opener of openers) {
    counts.set(opener, (counts.get(opener) ?? 0) + 1);
  }
  for (const [opener, count] of counts) {
    if (count >= 3) {
      return opener;
    }
  }
  return null;
}

export function auditDraft(text: string): AuditResult {
  const lower = text.toLowerCase();
  const findings: AuditFinding[] = [];

  const inflated = matchAny(lower, INFLATED);
  if (inflated.length > 0) {
    findings.push(
      finding(
        'inflated-claims',
        `overblown words: ${inflated.join(', ')}`,
        'swap these for plainer words a person would actually say',
      ),
    );
  }

  const formulaic = matchAny(lower, FORMULAIC);
  if (formulaic.length > 0) {
    findings.push(
      finding(
        'formulaic-structure',
        `formulaic phrases: ${formulaic.join(', ')}`,
        'cut the template opener and start with the concrete detail',
      ),
    );
  }

  const dashes = (text.match(/—/g) ?? []).length;
  if (dashes > 2) {
    findings.push(
      finding('em-dash-overuse', `${dashes} em dashes in one draft`, 'use commas or full stops instead of most dashes'),
    );
  }

  const chatbot = matchAny(lower, CHATBOT);
  if (chatbot.length > 0) {
    findings.push(
      finding('chatbot-phrasing', `chatbot phrases: ${chatbot.join(', ')}`, 'say it like you would in a conversation'),
    );
  }

  const opener = repeatedOpeners(text);
  if (opener !== null) {
    findings.push(
      finding(
        'robotic-rhythm',
        `"${opener}" starts ${3} sentences`,
        'vary the sentence openings so the rhythm sounds human',
      ),
    );
  }

  const score: AuditResult['score'] = findings.length === 0 ? 'human' : findings.length <= 2 ? 'suspect' : 'machine';
  return { score, findings };
}
