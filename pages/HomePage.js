import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';
export class HomePage extends BasePage {
    async openDistrict() {
        await this.page.goto('https://www.district.in/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await expect(this.page).toHaveURL(/district\.in/);
        await expect(this.page).toHaveTitle(/District/i);
    }
    async selectRamayanaMovie() {
        const profileReady = this.page.waitForResponse((response) => {
            const url = new URL(response.url());
            return url.hostname.endsWith('district.in') && url.pathname === '/gw/consumer/profile/billing/details' && response.ok();
        }, { timeout: 30_000 });
        await this.page.getByRole('link', { name: /Ramayana.*U \| Tamil/ }).click();
        await profileReady;
    }

    async selectPreferredLocation(locationName) {
        const locationButton = this.page.getByRole('main').getByRole('button').first();

        await expect(locationButton).toBeVisible();
        const currentLocation = (await locationButton.innerText()).trim();

        if (currentLocation.toLowerCase().includes(locationName.toLowerCase())) {
            console.log(`District location is already set to: ${currentLocation}`);
            return;
        }

        await locationButton.click();

        const locationDialog = this.page.getByRole('dialog');
        await expect(locationDialog).toBeVisible();

        const searchLocation = locationDialog.getByRole('textbox', {
            name: /Search city, area or locality/i,
        });
        await searchLocation.fill(locationName);

        const locationOption = locationDialog.getByRole('button', {
            name: new RegExp(locationName, 'i'),
        }).first();

        await expect(
            locationOption,
            `Location suggestion "${locationName}" was not found.`,
        ).toBeVisible({ timeout: 15_000 });

        await locationOption.click();

        await expect(locationButton).toContainText(
            new RegExp(locationName, 'i'),
            { timeout: 15_000 },
        );

        console.log(`District location selected: ${locationName}`);
    }
}
