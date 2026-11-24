import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';
import { logPaymentDom } from '../utils/logPaymentDom.js';
export class PaymentPage extends BasePage {
    constructor(page) { super(page); this.paymentCheckout = page.locator('payment-checkout'); }
    async expectCheckoutVisible(){ await expect(this.paymentCheckout).toBeVisible(); }
    async logDom(label) { await logPaymentDom(this.page, label); }
    async getPayNowPoint() {
        return this.paymentCheckout.evaluate((checkout) => {
            const label = Array.from(checkout.shadowRoot?.querySelectorAll('span') ?? []).find((span) => span.textContent.trim() === 'Pay now');
            if (!label) return null;
            const bounds = label.getBoundingClientRect(); const style = window.getComputedStyle(label);
            if (!bounds.width || !bounds.height || style.display === 'none' || style.visibility !== 'visible') return null;
            return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
        });
    }
    async isPaymentDialogVisible() {
        return this.paymentCheckout.evaluate((checkout) => {
            const dialog = checkout.shadowRoot?.querySelector('[role="dialog"]'); if (!dialog) return false;
            const bounds = dialog.getBoundingClientRect(); const style = window.getComputedStyle(dialog);
            return bounds.width > 0 && bounds.height > 0 && style.display !== 'none' && style.visibility === 'visible';
        });
    }
    async waitForPaymentDialog(timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) { if (await this.isPaymentDialogVisible()) return true; await this.page.waitForTimeout(250); }
        return this.isPaymentDialogVisible();
    }
    async clickPayNow() {
        await expect.poll(() => this.getPayNowPoint(), { timeout: 30_000 }).not.toBeNull();
        const maxAttempts = 3; let opened = await this.isPaymentDialogVisible();
        for (let attempt = 1; attempt <= maxAttempts && !opened; attempt++) {
            const point = await this.getPayNowPoint();
            if (!point) { opened = await this.waitForPaymentDialog(5_000); break; }
            console.log(`Pay Now click attempt ${attempt}/${maxAttempts}`);
            await this.page.mouse.click(point.x, point.y); opened = await this.waitForPaymentDialog(5_000);
        }
        if (!opened) throw new Error(`Payment dialog did not open after ${maxAttempts} Pay Now click attempts.`);
        await this.logDom('after Pay Now click');
    }
    async getScanQrPoint() {
        return this.paymentCheckout.evaluate((checkout) => {
            const option = Array.from(checkout.shadowRoot?.querySelectorAll('label') ?? []).find((label) => label.textContent.trim() === 'Scan QR to pay');
            if (!option) return null;
            const bounds = option.getBoundingClientRect(); const style = window.getComputedStyle(option);
            if (!bounds.width || !bounds.height || style.display === 'none' || style.visibility !== 'visible') return null;
            return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
        });
    }
    async selectScanQrToPay() {
        await expect.poll(() => this.getScanQrPoint(), { timeout: 30_000 }).not.toBeNull();
        const point = await this.getScanQrPoint();
        if (!point) throw new Error('Visible "Scan QR to pay" option disappeared before it could be clicked.');
        await this.page.mouse.click(point.x, point.y);
    }
    async getUpiQrPoint() {
        return this.paymentCheckout.evaluate((checkout) => {
            const image = checkout.shadowRoot?.querySelector('img[alt="UPI QR Code"]'); const button = image?.closest('button');
            if (!button) return null;
            const bounds = button.getBoundingClientRect(); const style = window.getComputedStyle(button);
            if (!bounds.width || !bounds.height || style.display === 'none' || style.visibility !== 'visible') return null;
            return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
        });
    }
    async selectUpiQrCode() {
        await expect.poll(() => this.getUpiQrPoint(), { timeout: 30_000 }).not.toBeNull();
        const point = await this.getUpiQrPoint();
        if (!point) throw new Error('Visible UPI QR button disappeared before it could be clicked.');
        await this.page.mouse.click(point.x, point.y);
        await this.page.waitForTimeout(10_000);
        await this.logDom('10 seconds after UPI QR click');
    }
    async inspectOpenPagesAndFrames(context) {
        console.log('Pages:', context.pages().map((openPage) => openPage.url()));
        console.log('Frames:', this.page.frames().map((frame) => frame.url()));
    }
}
