import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const USER = 'darklvrd';
const PROFILE = join(homedir(), '.agentic-linkedin', 'npm-bot-profile');
const TOKEN_OUT = join(homedir(), '.agentic-linkedin', 'npm-token.txt');

const context = await chromium.launchPersistentContext(PROFILE, { headless: false, viewport: { width: 1280, height: 950 } });
const page = context.pages()[0] ?? (await context.newPage());

await page.goto(`https://www.npmjs.com/settings/${USER}/tokens`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.getByRole('link', { name: /Generate New Token/i }).click();
await page.waitForTimeout(1200);

await page.locator('input[name=tokenName]').fill('agentic-linkedin-publish');
await page.getByText('Read and write', { exact: true }).first().click();
await page.waitForTimeout(800);
// "All packages" is the first selectedPackagesAndScopes radio.
await page.locator('input[name=selectedPackagesAndScopes]').first().check().catch(() => console.log('WARN: all-packages radio'));
await page.waitForTimeout(400);
await page.locator('input[name=bypass2FA]').check().catch(() => console.log('WARN: bypass check'));

// Show what the summary says right before generating.
const summary = await page.evaluate(() => {
  const body = document.body.innerText;
  const idx = body.indexOf('Summary');
  return idx >= 0 ? body.slice(idx, idx + 500) : 'no summary';
});
console.log('SUMMARY_PRE_GEN:');
console.log(summary);

await page.getByRole('button', { name: /Generate token/i }).click().catch(() => console.log('WARN: generate'));
await page.waitForTimeout(4000);

// Whatever comes next, grab the page text and hunt for the token.
const after = await page.evaluate(() => document.body.innerText.slice(0, 3000));
console.log('AFTER_GEN_TEXT_START');
console.log(after);
console.log('AFTER_GEN_TEXT_END');

let token = '';
const match = after.match(/npm_[A-Za-z0-9]{10,}/);
if (match) {
  token = match[0];
} else {
  for (const selector of ['input[readonly]', 'code', 'textarea']) {
    try {
      const value = await page.locator(selector).first().inputValue().catch(async () => (await page.locator(selector).first().textContent()) ?? '');
      if (value && value.trim().length > 10) token = value.trim();
      if (token) break;
    } catch {
      /* next */
    }
  }
}
if (token !== '') {
  writeFileSync(TOKEN_OUT, token);
  console.log(`TOKEN_SAVED: ${TOKEN_OUT}`);
} else {
  console.log('NO_TOKEN_YET');
}
await context.close();
