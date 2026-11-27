import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class MovieDetailsPage extends BasePage {
    async clickBookTickets() {
        const bookButton = this.page.getByRole('button', {
            name: /^(Book Tickets|Book Now)$/i,
        }).first();

        await this.clickReady(bookButton, 'Book Tickets / Book Now button');
        await expect(this.page).toHaveURL(/\/movies\/.*-in-chennai-/, {
            timeout: 30_000,
        });
    }

    async proceed() {
        const proceedButton = this.page.getByRole('button', {
            name: 'Proceed',
            exact: true,
        }).first();

        await this.clickReady(proceedButton, 'movie details Proceed button');
    }
}