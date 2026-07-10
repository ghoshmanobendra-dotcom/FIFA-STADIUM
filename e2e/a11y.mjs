/**
 * End-to-end + automated accessibility suite.
 *
 * Boots the real app, drives every feature panel in a headless browser, and
 * runs axe-core (WCAG 2.1 A/AA rule set) against each panel's rendered state.
 * Fails the process on any functional error, console error, or accessibility
 * violation.
 *
 * Kept OUT of `npm test` (which stays hermetic and browserless) and run via
 * `npm run test:e2e`, so unit/integration testing never depends on a browser.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createApp } from '../src/app.js';

const here = dirname(fileURLToPath(import.meta.url));
const axeSource = readFileSync(join(here, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

const CHROME_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].filter(Boolean);

async function launch() {
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    for (const executablePath of CHROME_CANDIDATES) {
      try {
        return await chromium.launch({ headless: true, executablePath });
      } catch {
        /* try next */
      }
    }
    throw err;
  }
}

async function runAxe(page, label) {
  await page.evaluate(axeSource);
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
  });
  if (results.violations.length) {
    console.error(`\n✗ axe violations on "${label}":`);
    for (const v of results.violations) {
      console.error(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node/s)`);
      for (const n of v.nodes) {
        console.error(`     target: ${JSON.stringify(n.target)}`);
        if (n.any?.[0]?.message) console.error(`     why: ${n.any[0].message}`);
      }
      console.error(`     ${v.helpUrl}`);
    }
  }
  assert.equal(results.violations.length, 0, `accessibility violations on ${label}`);
  console.log(`✓ a11y clean: ${label}`);
}

async function main() {
  const app = createApp();
  const server = await new Promise((res) => {
    const s = app.listen(0, () => res(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  const browser = await launch();
  const page = await browser.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.addStyleTag({
      content: '* { animation: none !important; transition: none !important; }',
    });
    await runAxe(page, 'Concierge (initial load)');

    // Concierge
    await page.fill('#concierge-question', 'Where can I recycle my bottle?');
    await page.click('#concierge-form button[type=submit]');
    await page.waitForSelector('#concierge-output h3');
    await runAxe(page, 'Concierge (answered)');

    // Wayfinding + SVG route map
    await page.click('#tab-navigate');
    await page.check('#navigate-accessible');
    await page.click('#navigate-form button[type=submit]');
    await page.waitForSelector('#navigate-output svg.route-map');
    const nodes = await page.$$eval('#navigate-output .route-map circle', (c) => c.length);
    assert.ok(nodes >= 2, 'route map should render nodes');
    const mapText = await page.textContent('#navigate-output .route-map');
    assert.doesNotMatch(mapText, /undefined/, 'route map node labels must resolve to names');
    await runAxe(page, 'Wayfinding (route rendered)');

    // Ops: incident triage
    await page.click('#tab-ops');
    await page.selectOption('#incident-type', 'fire');
    await page.selectOption('#incident-severity', 'critical');
    await page.fill('#incident-zone', 'Upper Concourse');
    await page.click('#incident-form button[type=submit]');
    await page.waitForSelector('#incident-output .pill');
    assert.equal((await page.textContent('#incident-output .pill')).trim(), 'P1');
    await runAxe(page, 'Crowd & Ops (incident triaged)');

    // Volunteer briefing (same panel)
    await page.selectOption('#briefing-role', 'accessibility-host');
    await page.click('#briefing-form button[type=submit]');
    await page.waitForSelector('#briefing-output h3');
    await runAxe(page, 'Crowd & Ops (volunteer briefing)');

    // Announce
    await page.click('#tab-announce');
    await page.click('#announce-form button[type=submit]');
    await page.waitForSelector('#announce-output .ann-item');
    await page.waitForSelector('#announce-output[aria-busy="false"]');
    await runAxe(page, 'Announce (multilingual)');

    // Green travel
    await page.click('#tab-green');
    await page.click('#green-form button[type=submit]');
    await page.waitForSelector('#green-output .rank li.best');
    await page.waitForSelector('#green-output[aria-busy="false"]');
    await runAxe(page, 'Green travel (ranked)');

    // Match plan
    await page.click('#tab-plan');
    await page.click('#plan-form button[type=submit]');
    await page.waitForSelector('#plan-output');
    await page.waitForSelector('#plan-output[aria-busy="false"]');
    await runAxe(page, 'Match plan');

    // Translate
    await page.click('#tab-translate');
    await page.fill('#translate-text', 'Gate C is now open.');
    await page.click('#translate-form button[type=submit]');
    await page.waitForSelector('#translate-output h3');
    await page.waitForSelector('#translate-output[aria-busy="false"]');
    await runAxe(page, 'Translate');

    // Re-scan key panels under the dark colour scheme to catch theme-specific
    // contrast regressions (axe defaults to the light theme).
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.click('#tab-ops');
    await runAxe(page, 'Crowd & Ops (dark theme)');
    await page.click('#tab-concierge');
    await runAxe(page, 'Concierge (dark theme)');

    assert.equal(errors.length, 0, `console/page errors: ${errors.join(' | ')}`);
    console.log('\n✓ All panels functional, 0 console errors, 0 accessibility violations.');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
