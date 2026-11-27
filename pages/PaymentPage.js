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

        const payNowButton = this.paymentCheckout.getByRole('button', {
            name: /pay now/i,
        }).first();
        let dialogOpened = await this.isPaymentDialogVisible();

        // A retry is permitted only after checking that the dialog did not open.
        // Never click Pay Now again while the first action is still processing.
        for (let attempt = 1; attempt <= 2 && !dialogOpened; attempt += 1) {
            if (await payNowButton.isVisible().catch(() => false)) {
                await this.clickReady(payNowButton, 'Pay Now button');
            } else {
                await expect.poll(() => this.getPayNowPoint(), {
                    timeout: 30_000,
                    message: 'Pay Now control was not rendered in the checkout component.',
                }).not.toBeNull();

                const point = await this.getPayNowPoint();
                if (!point) throw new Error('Pay Now control disappeared before click.');
                await this.page.mouse.click(point.x, point.y);
            }

            try {
                await expect.poll(() => this.isPaymentDialogVisible(), {
                    timeout: 15_000,
                    message: 'Payment dialog did not open after the Pay Now action.',
                }).toBe(true);
                dialogOpened = true;
            } catch (error) {
                dialogOpened = await this.isPaymentDialogVisible();

                if (!dialogOpened && attempt === 2) {
                    throw error;
                }

                if (!dialogOpened) {
                    const stillClickable = await payNowButton.isVisible().catch(() => false);
                    if (!stillClickable) {
                        // The UI may be transitioning even though the dialog
                        // has not rendered yet. Wait for the dialog; do not click.
                        await expect.poll(() => this.isPaymentDialogVisible(), {
                            timeout: 15_000,
                        }).toBe(true);
                        dialogOpened = true;
                    }
                }
            }
        }

        if (!dialogOpened) {
            throw new Error('Payment dialog did not open after the Pay Now action.');
        }

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