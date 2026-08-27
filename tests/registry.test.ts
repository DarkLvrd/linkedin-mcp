import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRegistry } from '../src/registry/registry.js';
import { FakeDom } from './fixtures/dom.js';

describe('selector registry', () => {
  it('loads the shipped selectors and resolves the first strategy the DOM finds', () => {
    const registry = createRegistry();
    const dom = new FakeDom(['[aria-label="Start a post"]']);
    const resolved = registry.resolve('feed.startPostButton', dom);
    expect(resolved).toEqual({ kind: 'aria-label', value: 'Start a post' });
  });

  it('tries strategies in the fixed order: aria-label → role → data-test → text → css', () => {
    const registry = createRegistry();
    // An entry carrying all five kinds, applied via the overlay (the update-registry path).
    registry.applyOverlay({
      id: 'profile.headlineField',
      strategies: [
        { kind: 'aria-label', value: 'Headline' },
        { kind: 'role', value: 'textbox' },
        { kind: 'data-test', value: 'headline' },
        { kind: 'text', value: 'Headline' },
        { kind: 'css', value: 'div.headline-editor' },
      ],
    });
    // The DOM only matches the role strategy — lookup must still find it.
    const domRoleOnly = new FakeDom(['[role="textbox"]']);
    expect(registry.resolve('profile.headlineField', domRoleOnly)).toEqual({ kind: 'role', value: 'textbox' });
    // Only a visible-text match — falls through aria-label, role, data-test.
    const domTextOnly = new FakeDom(['text="Headline"']);
    expect(registry.resolve('profile.headlineField', domTextOnly)).toEqual({ kind: 'text', value: 'Headline' });
    // Only a structural (css) match — last resort, still found.
    const domCssOnly = new FakeDom(['div.headline-editor']);
    expect(registry.resolve('profile.headlineField', domCssOnly)).toEqual({
      kind: 'css',
      value: 'div.headline-editor',
    });
    // Nothing matches — null, and a suggestion is recorded.
    const domEmpty = new FakeDom([]);
    expect(registry.resolve('profile.headlineField', domEmpty)).toBeNull();
    expect(registry.suggestions()).toEqual([
      expect.objectContaining({ selectorId: 'profile.headlineField' }),
    ]);
  });

  it('returns null for an unknown selector without recording a suggestion', () => {
    const registry = createRegistry();
    expect(registry.resolve('nope.neverRegistered', new FakeDom([]))).toBeNull();
    expect(registry.suggestions()).toEqual([]);
  });

  it('reads an overlay file on reload: overrides shipped entries, adds new ones, no redeploy', () => {
    const dir = mkdtempSync(join(tmpdir(), 'registry-test-'));
    const overlayPath = join(dir, 'overlay.json');
    try {
      // Shipped entry resolves to its aria-label strategy.
      const registry = createRegistry({ overlayPath });
      const domAria = new FakeDom(['[aria-label="Start a post"]']);
      expect(registry.resolve('feed.startPostButton', domAria)).toEqual({
        kind: 'aria-label',
        value: 'Start a post',
      });

      // A fix lands in the overlay file; the registry has not restarted.
      writeFileSync(
        overlayPath,
        JSON.stringify({
          selectors: [
            {
              id: 'feed.startPostButton',
              strategies: [{ kind: 'css', value: 'div.new-composer' }],
            },
            {
              id: 'feed.newButton',
              strategies: [{ kind: 'text', value: 'New button' }],
            },
          ],
        }),
      );
      registry.reload();

      // The override wins, even though the shipped aria-label would match.
      const domBoth = new FakeDom(['[aria-label="Start a post"]', 'div.new-composer']);
      expect(registry.resolve('feed.startPostButton', domBoth)).toEqual({
        kind: 'css',
        value: 'div.new-composer',
      });
      // The overlay-added entry resolves too.
      expect(registry.resolve('feed.newButton', new FakeDom(['text="New button"']))).toEqual({
        kind: 'text',
        value: 'New button',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
