import { test, expect } from '@playwright/test';

const dropRadius = (page) => page.locator('#demo circle.goo-fill').evaluate((node) => +node.getAttribute('r'));
const dropX = (page) => page.locator('#demo circle.goo-fill').evaluate((node) => +node.getAttribute('cx'));

test.beforeEach(async ({ page }) => {
  if (process.env.GOO_MIN) {
    await page.route('**/package/src/goo-button.js', (route) => route.fulfill({ path: 'package/goo-button.min.js', contentType: 'text/javascript' }));
  }
  await page.goto('/demo/');
  await expect(page.locator('#demo .goo-inner')).toBeAttached();
});

test('a decorated button is still a real button', async ({ page }) => {
  const demo = page.locator('#demo');
  await expect(demo).toHaveJSProperty('tagName', 'BUTTON');
  await expect(demo).toHaveAttribute('type', 'button');
  await expect(demo).toHaveClass(/goo-button/);
});

test('keyboard focus opens the drop and draws the ring', async ({ page }) => {
  await page.locator('#demo').focus();
  await page.keyboard.press('Shift');
  await expect.poll(() => dropRadius(page)).toBeGreaterThan(5);
  await expect.poll(() => page.locator('#demo .goo-ring').getAttribute('d')).toMatch(/M/);
});

test('data-goo-open keeps the drop out, and a geometry token applies while it is open', async ({ page }) => {
  const demo = page.locator('#demo');
  await demo.evaluate((node) => node.setAttribute('data-goo-open', ''));
  await expect.poll(() => dropRadius(page)).toBeGreaterThan(5);
  await expect.poll(() => dropX(page)).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  const before = await dropX(page);
  await demo.evaluate((node) => node.setAttribute('data-goo-gap', '1'));
  await expect.poll(() => dropX(page)).toBeGreaterThan(before + 5);
  await demo.evaluate((node) => node.removeAttribute('data-goo-open'));
  await expect.poll(() => dropRadius(page)).toBeLessThan(0.5);
});

test('an unsafe value never reaches the styles, a safe one does', async ({ page }) => {
  const demo = page.locator('#demo');
  const fill = () => demo.evaluate((node) => node.style.getPropertyValue('--goo-fill-color'));
  await demo.evaluate((node) => node.setAttribute('data-goo-fill-color', 'red'));
  await expect.poll(fill).toBe('red');
  await demo.evaluate((node) => node.setAttribute('data-goo-fill-color', 'url(https://example.com/x.png)'));
  await expect.poll(fill).toBe('');
});

test('a unit on a numeric token is refused instead of misread', async ({ page }) => {
  const demo = page.locator('#demo');
  await demo.evaluate((node) => node.setAttribute('data-goo-gap', '0.5'));
  await expect.poll(() => demo.evaluate((node) => node.style.getPropertyValue('--goo-gap'))).toBe('0.5');
  await demo.evaluate((node) => node.setAttribute('data-goo-gap', '10px'));
  await expect.poll(() => demo.evaluate((node) => node.style.getPropertyValue('--goo-gap'))).toBe('');
});

test("the page's own --goo-* values survive detach", async ({ page }) => {
  const demo = page.locator('#demo');
  await demo.evaluate((node) => node.style.setProperty('--goo-neck-reach', '1.5'));
  await demo.evaluate((node) => node.setAttribute('data-goo-gap', '0.4'));
  await demo.evaluate(async (node) => (await import('/package/src/goo-button.js')).detach(node));
  expect(await demo.evaluate((node) => node.style.getPropertyValue('--goo-neck-reach'))).toBe('1.5');
  expect(await demo.evaluate((node) => node.style.getPropertyValue('--goo-gap'))).toBe('');
});

test('detach restores the original children', async ({ page }) => {
  const demo = page.locator('#demo');
  await demo.evaluate(async (node) => (await import('/package/src/goo-button.js')).detach(node));
  await expect(demo.locator('.goo-inner')).toHaveCount(0);
  await expect(demo).not.toHaveClass(/goo-button/);
  await expect(demo).toContainText('Press me');
  await expect(demo.locator('svg[slot="icon"]')).toHaveCount(1);
});

test('removing data-goo undoes the decoration', async ({ page }) => {
  const demo = page.locator('#demo');
  await demo.evaluate((node) => node.removeAttribute('data-goo'));
  await expect(demo.locator('.goo-inner')).toHaveCount(0);
});

test('buttons in a replaced <body> are decorated (Turbo, htmx boost)', async ({ page }) => {
  await page.evaluate(() => {
    const body = document.createElement('body');

    const button = document.createElement('button');
    button.type = 'button'; button.id = 'fresh'; button.setAttribute('data-goo', ''); button.textContent = 'Fresh';
    body.append(button);
    document.documentElement.replaceChild(body, document.body);
  });
  await expect(page.locator('#fresh .goo-inner')).toBeAttached();
});

