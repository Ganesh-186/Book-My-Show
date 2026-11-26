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

        try {
            await skipButton.click();
            console.log('Skipped the optional snack selection.');
            return true;
        } catch (error) {
            // District can replace/close the current tab while applying the skip action.
            if (this.page.isClosed()) {
                console.log('Snack skip triggered a page transition.');
                return true;
            }
            throw error;
        }
    }

    // Keep the original post-confirmation add-on handling unchanged.
    async skipAdditionalOptions() {
        await this.page.getByRole('button', { name: 'Skip' }).click();
        await expect(this.page).toHaveURL(
            /\/movies\/(order-review|payment|checkout)\//,
            { timeout: 30_000 },
        );
    }
}
