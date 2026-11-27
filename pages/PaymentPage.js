import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';
import { logPaymentDom } from '../utils/logPaymentDom.js';

export class PaymentPage extends BasePage {
    constructor(page) {
        super(page);
        this.paymentCheckout = page.locator('payment-checkout');
    }

    async expectCheckoutVisible() {
        await expect(this.paymentCheckout).toBeVisible({ timeout: 30_000 });
    }

    async logDom(label) {
        await logPaymentDom(this.page, label);
    }

    async getPayNowPoint() {
        return this.paymentCheckout.evaluate((checkout) => {
            const label = Array.from(checkout.shadowRoot?.querySelectorAll('span') ?? [])
                .find((span) => span.textContent.trim().toLowerCase() === 'pay now');
            if (!label) return null;

            const button = label.closest('button') || label;
            const bounds = button.getBoundingClientRect();
            const style = window.getComputedStyle(button);

            if (!bounds.width || !bounds.height
                || style.display === 'none'
                || style.visibility !== 'visible'
                || button.hasAttribute('disabled')) {
                return null;
            }

            return {
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2,
            };
        });
    }

    async isPaymentDialogVisible() {
        return this.paymentCheckout.evaluate((checkout) => {
            const dialog = checkout.shadowRoot?.querySelector('[role="dialog"]');
            if (!dialog) return false;

            const bounds = dialog.getBoundingClientRect();
            const style = window.getComputedStyle(dialog);

            return bounds.width > 0 && bounds.height > 0
                && style.display !== 'none'
                && style.visibility !== 'hidden';
        });
    }

    async getScanQrPoint() {
        return this.paymentCheckout.evaluate((checkout) => {
            const label = Array.from(checkout.shadowRoot?.querySelectorAll('label') ?? [])
                .find((item) => item.textContent.trim() === 'Scan QR to pay');
            if (!label) return null;

            const bounds = label.getBoundingClientRect();
            const style = window.getComputedStyle(label);

            if (!bounds.width || !bounds.height
                || style.display === 'none'
                || style.visibility === 'hidden') {
                return null;
            }

            return {
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2,
            };
        });
    }

    async getUpiQrPoint() {
        return this.paymentCheckout.evaluate((checkout) => {
            const image = checkout.shadowRoot?.querySelector('img[alt="UPI QR Code"]');
            const button = image?.closest('button');
            if (!button) return null;

            const bounds = button.getBoundingClientRect();
            const style = window.getComputedStyle(button);

            if (!bounds.width || !bounds.height
                || style.display === 'none'
                || style.visibility === 'hidden'
                || button.hasAttribute('disabled')) {
                return null;
            }

            return {
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2,
            };
        });
    }

    async clickPayNow() {
        await this.expectCheckoutVisible();

        // Prefer a real Playwright locator inside the custom element's open
        // shadow root. Only use coordinates as a fallback if District exposes
        // no text locator for this control.
        const payNowText = this.paymentCheckout.getByText('Pay now', {
            exact: true,
        }).first();

        if (await payNowText.isVisible().catch(() => false)) {
            await this.clickReady(payNowText, 'Pay now action');
        } else {
            await expect.poll(() => this.getPayNowPoint(), {
                timeout: 30_000,
                message: 'Pay Now control was not rendered in the checkout component.',
            }).not.toBeNull();

            const point = await this.getPayNowPoint();
            if (!point) throw new Error('Pay Now control disappeared before click.');
            await this.page.mouse.click(point.x, point.y);
        }

        // Wait for the resulting payment dialog; do not issue a second click
        // while the first click may still be processing.
        await expect.poll(() => this.isPaymentDialogVisible(), {
            timeout: 30_000,
            message: 'Payment dialog did not open after the Pay Now action.',
        }).toBe(true);

        await this.logDom('after Pay Now click');
    }

    async selectScanQrToPay() {
        const scanText = this.paymentCheckout.getByText('Scan QR to pay', {
            exact: true,
        }).first();

        if (await scanText.isVisible().catch(() => false)) {
            await this.clickReady(scanText, 'Scan QR to pay option');
        } else {
            await expect.poll(() => this.getScanQrPoint(), {
                timeout: 30_000,
                message: 'Scan QR to pay option was not displayed.',
            }).not.toBeNull();

            const point = await this.getScanQrPoint();
            if (!point) throw new Error('Scan QR option disappeared before click.');
            await this.page.mouse.click(point.x, point.y);
        }

        await expect.poll(() => this.getUpiQrPoint(), {
            timeout: 30_000,
            message: 'UPI QR payment option did not appear after selecting Scan QR to pay.',
        }).not.toBeNull();
    }

    async selectUpiQrCode() {
        await expect.poll(() => this.getUpiQrPoint(), {
            timeout: 30_000,
            message: 'UPI QR option was not displayed.',
        }).not.toBeNull();

        const point = await this.getUpiQrPoint();
        if (!point) throw new Error('UPI QR option disappeared before click.');

        await this.page.mouse.click(point.x, point.y);
        await this.logDom('after UPI QR selection');
    }

    async inspectOpenPagesAndFrames(context) {
        console.log('Pages:', context.pages().map((openPage) => openPage.url()));
        console.log('Frames:', this.page.frames().map((frame) => frame.url()));
    }
}