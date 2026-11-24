export class BasePage {
    constructor(page) { this.page = page; }
    async expectUrl(pattern, options) { await this.page.waitForURL(pattern, options); }
    async clickButton(name, options = {}) {
        const button = this.page.getByRole('button', { name, ...options });
        await button.click();
        return button;
    }
    async expectButtonVisible(name, options = {}) {
        const button = this.page.getByRole('button', { name, ...options });
        await button.waitFor({ state: 'visible' });
        return button;
    }
}
