import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class SeatLayoutPage extends BasePage {
    async closeInitialOverlay() {
        await this.page.getByTestId('close-icon').click();
    }

    // Existing method used by the original booking test. Keep its behaviour unchanged.
    async selectFirstAvailableSeat() {
        const seat = this.page.getByRole('button', { name: /^available seat,/ }).first();
        await expect(seat).toBeVisible();
        await seat.click();
    }

    /**
     * Select a viewing-position seat for the Porur-focused test.
     * The preference is the horizontal centre and approximately mid-depth
     * from the screen, using the actual seat coordinates rendered by District.
     */
    async selectBestAvailableSeat() {
        const availableSeats = this.page.getByRole('button', {
            name: /^available seat,/i,
        });

        await expect(
            availableSeats.first(),
            'No available seats are displayed in this showtime.',
        ).toBeVisible({ timeout: 30_000 });

        const seats = await availableSeats.evaluateAll((buttons) =>
            buttons.map((button, index) => {
                const rect = button.getBoundingClientRect();
                const label = button.getAttribute('aria-label')
                    || button.getAttribute('title')
                    || button.innerText
                    || '';

                return {
                    index,
                    label: label.trim(),
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    visible: rect.width > 0 && rect.height > 0,
                };
            }).filter((seat) => seat.visible),
        );

        if (seats.length === 0) {
            throw new Error('No visible available seats could be evaluated.');
        }

        const minX = Math.min(...seats.map((seat) => seat.x));
        const maxX = Math.max(...seats.map((seat) => seat.x));
        const minY = Math.min(...seats.map((seat) => seat.y));
        const maxY = Math.max(...seats.map((seat) => seat.y));

        const screenMarker = this.page.getByText('SCREEN THIS WAY', {
            exact: true,
        }).last();

        let targetY = (minY + maxY) / 2;

        if (await screenMarker.count() > 0 && await screenMarker.isVisible()) {
            const screenY = await screenMarker.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return rect.top + rect.height / 2;
            });

            // Aim around 55% of the seating depth away from the screen.
            if (screenY < minY) {
                targetY = minY + (maxY - minY) * 0.55;
            } else if (screenY > maxY) {
                targetY = maxY - (maxY - minY) * 0.55;
            }
        }

        const targetX = (minX + maxX) / 2;
        const width = Math.max(maxX - minX, 1);
        const height = Math.max(maxY - minY, 1);

        const rankedSeats = seats.map((seat) => ({
            ...seat,
            score: Math.hypot(
                (seat.x - targetX) / width,
                (seat.y - targetY) / height,
            ),
        }));

        rankedSeats.sort((a, b) => a.score - b.score);

        const bestSeat = rankedSeats[0];
        const seatLocator = availableSeats.nth(bestSeat.index);

        console.log(`Best-position available seat: ${bestSeat.label || 'seat at calculated centre position'}`);

        await seatLocator.click();

        // District changes a chosen seat from an available button to a selected seat node.
        await expect(availableSeats).toHaveCount(seats.length - 1, {
            timeout: 10_000,
        });

        return bestSeat.label;
    }

    async proceedWithSeatSelection() {
        await this.page.getByRole('button', { name: 'Proceed', exact: true }).click();
        await expect(this.page).toHaveURL(/\/movies\/seat-layout\//);
    }

    async confirmSeatsAndProceed() {
        await this.page.getByRole('button', { name: 'Confirm and proceed', exact: true }).click();
    }
}
