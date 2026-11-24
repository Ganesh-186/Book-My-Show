import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';
export class ShowtimePage extends BasePage {
    async selectAnuEga1035PmShowtime() {
        const showtime = this.page.getByRole('button', { name: /10:25 PM.*PADMAM 4K/i });
        await expect(showtime).toBeVisible({ timeout: 30_000 });
        await showtime.click();
        await expect(this.page).toHaveURL(/\/movies\/seat-layout\//, { timeout: 30_000 });
    }
}
