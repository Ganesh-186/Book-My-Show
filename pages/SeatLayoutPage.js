import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';
export class SeatLayoutPage extends BasePage {
    async closeInitialOverlay() { await this.page.getByTestId('close-icon').click(); }
    async selectFirstAvailableSeat() {
        const seat = this.page.getByRole('button', { name: /^available seat,/ }).first();
        await expect(seat).toBeVisible();
        await seat.click();
    }
    async proceedWithSeatSelection() {
        await this.page.getByRole('button', { name: 'Proceed', exact: true }).click();
        await expect(this.page).toHaveURL(/\/movies\/seat-layout\//);
    }
    async confirmSeatsAndProceed() {
        await this.page.getByRole('button', { name: 'Confirm and proceed', exact: true }).click();
    }
}
