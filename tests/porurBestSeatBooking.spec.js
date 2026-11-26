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

test('Find the best available seat at a theatre within 15 km of Porur', async ({ browser }) => {
    test.setTimeout(150_000);

    expect(
        fs.existsSync(districtStatePath),
        'District login state not found. Run "npm run auth:district" first.',
    ).toBe(true);

    const context = await browser.newContext({
        storageState: districtStatePath,
    });
    const page = await context.newPage();

    const homePage = new HomePage(page);
    const movieDetailsPage = new MovieDetailsPage(page);
    const showtimePage = new ShowtimePage(page);
    const seatLayoutPage = new SeatLayoutPage(page);
    const orderReviewPage = new OrderReviewPage(page);
    const paymentPage = new PaymentPage(page);

    try {
        await homePage.openDistrict();

        // This test has its own location preference. It does not change the existing test.
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

        await seatLayoutPage.proceedWithSeatSelection();
        await seatLayoutPage.confirmSeatsAndProceed();

        await orderReviewPage.skipAdditionalOptions();
        await paymentPage.expectCheckoutVisible();

        console.log(
            'Porur best-seat flow reached checkout. Payment was intentionally not initiated.',
        );
    } finally {
        await context.close();
    }
});
