import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class ShowtimePage extends BasePage {
    async selectFirstAvailableShowtime() {
        // District renders each theatre as a list item with its showtime buttons inside it.
        // Match only visible, enabled buttons whose labels begin with a time such as "07:50 PM".
        const showtimePattern = /^\s*\d{1,2}:\d{2}\s*(?:AM|PM)\b/i;

        const theatresWithAvailableShows = this.page
            .getByRole('listitem')
            .filter({
                has: this.page
                    .locator('button:visible:enabled')
                    .filter({ hasText: showtimePattern }),
            });

        const firstTheatre = theatresWithAvailableShows.first();

        await expect(
            firstTheatre,
            'No theatre with an available showtime was found.',
        ).toBeVisible({ timeout: 30_000 });

        const firstShowtime = firstTheatre
            .locator('button:visible:enabled')
            .filter({ hasText: showtimePattern })
            .first();

        await expect(
            firstShowtime,
            'The first available theatre did not expose a selectable showtime.',
        ).toBeVisible({ timeout: 30_000 });

        const selectedShowtime = (await firstShowtime.innerText()).trim();
        console.log(`Selecting the first available theatre showtime: ${selectedShowtime}`);

        await firstShowtime.click();

        await expect(this.page).toHaveURL(/\\/movies\\/seat-layout\\//, {
            timeout: 30_000,
        });
    }
}
