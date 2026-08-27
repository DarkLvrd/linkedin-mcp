import type { Browser, BrowserContext } from 'playwright';
import type { BrowserSession, SessionCookies } from './types.js';

const LOGIN_URL = 'https://www.linkedin.com/login';

/**
 * The one-time sign-in window. Playwright is imported lazily so the rest of
 * the server (and its tests) never needs a browser installed. The window is
 * headful on purpose: a human signs in, and a real login is never automated.
 */
export class PlaywrightBrowserSession implements BrowserSession {
  private browser: Browser | null = null;

  async loginAndCollectCookies(timeoutMs: number): Promise<SessionCookies | null> {
    const { chromium } = await import('playwright');
    const context: BrowserContext = await chromium.launchPersistentContext('', {
      headless: false,
      channel: 'chromium',
      viewport: { width: 1280, height: 800 },
    });
    this.browser = context.browser();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    try {
      const page = await context.newPage();
      await page.goto(LOGIN_URL);
      // Sign-in success is LinkedIn redirecting to the feed. Wait for that
      // redirect (or the window being closed) rather than a fixed sleep.
      await page.waitForURL('**/feed/**', { timeout: timeoutMs });
    } catch {
      // Timed out, or the window was closed before the sign-in completed.
      await context.close().catch(() => {});
      return null;
    }

    // Capture cookies while the context is still open, then close.
    const allCookies = await context.cookies('https://www.linkedin.com');
    const li_at = allCookies.find((c) => c.name === 'li_at')?.value;
    if (li_at === undefined) {
      await context.close();
      return null;
    }
    const jsessionid = allCookies.find((c) => c.name === 'JSESSIONID')?.value;
    // The web app sends the JSESSIONID value as the CSRF token header.
    const csrfToken = jsessionid;

    await context.close();
    return {
      li_at,
      ...(jsessionid !== undefined ? { jsessionid } : {}),
      ...(csrfToken !== undefined ? { csrfToken } : {}),
      obtainedAt: new Date().toISOString(),
    };
  }

  async close(): Promise<void> {
    if (this.browser !== null) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
