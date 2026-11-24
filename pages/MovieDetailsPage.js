import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';
export class MovieDetailsPage extends BasePage {
    async clickBookTickets() {
        await this.page.getByRole('button', { name: 'Book Tickets', exact: true }).click();
        await expect(this.page).toHaveURL(/\/movies\/.*-in-chennai-/, { timeout: 30_000 });
    }
    async proceed() {
        const button = this.page.getByRole('button', { name: 'Proceed', exact: true });
        await expect(button).toBeVisible({ timeout: 30_000 });
        await button.click();
    }
}
