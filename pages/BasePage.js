import { expect } from '@playwright/test';

export class BasePage {
    constructor(page) {
        this.page = page;
    }

    async expectUrl(pattern, options) {
        await this.page.waitForURL(pattern, options);
    }

    // Playwright auto-waits for actionability; explicitly wait and scroll before
    // a single click so slow transitions do not lead to duplicate actions.
    async clickReady(locator, description = 'button', timeout = 30_000) {
        await expect(locator, `${description} should be visible.`).toBeVisible({ timeout });
        await expect(locator, `${description} should be enabled.`).toBeEnabled({ timeout });
        await locator.scrollIntoViewIfNeeded();
        await locator.click({ timeout });
    }

    async clickButton(name, options = {}) {
        const button = this.page.getByRole('button', { name, ...options });
        await this.clickReady(button, String(name));
        return button;
    }

    async expectButtonVisible(name, options = {}) {
        const button = this.page.getByRole('button', { name, ...options });
        await button.waitFor({ state: 'visible', timeout: 30_000 });
        return button;
    }
}