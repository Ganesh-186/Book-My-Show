import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class HomePage extends BasePage {
    async openDistrict() {
        await this.page.goto('https://www.district.in/', {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
        });
        await expect(this.page).toHaveURL(/district\.in/);
        await expect(this.page).toHaveTitle(/District/i);
    }

    // Backward-compatible selector used by the original booking test.
    async selectRamayanaMovie() {
        const profileReady = this.page.waitForResponse((response) => {
            const url = new URL(response.url());
            return url.hostname.endsWith('district.in')
                && url.pathname === '/gw/consumer/profile/billing/details'
                && response.ok();
        }, { timeout: 30_000 });

        const movieLink = this.page.getByRole('link', { name: /Ramayana.*U \| Tamil/ });
        await this.clickReady(movieLink, 'Ramayana movie link');
        await profileReady;
    }

    // Search by the movie name supplied in test data. Locator filtering
    // auto-waits for dynamically rendered movie cards.
    async selectMovieByName(movieName) {
        if (!movieName || !movieName.trim()) {
            throw new Error('movieName must be provided in booking test data.');
        }

        const movieLink = this.page.getByRole('link')
            .filter({ hasText: movieName.trim() })
            .first();

        await expect(
            movieLink,
            'District did not display a movie link containing "' + movieName + '".',
        ).toBeVisible({ timeout: 30_000 });

        await this.clickReady(movieLink, 'movie link "' + movieName + '"');
        await expect(this.page).toHaveURL(/\/movies\//, { timeout: 30_000 });
        console.log('Selected movie from test data: ' + movieName);
    }

    async selectPreferredLocation(locationName) {
        if (!locationName || !locationName.trim()) {
            throw new Error('locationName must be provided in booking test data.');
        }

        const locationButton = this.page.getByRole('main').getByRole('button').first();
        await expect(locationButton).toBeVisible({ timeout: 30_000 });
        const currentLocation = (await locationButton.innerText()).trim();

        if (currentLocation.toLowerCase().includes(locationName.toLowerCase())) {
            console.log('District location is already set to: ' + currentLocation);
            return;
        }

        await this.clickReady(locationButton, 'District location selector');

        const locationDialog = this.page.getByRole('dialog');
        await expect(locationDialog).toBeVisible({ timeout: 15_000 });

        const searchLocation = locationDialog.getByRole('textbox', {
            name: /Search city, area or locality/i,
        });
        await searchLocation.fill(locationName);

        const locationOption = locationDialog.getByRole('button')
            .filter({ hasText: locationName.trim() })
            .first();

        await expect(
            locationOption,
            'Location suggestion "' + locationName + '" was not found.',
        ).toBeVisible({ timeout: 15_000 });

        await this.clickReady(locationOption, 'location suggestion "' + locationName + '"');
        await expect(locationButton).toContainText(locationName, { timeout: 15_000 });
        console.log('District location selected: ' + locationName);
    }
}