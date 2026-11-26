import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class OrderReviewPage extends BasePage {
    async skipAdditionalOptions() {
        await this.page.getByRole('button', { name: 'Skip' }).click();
        await expect(this.page).toHaveURL(
            /\/movies\/(order-review|payment|checkout)\//,
            { timeout: 30_000 },
        );
    }

    // Optional snack/add-on popup handler for the Porur best-seat flow.
    // The existing skipAdditionalOptions() method remains unchanged.
    async skipSnackSelectionIfVisible() {
        const skipButton = this.page.getByRole('button', {
            name: /^(skip(?: snacks?)?(?: for now)?|no thanks|not now)$/i,
        }).first();

        const isVisible = await skipButton.isVisible().catch(() => false);

        if (!isVisible) {
            return false;
        }

        await skipButton.click();
        console.log('Skipped the optional snack selection popup.');
        return true;
    }
}
