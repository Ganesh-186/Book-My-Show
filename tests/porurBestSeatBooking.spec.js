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

    // District may open a fresh tab while moving between booking steps.
    context.on('page', (newPage) => {
        if (!newPage.isClosed()) {
            activePage = newPage;
            console.log('District opened a new booking tab:', newPage.url());
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

        // Clicking Proceed can lead to a snack/add-on step. If District opens
        // that step in a new tab, continue with the latest live page instead
        // of trying to use the page that District has closed.
        try {
            await seatLayoutPage.proceedWithSeatSelection();
        } catch (error) {
            await syncActivePage();

            if (activePage.url().includes('/movies/seat-layout/')) {
                throw error;
            }

            console.log('Seat Proceed caused a booking-page transition:', activePage.url());
        }

        await syncActivePage();

        // Handle a snack prompt if it appears before seat confirmation.
        await orderReviewPage.skipSnackSelectionIfVisible();
        await syncActivePage();

        const confirmButton = activePage.getByRole('button', {
            name: 'Confirm and proceed',
            exact: true,
        });

        if (await confirmButton.isVisible().catch(() => false)) {
            await seatLayoutPage.confirmSeatsAndProceed();
        }

        await syncActivePage();

        // Skip the optional snack/add-on prompt after seat confirmation,
        // then continue to the order-review/payment page.
        await orderReviewPage.skipAdditionalOptions();
        await syncActivePage();

        await paymentPage.expectCheckoutVisible();
        await paymentPage.logDom('Porur flow - before Pay Now');

        // Same QR-payment steps as the existing working booking flow.
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
