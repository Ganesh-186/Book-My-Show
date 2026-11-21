// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const districtStatePath = path.resolve('playwright/.auth/district.json');

test('opens District with the saved login state', async ({ browser }) => {
  expect(
    fs.existsSync(districtStatePath),
    'District login state not found. Run "npm run auth:district" first.',
  ).toBe(true);

  const context = await browser.newContext({
    storageState: districtStatePath,
  });
  const page = await context.newPage();

  await page.goto('https://www.district.in/', {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(/district\.in/);
  await expect(page).toHaveTitle(/District/i);

  await page.waitForTimeout(15000)
  await context.close();
});