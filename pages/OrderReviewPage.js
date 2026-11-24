import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';
export class OrderReviewPage extends BasePage {
    async skipAdditionalOptions() {
        await this.page.getByRole('button', { name: 'Skip' }).click();
        await expect(this.page).toHaveURL(/\/movies\/(order-review|payment|checkout)\//, { timeout: 30_000 });
    }
}
