const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

async function saveDistrictLoginState() {
  const stateDirectory = path.resolve('playwright/.auth');
  const statePath = path.join(stateDirectory, 'district.json');
  fs.mkdirSync(stateDirectory, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.district.in/', {
    waitUntil: 'domcontentloaded',
  });

  if (process.env.DISTRICT_PHONE) {
    const phoneInput = page.locator('input[type="tel"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill(process.env.DISTRICT_PHONE);
    }
  }

  console.log('Complete District login and OTP verification in the browser.');
  console.log('The script will save the state automatically after login.');

  await page.waitForFunction(
    () => localStorage.getItem('dst:auth') === '1',
    null,
    { timeout: 10 * 60 * 1000 },
  );

  await context.storageState({ path: statePath });
  console.log(`Saved login state to ${statePath}`);

  await browser.close();
}

saveDistrictLoginState().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
