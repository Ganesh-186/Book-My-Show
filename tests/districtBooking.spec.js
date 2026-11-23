import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { logPaymentDom } from '../utils/logPaymentDom.js';

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

        await page
            .getByRole('link', { name: /Ramayana U \| Tamil and 2 more/ })
            .click();
        await districtProfileReady;
        await page.getByRole('button', { name: 'Book Tickets', exact: true }).click();
        await expect(page).toHaveURL(/\/movies\/.*-in-chennai-/, { timeout: 30_000 });
        const proceedButton = page.getByRole('button', { name: 'Proceed', exact: true });
        await expect(proceedButton).toBeVisible({ timeout: 30_000 });
        await proceedButton.click();

        const showtime = page.getByRole('button', {
            name: /10:35 PM.*ANU EGA/i,
        });
        await expect(showtime).toBeVisible({ timeout: 30_000 });
        await showtime.click();
        await expect(page).toHaveURL(/\/movies\/seat-layout\//, { timeout: 30_000 });

        await page.getByTestId('close-icon').click();
       

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






        const paymentCheckout = page.locator('payment-checkout');
        await expect(paymentCheckout).toBeVisible();
        await logPaymentDom(page, 'before Pay Now');

        const getPayNowPoint = () => paymentCheckout.evaluate((checkout) => {
            const label = Array.from(checkout.shadowRoot?.querySelectorAll('span') ?? [])
                .find((span) => span.textContent.trim() === 'Pay now');
            if (!label) {
                return null;
            }

            const bounds = label.getBoundingClientRect();
            const style = window.getComputedStyle(label);
            if (bounds.width === 0 || bounds.height === 0
                || style.display === 'none' || style.visibility !== 'visible') {
                return null;
            }

            return {
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2,
            };
        });
        await expect.poll(getPayNowPoint, { timeout: 30_000 }).not.toBeNull();
        const isPaymentDialogVisible = () => paymentCheckout.evaluate((checkout) => {
            const dialog = checkout.shadowRoot?.querySelector('[role="dialog"]');
            if (!dialog) {
                return false;
            }
            const bounds = dialog.getBoundingClientRect();
            const style = window.getComputedStyle(dialog);
            return bounds.width > 0 && bounds.height > 0
                && style.display !== 'none' && style.visibility === 'visible';
        });
        const waitForPaymentDialog = async (timeoutMs) => {
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
                if (await isPaymentDialogVisible()) {
                    return true;
                }
                await page.waitForTimeout(250);
            }
            return isPaymentDialogVisible();
        };

        const maxPayNowAttempts = 3;
        let paymentDialogOpened = await isPaymentDialogVisible();
        for (let attempt = 1; attempt <= maxPayNowAttempts && !paymentDialogOpened; attempt += 1) {
            const payNowPoint = await getPayNowPoint();
            if (!payNowPoint) {
                paymentDialogOpened = await waitForPaymentDialog(5_000);
                break;
            }

            console.log(`Pay Now click attempt ${attempt}/${maxPayNowAttempts}`);
            await page.mouse.click(payNowPoint.x, payNowPoint.y);
            paymentDialogOpened = await waitForPaymentDialog(5_000);
        }
        if (!paymentDialogOpened) {
            throw new Error(`Payment dialog did not open after ${maxPayNowAttempts} Pay Now click attempts.`);
        }

        await logPaymentDom(page, 'after Pay Now click');
        console.log('Pages:', context.pages().map((openPage) => openPage.url()));
        console.log('Frames:', page.frames().map((frame) => frame.url()));

        const getScanQrPoint = () => paymentCheckout.evaluate((checkout) => {
            const option = Array.from(checkout.shadowRoot?.querySelectorAll('label') ?? [])
                .find((label) => label.textContent.trim() === 'Scan QR to pay');
            if (!option) {
                return null;
            }

            const bounds = option.getBoundingClientRect();
            const style = window.getComputedStyle(option);
            if (bounds.width === 0 || bounds.height === 0
                || style.display === 'none' || style.visibility !== 'visible') {
                return null;
            }

            return {
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2,
            };
        });
        await expect.poll(getScanQrPoint, { timeout: 30_000 }).not.toBeNull();
        const scanQrPoint = await getScanQrPoint();
        if (!scanQrPoint) {
            throw new Error('Visible "Scan QR to pay" option disappeared before it could be clicked.');
        }
        await page.mouse.click(scanQrPoint.x, scanQrPoint.y);

        const getUpiQrPoint = () => paymentCheckout.evaluate((checkout) => {
            const image = checkout.shadowRoot?.querySelector('img[alt="UPI QR Code"]');
            const button = image?.closest('button');
            if (!button) {
                return null;
            }

            const bounds = button.getBoundingClientRect();
            const style = window.getComputedStyle(button);
            if (bounds.width === 0 || bounds.height === 0
                || style.display === 'none' || style.visibility !== 'visible') {
                return null;
            }

            return {
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2,
            };
        });
        await expect.poll(getUpiQrPoint, { timeout: 30_000 }).not.toBeNull();
        const upiQrPoint = await getUpiQrPoint();
        if (!upiQrPoint) {
            throw new Error('Visible UPI QR button disappeared before it could be clicked.');
        }
        await page.mouse.click(upiQrPoint.x, upiQrPoint.y);
        await page.waitForTimeout(10_000);
        await logPaymentDom(page, '10 seconds after UPI QR click');

    } finally {
        await context.close();
    }
});
