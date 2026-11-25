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

test('Book one Ramayana ticket in Chennai through the payment page', async ({ browser }) => {
    test.setTimeout(120_000);
    expect(fs.existsSync(districtStatePath), 'District login state not found. Run "npm run auth:district" first.').toBe(true);
    const context = await browser.newContext({ storageState: districtStatePath });
    const page = await context.newPage();
    const homePage = new HomePage(page);
    const movieDetailsPage = new MovieDetailsPage(page);
    const showtimePage = new ShowtimePage(page);
    const seatLayoutPage = new SeatLayoutPage(page);
    const orderReviewPage = new OrderReviewPage(page);
    const paymentPage = new PaymentPage(page);
    try {
        await homePage.openDistrict();
        await homePage.selectRamayanaMovie();
        await movieDetailsPage.clickBookTickets();
        await movieDetailsPage.proceed();
        await showtimePage.selectFirstAvailableShowtime();
        await seatLayoutPage.closeInitialOverlay();
        await seatLayoutPage.selectFirstAvailableSeat();
        await seatLayoutPage.proceedWithSeatSelection();
        await seatLayoutPage.confirmSeatsAndProceed();
        await orderReviewPage.skipAdditionalOptions();
        await paymentPage.expectCheckoutVisible();
        await paymentPage.logDom('before Pay Now');
        await paymentPage.clickPayNow();
        await paymentPage.inspectOpenPagesAndFrames(context);
        await paymentPage.selectScanQrToPay();
        await paymentPage.selectUpiQrCode();
    }

    finally {
        await context.close();
    }
});
