import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class OrderReviewPage extends BasePage {
    // Kept for the current Porur flow. A snack prompt may not appear on every run.
    async skipSnackSelectionIfVisible() {
        const skipButton = this.page.getByRole('button', {
            name: /^Skip$/i,
        }).last();

        const visible = await skipButton.isVisible().catch(() => false);
        if (!visible) {
            console.log('No optional snack-selection Skip button is visible.');
            return false;
        }

        await this.clickReady(skipButton, 'snack selection Skip button');
        console.log('Skipped the optional snack selection.');
        return true;
    }

    // Preserve the original test method and its role in the first workflow.
    async skipAdditionalOptions() {
        await this.page.getByRole('button', { name: 'Skip' }).click();
        await expect(this.page).toHaveURL(
            /\/movies\/(order-review|payment|checkout)\//,
            { timeout: 30_000 },
        );
    }

    // Data-driven flow: skip at most one currently displayed optional prompt
    // per call. The caller invokes this again after the next state is confirmed,
    // avoiding repeated clicks on a slow or stale Skip control.
    async skipOptionalPromptIfVisible({ timeoutMs = 4_000 } = {}) {
        const skipButton = this.page.getByRole('button', {
            name: /^Skip$/i,
        }).last();

        const appeared = await skipButton.waitFor({
            state: 'visible',
            timeout: timeoutMs,
        }).then(() => true).catch(() => false);

        if (!appeared) {
            return false;
        }

        await expect(skipButton).toBeEnabled({ timeout: 5_000 });
        const previousUrl = this.page.url();

        await this.clickReady(skipButton, 'visible optional prompt Skip button');

        // Confirm that this click advanced or dismissed the prompt before
        // allowing another Skip click.
        const advanced = await Promise.race([
            skipButton.waitFor({ state: 'hidden', timeout: 15_000 })
                .then(() => true).catch(() => false),
            this.page.waitForURL((url) => url.toString() !== previousUrl, {
                timeout: 15_000,
            }).then(() => true).catch(() => false),
        ]);

        if (!advanced && !this.page.isClosed()) {
            throw new Error(
                'District did not dismiss the optional prompt after clicking Skip. '
                + 'Check the current prompt before retrying to avoid a duplicate click.',
            );
        }

        console.log('Skipped one optional District prompt.');
        return true;
    }
}