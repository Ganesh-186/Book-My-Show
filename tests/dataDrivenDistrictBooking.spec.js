import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { HomePage } from '../pages/HomePage.js';
import { MovieDetailsPage } from '../pages/MovieDetailsPage.js';
import { ShowtimePage } from '../pages/ShowtimePage.js';
import { SeatLayoutPage } from '../pages/SeatLayoutPage.js';
import { OrderReviewPage } from '../pages/OrderReviewPage.js';
import { PaymentPage } from '../pages/PaymentPage.js';
import { bookingScenarios } from '../test-data/bookingTestData.js';

const districtStatePath = path.resolve('playwright/.auth/district.json');

for (const data of bookingScenarios) {
    test(
        'Data-driven District booking - ' + data.scenarioName,
        async ({ browser }) => {
            test.setTimeout(240_000);

            expect(
                fs.existsSync(districtStatePath),
                'District login state not found. Run "npm run auth:district" first.',
            ).toBe(true);

            expect(data.movieName.trim().length).toBeGreaterThan(0);
            expect(data.locationName.trim().length).toBeGreaterThan(0);
            expect(data.radiusKm).toBeGreaterThan(0);
            expect(Number.isInteger(data.ticketCount)).toBe(true);
            expect(data.ticketCount).toBeGreaterThan(0);
            expect(data.showtimeWindow.start).toBeTruthy();
            expect(data.showtimeWindow.end).toBeTruthy();

            const context = await browser.newContext({
                storageState: districtStatePath,
            });
            let activePage = await context.newPage();

            const homePage = new HomePage(activePage);
            const movieDetailsPage = new MovieDetailsPage(activePage);
            const showtimePage = new ShowtimePage(activePage);
            const seatLayoutPage = new SeatLayoutPage(activePage);
            const orderReviewPage = new OrderReviewPage(activePage);
            const paymentPage = new PaymentPage(activePage);

            const pageObjects = [
                homePage,
                movieDetailsPage,
                showtimePage,
                seatLayoutPage,
                orderReviewPage,
                paymentPage,
            ];

            const bindActivePage = () => {
                for (const pageObject of pageObjects) {
                    pageObject.page = activePage;
                }
                paymentPage.paymentCheckout = activePage.locator('payment-checkout');
            };

            const syncActivePage = async () => {
                const districtPages = context.pages().filter((candidate) =>
                    !candidate.isClosed() && /district\.in/i.test(candidate.url()),
                );

                if (districtPages.length > 0) {
                    activePage = districtPages[districtPages.length - 1];
                } else if (activePage.isClosed()) {
                    throw new Error(
                        'District closed the booking page and no active District tab remains.',
                    );
                }

                bindActivePage();
                await activePage.waitForLoadState('domcontentloaded', {
                    timeout: 10_000,
                }).catch(() => {});
                return activePage;
            };

            // If District opens a new tab, start tracking it after it navigates
            // to District. Ignore blank and unrelated third-party pages.
            context.on('page', (newPage) => {
                newPage.on('framenavigated', () => {
                    if (!newPage.isClosed() && /district\.in/i.test(newPage.url())) {
                        activePage = newPage;
                        bindActivePage();
                        console.log('Switched active District page to: ' + newPage.url());
                    }
                });
            });

            const skipAnyVisibleOptionalPrompts = async (maximumSkips = 2) => {
                let skippedCount = 0;

                for (let step = 0; step < maximumSkips; step += 1) {
                    await syncActivePage();
                    const skipped = await orderReviewPage.skipOptionalPromptIfVisible({
                        timeoutMs: 4_000,
                    });
                    await syncActivePage();

                    if (!skipped) break;
                    skippedCount += 1;
                }

                return skippedCount;
            };

            try {
                console.log('Active booking test data: ' + JSON.stringify(data, null, 2));

                await homePage.openDistrict();
                await homePage.selectPreferredLocation(data.locationName);
                await homePage.selectMovieByName(data.movieName);
                await syncActivePage();

                await movieDetailsPage.clickBookTickets();
                await movieDetailsPage.proceed();
                await syncActivePage();

                const selectedShow = await showtimePage.selectNearestAvailableShowtimeWithinRadius(
                    data.radiusKm,
                    data.showtimeWindow,
                );

                console.log(
                    'Chosen theatre: ' + selectedShow.theatreName
                    + ' | distance: ' + selectedShow.distanceKm + ' km'
                    + ' | showtime: ' + selectedShow.showtime,
                );

                await syncActivePage();
                await seatLayoutPage.closeInitialOverlay();

                const selectedSeats = await seatLayoutPage.selectBestAvailableSeats(
                    data.ticketCount,
                );

                console.log(
                    'Ticket count: ' + data.ticketCount
                    + ' | selected seats: ' + selectedSeats.join(' | '),
                );

                await syncActivePage();

                // Continue from the seat selection step. If District opens a new
                // District tab during this action, rebind and inspect the new state.
                try {
                    await seatLayoutPage.proceedWithSeatSelection();
                } catch (error) {
                    await syncActivePage();
                    const confirmNowVisible = await activePage.getByRole('button', {
                        name: 'Confirm and proceed',
                        exact: true,
                    }).isVisible().catch(() => false);

                    if (!confirmNowVisible && activePage.url().includes('/movies/seat-layout/')) {
                        throw error;
                    }
                    console.log('Seat Proceed caused a booking transition to: ' + activePage.url());
                }

                // Some District sessions show a snack prompt before confirmation.
                await skipAnyVisibleOptionalPrompts(2);
                await syncActivePage();

                const confirmButton = activePage.getByRole('button', {
                    name: 'Confirm and proceed',
                    exact: true,
                }).first();

                if (await confirmButton.isVisible().catch(() => false)) {
                    try {
                        await seatLayoutPage.confirmSeatsAndProceed();
                    } catch (error) {
                        await syncActivePage();
                        const stillWaitingForConfirmation = await activePage.getByRole('button', {
                            name: 'Confirm and proceed',
                            exact: true,
                        }).isVisible().catch(() => false);

                        if (stillWaitingForConfirmation) throw error;
                        console.log('Seat confirmation advanced to: ' + activePage.url());
                    }
                }

                // Additional food/add-on screens can appear after seat confirmation.
                await skipAnyVisibleOptionalPrompts(3);
                await syncActivePage();

                await paymentPage.expectCheckoutVisible();
                await paymentPage.logDom('data-driven flow - before Pay Now');

                await paymentPage.clickPayNow();
                await paymentPage.inspectOpenPagesAndFrames(context);
                await paymentPage.selectScanQrToPay();
                await paymentPage.selectUpiQrCode();

                console.log(
                    'Reached the UPI QR payment screen. No payment was made and no booking was completed.',
                );
            } finally {
                await context.close();
            }
        },
    );
}