test('role="button" gets Enter and Space', async ({ page }) => {
  await page.evaluate(() => {
    const element = document.createElement('div');
    element.setAttribute('role', 'button'); element.setAttribute('data-goo', ''); element.id = 'role-button'; element.textContent = 'Go';
    window.clicks = 0; element.addEventListener('click', () => { window.clicks += 1; });
    document.body.append(element);
  });
  await expect(page.locator('#role-button .goo-inner')).toBeAttached();
  await page.locator('#role-button').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.clicks)).toBe(2);
});

test('a plain div is refused', async ({ page }) => {
  const warned = page.waitForEvent('console', (message) => message.type() === 'warning' && message.text().includes('needs a <button>'));
  await page.evaluate(() => { const element = document.createElement('div'); element.setAttribute('data-goo', ''); element.id = 'plain'; document.body.append(element); });
  await warned;
  await expect(page.locator('#plain .goo-inner')).toHaveCount(0);
});

test('valid CSS values pass the browser check: var(), color-mix(), calc(), rem', async ({ page }) => {
  const demo = page.locator('#demo');
  const read = (name) => demo.evaluate((node, prop) => node.style.getPropertyValue(prop), name);
  for (const [attr, value] of [['fill-color', 'var(--accent)'], ['fill-color', 'color-mix(in oklch, red, blue)'], ['text-color', 'white'], ['text-size', 'calc(1rem + 0.1rem)'], ['text-size', '1.5']]) {
    await demo.evaluate((node, [name, text]) => node.setAttribute(`data-goo-${name}`, text), [attr, value]);
    await expect.poll(() => read(`--goo-${attr}`), `${attr}=${value}`).not.toBe('');
  }
  expect(await read('--goo-text-size')).toBe('1.5rem');
  await demo.evaluate((node) => node.setAttribute('data-goo-fill-color', 'not-a-color'));
  await expect.poll(() => read('--goo-fill-color')).toBe('');
});

test('the default size equals the slider default: no jump when the attribute appears', async ({ page }) => {
  const demo = page.locator('#demo');
  const size = () => demo.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  const before = await size();
  await demo.evaluate((node) => node.setAttribute('data-goo-text-size', '1.25'));
  await expect.poll(size).toBe(before);
});

test('values are checked by type: a unit on a number token is ignored, a number is clamped', async ({ page }) => {
  const demo = page.locator('#demo');
  const read = () => demo.evaluate((node) => node.style.getPropertyValue('--goo-padding-x'));
  await demo.evaluate((node) => node.setAttribute('data-goo-padding-x', '1.5rem'));
  await expect.poll(read).toBe('');
  await demo.evaluate((node) => node.setAttribute('data-goo-padding-x', '99'));
  await expect.poll(read).toBe('8');
});

test('a rejected value is reported once with console.warn', async ({ page }) => {
  const warned = page.waitForEvent('console', (message) => message.type() === 'warning' && message.text().includes('ignored'));
  await page.locator('#demo').evaluate((node) => node.setAttribute('data-goo-gap', '10px'));
  await warned;
});

test('Space keyup alone does not click a role="button"', async ({ page }) => {
  await page.evaluate(() => {
    const element = document.createElement('div');
    element.setAttribute('role', 'button'); element.setAttribute('data-goo', ''); element.id = 'space-button'; element.textContent = 'Go';
    window.spaceClicks = 0; element.addEventListener('click', () => { window.spaceClicks += 1; });
    document.body.append(element);
  });
  await expect(page.locator('#space-button .goo-inner')).toBeAttached();
  await page.locator('body').press('Space');
  await page.evaluate(() => document.getElementById('space-button').focus());
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => window.spaceClicks)).toBe(0);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.spaceClicks)).toBe(1);
});

test('the goo-button marker comes back after a framework rewrites className', async ({ page }) => {
  const demo = page.locator('#demo');
  await demo.evaluate((node) => { node.className = 'x'; });
  await expect(demo).toHaveClass(/goo-button/);
  await expect(demo).toHaveClass(/x/);
});

test('runs under a strict CSP with Trusted Types enforced', async ({ page }) => {
  const violations = [];
  page.on('console', (message) => { if (/Content Security Policy|Trusted Type/i.test(message.text())) violations.push(message.text()); });
  await page.route('**/demo/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; require-trusted-types-for 'script'; trusted-types 'none'" } });
  });
  await page.goto('/demo/');
  await expect(page.locator('#demo .goo-inner')).toBeAttached();
  await page.locator('#demo').focus();
  await page.keyboard.press('Shift');
  await expect.poll(() => page.locator('#demo circle.goo-fill').evaluate((node) => +node.getAttribute('r'))).toBeGreaterThan(5);
  expect(violations).toEqual([]);
});