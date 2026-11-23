import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const districtStatePath = path.resolve('playwright/.auth/district.json');

test('Book one Ramayana ticket in Chennai through the payment page', async ({ browser }) => {
    test.setTimeout(120_000);

    expect(
        fs.existsSync(districtStatePath),
        'District login state not found. Run "npm run auth:district" first.',
    ).toBe(true);

    const context = await browser.newContext({
        storageState: districtStatePath,
    });
    const page = await context.newPage();

    try {
        await page.goto('https://www.district.in/', {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
        });
        

        await expect(page).toHaveURL(/district\.in/);
        await expect(page).toHaveTitle(/District/i);

        const districtProfileReady = page.waitForResponse((response) => {
            const url = new URL(response.url());
            return url.hostname.endsWith('district.in')
                && url.pathname === '/gw/consumer/profile/billing/details'
                && response.ok();
        }, { timeout: 30_000 });
        await page.getByRole('link', { name: /Ramayana U \| Tamil and 2 more/ }).click();
        await districtProfileReady;
        await page.getByRole('button', { name: 'Book Tickets', exact: true }).click();
        await expect(page).toHaveURL(/\/movies\/.*-in-chennai-/, { timeout: 30_000 });
        const proceedButton = page.getByRole('button', { name: 'Proceed', exact: true });
        await expect(proceedButton).toBeVisible({ timeout: 30_000 });
        await proceedButton.click();

        const showtime = page.getByRole('button', {
            name: '10:25 PM PADMAM 4K 3D',
            exact: true,
        });
        await expect(showtime).toBeVisible({ timeout: 30_000 });
        await showtime.click();
        await expect(page).toHaveURL(/\/movies\/seat-layout\//, { timeout: 30_000 });

        const availableSeat = page.getByRole('button', {
            name: /^available seat,/,
        }).first();
        await expect(availableSeat).toBeVisible();
        await availableSeat.click();
        await page.getByRole('button', { name: 'Proceed', exact: true }).click();
        
        await expect(page).toHaveURL(/\/movies\/seat-layout\//);
        await page.getByRole('button', { name: 'Confirm and proceed', exact: true }).click();
        
       

        await page.getByRole('button', { name: 'Skip' }).click()

        await expect(page).toHaveURL(/\/movies\/(order-review|payment|checkout)\//, {
            timeout: 30_000,
        });

        

        
        
        
        const payNow = page.locator('#pay > payment-checkout');
        await expect(payNow).toBeVisible();
        const payNowBounds = await payNow.boundingBox();
        if (!payNowBounds) {
            throw new Error('Pay now control has no visible bounding box.');
        }
        await payNow.click({
            position: {
                x: payNowBounds.width * 0.85,
                y: payNowBounds.height / 2,
            },
        });
        console.log('Pages:', context.pages().map((openPage) => openPage.url()));
        console.log('Frames:', page.frames().map((frame) => frame.url()));

        const scanQrOption = page.getByText('Scan QR to pay', { exact: true });
        await expect(scanQrOption).toBeVisible({ timeout: 15_000 });
        await scanQrOption.click();

        const upiQrCode = page.getByRole('img', { name: 'UPI QR Code', exact: true });
        const upiQrButton = page.getByRole('button').filter({ has: upiQrCode });
        await expect(upiQrButton).toBeVisible({ timeout: 15_000 });
        await upiQrButton.click();

    } finally {
        await context.close();
    }
});
