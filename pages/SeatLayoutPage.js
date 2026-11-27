import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class SeatLayoutPage extends BasePage {
    async closeInitialOverlay() {
        const closeButton = this.page.getByTestId('close-icon');
        if (await closeButton.isVisible().catch(() => false)) {
            await this.clickReady(closeButton, 'seat-map overlay close button');
        }
    }

    // Existing method used by the original booking test. Keep this selection
    // behaviour unchanged so the original first-available-seat test is protected.
    async selectFirstAvailableSeat() {
        const seat = this.page.getByRole('button', { name: /^available seat,/ }).first();
        await expect(seat).toBeVisible();
        await seat.click();
    }

    // Single-seat convenience method retained for the earlier Porur test.
    async selectBestAvailableSeat() {
        const selected = await this.selectBestAvailableSeats(1);
        return selected[0];
    }

    // Select a contiguous block of available seats in the same row/class.
    // Among valid blocks, prefer the block closest to the horizontal centre
    // and the middle viewing depth measured from the screen.
    async selectBestAvailableSeats(ticketCount = 1) {
        if (!Number.isInteger(ticketCount) || ticketCount < 1) {
            throw new Error('ticketCount must be a positive integer.');
        }

        const availableSeats = this.page.getByRole('button', {
            name: /^available seat,/i,
        });

        await expect(
            availableSeats.first(),
            'No available seats are displayed for this showtime.',
        ).toBeVisible({ timeout: 30_000 });

        const seats = await availableSeats.evaluateAll((buttons) =>
            buttons.map((button, index) => {
                const rect = button.getBoundingClientRect();
                const label = button.getAttribute('aria-label')
                    || button.getAttribute('title')
                    || button.innerText
                    || '';
                const rowMatch = label.match(/\brow\s+([^,]+),\s*column\s+(\d+)/i);
                const classMatch = label.match(/,\s*class\s+(.+?),\s*row\s+/i);

                return {
                    locatorIndex: index,
                    label: label.trim(),
                    row: rowMatch ? rowMatch[1].trim() : null,
                    column: rowMatch ? Number(rowMatch[2]) : null,
                    seatClass: classMatch ? classMatch[1].trim() : null,
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    width: rect.width,
                    visible: rect.width > 0 && rect.height > 0,
                };
            }).filter((seat) => seat.visible && seat.label),
        );

        if (seats.length < ticketCount) {
            throw new Error(
                'Only ' + seats.length + ' seats are available, but test data requests '
                + ticketCount + ' tickets.',
            );
        }

        const minX = Math.min(...seats.map((seat) => seat.x));
        const maxX = Math.max(...seats.map((seat) => seat.x));
        const minY = Math.min(...seats.map((seat) => seat.y));
        const maxY = Math.max(...seats.map((seat) => seat.y));

        const screenMarker = this.page.getByText('SCREEN THIS WAY', {
            exact: true,
        }).last();

        let targetY = (minY + maxY) / 2;
        if (await screenMarker.count() > 0 && await screenMarker.isVisible().catch(() => false)) {
            const screenY = await screenMarker.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return rect.top + rect.height / 2;
            });

            if (screenY < minY) targetY = minY + (maxY - minY) * 0.55;
            else if (screenY > maxY) targetY = maxY - (maxY - minY) * 0.55;
        }

        const targetX = (minX + maxX) / 2;
        const mapWidth = Math.max(maxX - minX, 1);
        const mapHeight = Math.max(maxY - minY, 1);

        // Separate rows and seat classes before creating candidate blocks.
        const groups = new Map();
        for (const seat of seats) {
            const rowKey = seat.row || ('visual-row-' + Math.round(seat.y / 12));
            const classKey = seat.seatClass || 'unknown-class';
            const groupKey = rowKey + '|' + classKey;

            if (!groups.has(groupKey)) groups.set(groupKey, []);
            groups.get(groupKey).push(seat);
        }

        const candidateBlocks = [];
        for (const rowSeats of groups.values()) {
            rowSeats.sort((a, b) => a.x - b.x);

            for (let start = 0; start <= rowSeats.length - ticketCount; start += 1) {
                const block = rowSeats.slice(start, start + ticketCount);
                const averageWidth = block.reduce((sum, seat) => sum + seat.width, 0) / block.length;
                const maxAdjacentGap = Math.max(averageWidth * 1.8, averageWidth + 2);

                const visuallyContiguous = block.every((seat, index) =>
                    index === 0 || seat.x - block[index - 1].x <= maxAdjacentGap,
                );

                if (!visuallyContiguous) continue;

                const blockCenterX = (block[0].x + block[block.length - 1].x) / 2;
                const blockCenterY = block.reduce((sum, seat) => sum + seat.y, 0) / block.length;
                const score = Math.hypot(
                    (blockCenterX - targetX) / mapWidth,
                    (blockCenterY - targetY) / mapHeight,
                );

                candidateBlocks.push({ seats: block, score });
            }
        }

        if (candidateBlocks.length === 0) {
            throw new Error(
                'District does not show ' + ticketCount
                + ' contiguous available seats in one row and class. '
                + 'Reduce ticketCount or select another showtime.',
            );
        }

        candidateBlocks.sort((a, b) => a.score - b.score);
        const chosenBlock = candidateBlocks[0].seats;
        const initialAvailableCount = await availableSeats.count();
        const selectedLabels = [];

        for (let index = 0; index < chosenBlock.length; index += 1) {
            const seat = chosenBlock[index];
            const seatLocator = this.page.getByRole('button', {
                name: seat.label,
                exact: true,
            });

            await this.clickReady(seatLocator, 'selected seat ' + seat.label);
            selectedLabels.push(seat.label);

            await expect.poll(
                () => availableSeats.count(),
                {
                    timeout: 10_000,
                    message: 'District did not update the seat map after selecting a seat.',
                },
            ).toBe(initialAvailableCount - index - 1);
        }

        console.log(
            'Selected ' + selectedLabels.length + ' best-position seat(s): '
            + selectedLabels.join(' | '),
        );
        return selectedLabels;
    }

    async proceedWithSeatSelection() {
        const proceedButton = this.page.getByRole('button', {
            name: 'Proceed',
            exact: true,
        }).first();

        await this.clickReady(proceedButton, 'seat selection Proceed button');
        await expect(this.page).toHaveURL(/\/movies\/seat-layout\//, {
            timeout: 30_000,
        });
    }

    async confirmSeatsAndProceed() {
        const confirmButton = this.page.getByRole('button', {
            name: 'Confirm and proceed',
            exact: true,
        }).first();

        await this.clickReady(confirmButton, 'Confirm and proceed button');
    }
}