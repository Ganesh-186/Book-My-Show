import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class OrderReviewPage extends BasePage {
    async skipSnackSelectionIfVisible() {
        const skipButton = this.page.getByRole('button', {
            name: /\b(skip|no thanks|not now)\b/i,
        }).first();

        const visible = await skipButton.isVisible().catch(() => false);

        if (!visible) {
            console.log('No optional snack-selection Skip button is visible.');
            return false;
        }

        await skipButton.click();
        console.log('Skipped the optional snack selection.');
        return true;
    }

    async skipAdditionalOptions() {
        await this.skipSnackSelectionIfVisible();

        await expect(this.page).toHaveURL(
            /\/movies\/(order-review|payment|checkout)\//,
            { timeout: 30_000 },
        );
    }
}
