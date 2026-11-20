import { expect, test } from '@playwright/test';

test('Sign in first, then book one Ramayana ticket in Chennai', async ({ browser }) => {
    const loginTimeout = 300_000;
    test.setTimeout(loginTimeout + 60_000);

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('https://www.district.in/');
        await page.waitForLoadState('networkidle');

        const loginDialog = page.getByRole('dialog', { name: 'Log in or sign up' });
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        await expect(loginDialog).toBeVisible();
        await expect(loginDialog).toBeHidden({ timeout: loginTimeout });

        await page.getByRole('link', { name: /Ramayana U \| Tamil and 2 more/ }).click();
        await page.getByRole('button', { name: 'Book Tickets', exact: true }).click();
        await page.getByRole('button', { name: 'Proceed', exact: true }).click();

        const showtime = page.getByRole('button', {
            name: /^\d{2}:\d{2} (AM|PM)\b/,
        }).first();
        await expect(showtime).toBeVisible();
        await showtime.click();

        const availableSeat = page.getByRole('button', {
            name: /^available seat,/,
        }).first();
        await expect(availableSeat).toBeVisible();
        await availableSeat.click();
        await page.getByRole('button', { name: 'Proceed', exact: true }).click();

        if (await loginDialog.isVisible()) {
            await expect(loginDialog).toBeHidden({ timeout: loginTimeout });

            const proceed = page.getByRole('button', { name: 'Proceed', exact: true });
            if (await proceed.isVisible()) {
                await proceed.click();
            }
        }

        await expect(page).toHaveURL(/\/movies\/seat-layout\//);
    } finally {
        await context.close();
    }
});
