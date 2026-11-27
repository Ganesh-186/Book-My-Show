import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

const SHOWTIME_PATTERN = /^\s*\d{1,2}:\d{2}\s*(?:AM|PM)\b/i;

function parseTimeToMinutes(value) {
    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3].toUpperCase();

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    if (meridiem === 'AM') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;

    return hour * 60 + minute;
}

function parseDistanceKm(text) {
    const kmMatch = text.match(/\b(\d+(?:\.\d+)?)\s*km\s+away\b/i);
    if (kmMatch) return Number(kmMatch[1]);

    const metreMatch = text.match(/\b(\d+(?:\.\d+)?)\s*m\s+away\b/i);
    if (metreMatch) return Number(metreMatch[1]) / 1000;

    return null;
}

function getTimeWindowMinutes(timeWindow) {
    if (!timeWindow) return null;

    const start = parseTimeToMinutes(timeWindow.start || '');
    const end = parseTimeToMinutes(timeWindow.end || '');

    if (start === null || end === null || end < start) {
        throw new Error('Invalid showtimeWindow. Use values such as 06:00 AM and 09:00 AM.');
    }

    return { start, end };
}

export class ShowtimePage extends BasePage {
    // Keep the earlier working selection behaviour: inspect global role-based
    // showtime buttons in DOM order and click the first visible, enabled one.
    // District renders theatre cards in order, so this selects the first coming
    // theatre with an available showtime without a brittle nested CSS filter.
    async selectFirstAvailableShowtime() {
        const showtimes = this.page.getByRole('button', {
            name: SHOWTIME_PATTERN,
        });

        await expect(
            showtimes.first(),
            'District has not displayed any showtime buttons.',
        ).toBeVisible({ timeout: 30_000 });

        const count = await showtimes.count();
        let firstAvailable = null;

        for (let index = 0; index < count; index += 1) {
            const candidate = showtimes.nth(index);
            if (await candidate.isVisible() && await candidate.isEnabled()) {
                firstAvailable = candidate;
                break;
            }
        }

        if (!firstAvailable) {
            throw new Error('No visible, enabled showtime is available.');
        }

        const selectedShowtime = (await firstAvailable.innerText()).trim();
        console.log('Selecting the first available theatre showtime: ' + selectedShowtime);

        await this.clickReady(firstAvailable, 'first available showtime');
        await expect(this.page).toHaveURL(/\/movies\/seat-layout\//, {
            timeout: 30_000,
        });
    }

    // Data-driven selection: among theatres with a visible, enabled showtime
    // in the configured time range, select the nearest theatre within radius.
    async selectNearestAvailableShowtimeWithinRadius(maxDistanceKm = 15, timeWindow = null) {
        if (!Number.isFinite(maxDistanceKm) || maxDistanceKm <= 0) {
            throw new Error('maxDistanceKm must be a positive number.');
        }

        const allowedTime = getTimeWindowMinutes(timeWindow);
        const theatreCards = this.page.getByRole('listitem');

        await expect(
            this.page.getByRole('button', { name: SHOWTIME_PATTERN }).first(),
            'District has not displayed any showtimes.',
        ).toBeVisible({ timeout: 30_000 });

        const theatreCount = await theatreCards.count();
        const eligibleTheatres = [];

        for (let index = 0; index < theatreCount; index += 1) {
            const card = theatreCards.nth(index);
            const distanceKm = parseDistanceKm(await card.innerText());

            if (distanceKm === null || distanceKm > maxDistanceKm) continue;

            const cardShowtimes = card.getByRole('button', {
                name: SHOWTIME_PATTERN,
            });
            const showtimeCount = await cardShowtimes.count();
            const availableInWindow = [];

            for (let showIndex = 0; showIndex < showtimeCount; showIndex += 1) {
                const candidate = cardShowtimes.nth(showIndex);
                if (!(await candidate.isVisible()) || !(await candidate.isEnabled())) continue;

                const label = (await candidate.innerText()).trim();
                const minutes = parseTimeToMinutes(label);
                if (minutes === null) continue;

                if (allowedTime && (minutes < allowedTime.start || minutes > allowedTime.end)) {
                    continue;
                }

                availableInWindow.push({ locator: candidate, label, minutes });
            }

            if (availableInWindow.length === 0) continue;
            availableInWindow.sort((a, b) => a.minutes - b.minutes);

            const linkNames = await card.getByRole('link').allInnerTexts();
            const theatreName = linkNames.map((name) => name.trim()).find(Boolean)
                || 'Theatre name unavailable';

            eligibleTheatres.push({
                distanceKm,
                theatreName,
                showtime: availableInWindow[0],
            });
        }

        eligibleTheatres.sort((a, b) => a.distanceKm - b.distanceKm);

        if (eligibleTheatres.length === 0) {
            const windowText = timeWindow
                ? ' between ' + timeWindow.start + ' and ' + timeWindow.end
                : '';
            throw new Error(
                'No theatre with an enabled showtime' + windowText
                + ' was found within ' + maxDistanceKm
                + ' km. Check selected location, movie date and District availability.',
            );
        }

        const nearest = eligibleTheatres[0];
        console.log('Nearest eligible theatre: ' + nearest.theatreName + ' (' + nearest.distanceKm + ' km)');
        console.log('Selecting showtime: ' + nearest.showtime.label);

        await this.clickReady(nearest.showtime.locator, 'nearest eligible theatre showtime');
        await expect(this.page).toHaveURL(/\/movies\/seat-layout\//, {
            timeout: 30_000,
        });

        return {
            theatreName: nearest.theatreName,
            distanceKm: nearest.distanceKm,
            showtime: nearest.showtime.label,
        };
    }
}