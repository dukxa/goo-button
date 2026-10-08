import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const REPORT_DIR = 'test-results/axe';

// color-contrast: axe 4.13 reports 1.37 for oklch text that measures 6.26:1 by the wcag formula, checked by hand in devtools
const EXCLUDED_RULES = ['color-contrast'];

// closed accordion panels use a transition, wait until they are hidden before scanning
const CLOSED_PANELS = '.accordion-item:not([data-open]) .accordion-content';

const analyze = (page) => new AxeBuilder({ page })
  .withTags(TAGS)
  .disableRules(EXCLUDED_RULES)
  .analyze();

const summarize = (violations) => violations.map((v) => ({
  id: v.id,
  impact: v.impact,
  help: v.help,
  helpUrl: v.helpUrl,
  nodes: v.nodes.map((n) => ({ target: n.target.join(' '), failure: n.failureSummary })),
}));

const report = (name, violations) => {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(`${REPORT_DIR}/${name}.json`, JSON.stringify(violations, null, 2));
};

const SCHEMES = ['light', 'dark'];

for (const scheme of SCHEMES) {
  test.describe(`axe, ${scheme} scheme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/demo/');
      await expect(page.locator('#demo .goo-inner')).toBeAttached();
      await page.waitForLoadState('load');
      await expect(page.locator(CLOSED_PANELS).first()).toHaveCSS('visibility', 'hidden');
    });

    test('resting state', async ({ page }, info) => {
      const violations = summarize((await analyze(page)).violations);
      report(`${info.project.name}-${scheme}-rest`, violations);
      expect(violations, 'resting state').toEqual([]);
    });

    test('drop open (keep-open switch)', async ({ page }, info) => {
      await page.locator('#keep-open').check();
      await page.waitForTimeout(800);

      const violations = summarize((await analyze(page)).violations);
      report(`${info.project.name}-${scheme}-open`, violations);
      expect(violations, 'drop open').toEqual([]);
    });

    test('keyboard focus ring', async ({ page }, info) => {
      await page.locator('#demo').focus();
      await page.keyboard.press('Shift');
      await page.waitForTimeout(800);

      const violations = summarize((await analyze(page)).violations);
      report(`${info.project.name}-${scheme}-focus`, violations);
      expect(violations, 'focus ring').toEqual([]);
    });

    test('disabled state', async ({ page }, info) => {
      await page.locator('#demo').evaluate((node) => node.setAttribute('aria-disabled', 'true'));
      await page.waitForTimeout(300);

      const violations = summarize((await analyze(page)).violations);
      report(`${info.project.name}-${scheme}-disabled`, violations);
      expect(violations, 'aria-disabled').toEqual([]);
    });
  });
}