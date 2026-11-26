import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { HomePage } from '../pages/HomePage.js';
import { MovieDetailsPage } from '../pages/MovieDetailsPage.js';
import { ShowtimePage } from '../pages/ShowtimePage.js';
import { SeatLayoutPage } from '../pages/SeatLayoutPage.js';
import { OrderReviewPage } from '../pages/OrderReviewPage.js';
import { PaymentPage } from '../pages/PaymentPage.js';

const districtStatePath = path.resolve('playwright/.auth/district.json');

test('Find the best available seat at a theatre within 15 km of Porur and reach UPI QR', async ({ browser }) => {
    test.setTimeout(180_000);

    expect(
        fs.existsSync(districtStatePath),
        'District login state not found. Run "npm run auth:district" first.',
    ).toBe(true);

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

    // District can replace the current tab during booking transitions.
    context.on('page', (newPage) => {
        if (!newPage.isClosed()) {
            activePage = newPage;
            console.log('District opened a booking tab:', newPage.url());
        }
    });

    const syncActivePage = async () => {
        const livePages = context.pages().filter((candidate) => !candidate.isClosed());

        if (livePages.length === 0) {
            throw new Error('District closed the booking page and no replacement page is available.');
        }

        const latestPage = livePages[livePages.length - 1];

        if (latestPage !== activePage) {
            activePage = latestPage;
            await activePage.waitForLoadState('domcontentloaded').catch(() => {});
            console.log('Switched booking automation to:', activePage.url());
        }

        seatLayoutPage.page = activePage;
        orderReviewPage.page = activePage;
        paymentPage.page = activePage;
        paymentPage.paymentCheckout = activePage.locator('payment-checkout');

        return activePage;
    };

    const skipSnackPrompt = async () => {
        await syncActivePage();
        const pageBeforeSkip = activePage;

        try {
            await orderReviewPage.skipSnackSelectionIfVisible();
        } catch (error) {
            await syncActivePage();

            if (activePage === pageBeforeSkip) {
                throw error;
            }

            console.log('Snack skip caused a booking-page transition.');
        }

        await syncActivePage();
    };

    try {
        await homePage.openDistrict();
        await homePage.selectPreferredLocation('Porur');

        await homePage.selectRamayanaMovie();
        await movieDetailsPage.clickBookTickets();
        await movieDetailsPage.proceed();

        const selectedShow = await showtimePage
            .selectNearestAvailableShowtimeWithinRadius(15);

        console.log(
            `Selected theatre: ${selectedShow.theatreName} | ${selectedShow.distanceKm} km from Porur | ${selectedShow.showtime}`,
        );

        await seatLayoutPage.closeInitialOverlay();

        const selectedSeat = await seatLayoutPage.selectBestAvailableSeat();
        console.log(`Selected best-position seat: ${selectedSeat}`);

        await syncActivePage();

        // Proceed from the seat map. District may show its snack prompt here.
        try {
            await seatLayoutPage.proceedWithSeatSelection();
        } catch (error) {
            await syncActivePage();

            if (activePage.url().includes('/movies/seat-layout/')) {
                throw error;
            }

            console.log('Proceed moved the booking to:', activePage.url());
        }

        // Skip snacks if the prompt is shown between seat selection and confirmation.
        await skipSnackPrompt();

        const confirmButton = activePage.getByRole('button', {
            name: 'Confirm and proceed',
            exact: true,
        });

        if (await confirmButton.isVisible().catch(() => false)) {
            const pageBeforeConfirmation = activePage;

            try {
                await seatLayoutPage.confirmSeatsAndProceed();
            } catch (error) {
                await syncActivePage();

                if (activePage === pageBeforeConfirmation) {
                    throw error;
                }

                console.log('Seat confirmation moved the booking to:', activePage.url());
            }
        }

        await syncActivePage();

        // Keep the original post-confirmation Skip action for any remaining add-ons.
        const additionalOptionsSkip = activePage.getByRole('button', {
            name: 'Skip',
            exact: true,
        });

        if (await additionalOptionsSkip.isVisible().catch(() => false)) {
            await orderReviewPage.skipAdditionalOptions();
            await syncActivePage();
        } else {
            await expect(activePage).toHaveURL(
                /\/movies\/(order-review|payment|checkout)\//,
                { timeout: 30_000 },
            );
        }

        await paymentPage.expectCheckoutVisible();
        await paymentPage.logDom('Porur flow - before Pay Now');

        // Continue exactly as the existing working QR payment flow.
        await paymentPage.clickPayNow();
        await paymentPage.inspectOpenPagesAndFrames(context);
        await paymentPage.selectScanQrToPay();
        await paymentPage.selectUpiQrCode();

        console.log(
            'Porur best-seat flow reached the UPI QR payment screen. Payment was not completed.',
        );
    } finally {
        await context.close();
    }
});
