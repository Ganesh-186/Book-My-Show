import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const districtStatePath = path.resolve('playwright/.auth/district.json');

async function logPaymentDom(page, label) {
    const dom = await page.locator('#pay').evaluate((root) => {
        const lines = [];

        const visit = (element, depth) => {
            if (lines.length >= 250) {
                return;
            }

            const indent = '  '.repeat(depth);
            const attributes = Array.from(element.attributes)
                .filter((attribute) => attribute.value.length < 300)
                .map((attribute) => `${attribute.name}="${attribute.value}"`)
                .join(' ');
            const text = Array.from(element.childNodes)
                .filter((node) => node.nodeType === Node.TEXT_NODE)
                .map((node) => node.textContent.trim())
                .filter(Boolean)
                .join(' ')
                .slice(0, 180);

            lines.push(
                `${indent}<${element.tagName.toLowerCase()}${attributes ? ` ${attributes}` : ''}>${text ? ` ${text}` : ''}`,
            );

            for (const child of element.children) {
                visit(child, depth + 1);
            }

            if (element.shadowRoot) {
                lines.push(`${indent}  #shadow-root`);
                for (const child of element.shadowRoot.children) {
                    visit(child, depth + 2);
                }
            }
        };

        visit(root, 0);
        return lines.join('\n');
    });

    console.log(`\n--- Payment DOM ${label} ---\n${dom}\n--- End payment DOM ---`);
}

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
        await paymentCheckout.click();
        await logPaymentDom(page, 'after first payment-checkout click');
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
