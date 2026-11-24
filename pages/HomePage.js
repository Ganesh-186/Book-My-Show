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
        await this.page.getByRole('link', { name: /Ramayana U \| Tamil and 2 more/ }).click();
        await profileReady;
    }
}
