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

        await expect(this.page).toHaveURL(/\/movies\/seat-layout\//, {
            timeout: 30_000,
        });
    }

    async selectNearestAvailableShowtimeWithinRadius(maxDistanceKm = 15) {
        const showtimePattern = /^\s*\d{1,2}:\d{2}\s*(?:AM|PM)\b/i;
        const theatreCards = this.page.getByRole('listitem');
        const theatreCount = await theatreCards.count();
        const eligibleTheatres = [];

        for (let index = 0; index < theatreCount; index += 1) {
            const card = theatreCards.nth(index);
            const showtimeButtons = card.getByRole('button', {
                name: showtimePattern,
            });

            if (await showtimeButtons.count() === 0) {
                continue;
            }

            const cardText = await card.innerText();
            const kmMatch = cardText.match(/\b(\d+(?:\.\d+)?)\s*km\s+away\b/i);
            const metreMatch = cardText.match(/\b(\d+)\s*m\s+away\b/i);

            // Only use theatres for which District displays a measurable distance.
            const distanceKm = kmMatch
                ? Number(kmMatch[1])
                : metreMatch
                    ? Number(metreMatch[1]) / 1000
                    : null;

            if (distanceKm === null || distanceKm > maxDistanceKm) {
                continue;
            }

            let firstEnabledShowtime = null;

            for (let showIndex = 0; showIndex < await showtimeButtons.count(); showIndex += 1) {
                const candidate = showtimeButtons.nth(showIndex);

                if (await candidate.isVisible() && await candidate.isEnabled()) {
                    firstEnabledShowtime = candidate;
                    break;
                }
            }

            if (!firstEnabledShowtime) {
                continue;
            }

            const links = await card.getByRole('link').allInnerTexts();
            const theatreName = links.map((name) => name.trim()).find(Boolean)
                || 'Theatre name unavailable';

            eligibleTheatres.push({
                cardIndex: index,
                distanceKm,
                theatreName,
                showtime: firstEnabledShowtime,
            });
        }

        eligibleTheatres.sort((a, b) => a.distanceKm - b.distanceKm);

        if (eligibleTheatres.length === 0) {
            throw new Error(
                `District did not show any theatre with an enabled showtime within ${maxDistanceKm} km of the selected location. Check that Porur is selected and showtimes are loaded.`,
            );
        }

        const nearest = eligibleTheatres[0];
        const selectedShowtime = (await nearest.showtime.innerText()).trim();

        console.log(
            `Nearest eligible theatre: ${nearest.theatreName} (${nearest.distanceKm} km)`,
        );
        console.log(`Selecting showtime: ${selectedShowtime}`);

        await nearest.showtime.click();

        await expect(this.page).toHaveURL(/\/movies\/seat-layout\//, {
            timeout: 30_000,
        });

        return {
            theatreName: nearest.theatreName,
            distanceKm: nearest.distanceKm,
            showtime: selectedShowtime,
        };
    }
}
